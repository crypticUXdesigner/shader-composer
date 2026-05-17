import type { NodeGraph, NodeInstance, AutomationRegion } from '../../data-model/types';
import type { NodeSpec } from '../../types/nodeSpec';
import type { AutomationCurve } from '../../data-model/types';
import {
  evaluateCurveAtNormalizedTime,
  sortEvaluableRegions,
} from '../../utils/automationEvaluator';

function scaledCurveEndpoint(region: AutomationRegion, s: number, min: number, max: number): number {
  const raw = evaluateCurveAtNormalizedTime(region.curve, s);
  const v = min + raw * (max - min);
  return Math.max(min, Math.min(max, v));
}

function fmtGlslFloat(v: number): string {
  if (!Number.isFinite(v)) {
    throw new Error('Automation codegen: non-finite scalar');
  }
  return v.toFixed(10);
}

/**
 * Base shader template for node-based shader system
 */
export const BASE_SHADER_TEMPLATE = `#version 300 es
precision highp float;

// Global uniforms
uniform vec2 uResolution;
uniform float uTime;
uniform float uTimelineTime;

{{UNIFORMS}}

// Global variable declarations (accessible in functions)
{{VARIABLE_DECLARATIONS}}

{{FUNCTIONS}}

out vec4 fragColor;

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution.xy;
  vec2 p = (uv * 2.0 - 1.0) * vec2(uResolution.x / uResolution.y, 1.0);
  
  {{MAIN_CODE}}
  
  fragColor = vec4({{FINAL_COLOR}}, 1.0);
}`;

/**
 * Sanitize lane id to a valid GLSL identifier (evalAutomation_<id>).
 */
export function sanitizeAutomationLaneId(laneId: string): string {
  let id = laneId.replace(/[^a-zA-Z0-9]/g, '_');
  if (!id) id = 'lane';
  if (/^\d/.test(id)) id = 'a' + id;
  return id;
}

/**
 * Emit GLSL to evaluate one curve segment (linear/stepped/bezier) at normalized s in [0,1].
 */
export function emitCurveEvalGlsl(
  curve: AutomationCurve,
  sVar: string,
  prefix: string
): string {
  const keyframes = [...(curve.keyframes ?? [])].sort((a, b) => a.time - b.time);
  if (keyframes.length === 0) return `${prefix}_raw = 0.0;`;
  if (keyframes.length === 1) return `${prefix}_raw = ${keyframes[0].value.toFixed(10)};`;

  const n = keyframes.length;
  const fmtKf = (x: number): string => {
    const v = Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0;
    return v.toFixed(10);
  };
  const times = keyframes.map((k) => fmtKf(k.time)).join(', ');
  const values = keyframes.map((k) => fmtKf(k.value)).join(', ');
  const interp = curve.interpolation || 'linear';

  const lines: string[] = [];
  lines.push(`const float ${prefix}_t[${n}] = float[${n}](${times});`);
  lines.push(`const float ${prefix}_v[${n}] = float[${n}](${values});`);
  lines.push(`float ${prefix}_raw = 0.0;`);
  lines.push(`for (int i = 0; i < ${n - 1}; i++) {`);
  lines.push(`  if (${sVar} >= ${prefix}_t[i] && ${sVar} < ${prefix}_t[i+1]) {`);
  const segT = `(${sVar} - ${prefix}_t[i]) / (${prefix}_t[i+1] - ${prefix}_t[i])`;
  if (interp === 'stepped') {
    lines.push(`    ${prefix}_raw = ${prefix}_v[i];`);
  } else if (interp === 'bezier') {
    const segDur = `(${prefix}_t[i+1] - ${prefix}_t[i])`;
    lines.push(`    float segT = ${segT};`);
    lines.push(`    float segDur = ${segDur};`);
    lines.push(`    float m0 = (i > 0) ? (${prefix}_v[i+1] - ${prefix}_v[i-1]) / (${prefix}_t[i+1] - ${prefix}_t[i-1] + 1e-9) : (${prefix}_v[i+1] - ${prefix}_v[i]) / (${prefix}_t[i+1] - ${prefix}_t[i] + 1e-9);`);
    lines.push(`    float m1 = (i+2 < ${n}) ? (${prefix}_v[i+2] - ${prefix}_v[i]) / (${prefix}_t[i+2] - ${prefix}_t[i] + 1e-9) : (${prefix}_v[i+1] - ${prefix}_v[i]) / (${prefix}_t[i+1] - ${prefix}_t[i] + 1e-9);`);
    lines.push(`    float dm0 = m0 * segDur; float dm1 = m1 * segDur;`);
    lines.push(`    float t2 = segT*segT, t3 = t2*segT;`);
    lines.push(`    float h00 = 2.0*t3 - 3.0*t2 + 1.0, h10 = t3 - 2.0*t2 + segT;`);
    lines.push(`    float h01 = -2.0*t3 + 3.0*t2, h11 = t3 - t2;`);
    lines.push(`    ${prefix}_raw = h00*${prefix}_v[i] + h10*dm0 + h01*${prefix}_v[i+1] + h11*dm1;`);
  } else {
    lines.push(`    ${prefix}_raw = mix(${prefix}_v[i], ${prefix}_v[i+1], ${segT});`);
  }
  lines.push(`    break;`);
  lines.push(`  }`);
  lines.push(`}`);
  lines.push(`if (${sVar} >= ${prefix}_t[${n - 1}]) ${prefix}_raw = ${prefix}_v[${n - 1}];`);
  return lines.join('\n');
}

/**
 * Generate GLSL functions float evalAutomation_<laneId>(float t) for each automation lane.
 * Mirrors lane-wide extrapolation in {@link evaluateLaneAutomationAtTime} (lead-in, hold, loop-until-next).
 */
export function generateAutomationFunctions(
  graph: NodeGraph,
  executionOrder: string[],
  nodeSpecs: Map<string, NodeSpec>,
  sanitizeAutomationLaneIdFn: (laneId: string) => string,
  emitCurveEvalGlslFn: (curve: AutomationCurve, sVar: string, prefix: string) => string
): string {
  const automation = graph.automation;
  if (!automation?.lanes?.length) return '';

  const orderSet = new Set(executionOrder);
  const out: string[] = [];

  for (const lane of automation.lanes) {
    if (!orderSet.has(lane.nodeId)) continue;
    const node = graph.nodes.find(n => n.id === lane.nodeId);
    if (!node) continue;
    const nodeSpec = nodeSpecs.get(node.type);
    if (!nodeSpec) continue;
    const paramSpec = nodeSpec.parameters[lane.paramName];
    if (!paramSpec || paramSpec.type !== 'float') continue;

    const regions = sortEvaluableRegions(lane);
    if (regions.length === 0) continue;

    const id = sanitizeAutomationLaneIdFn(lane.id);
    const min = paramSpec.min ?? 0;
    const max = paramSpec.max ?? 1;
    const minStr = fmtGlslFloat(min);
    const maxStr = fmtGlslFloat(max);

    const lines: string[] = [];
    lines.push(`float evalAutomation_${id}(float t) {`);

    const r0 = regions[0];
    const leadIn = scaledCurveEndpoint(r0, 0, min, max);
    lines.push(`  if (t < ${fmtGlslFloat(r0.startTime)}) return ${fmtGlslFloat(leadIn)};`);

    const n = regions.length;
    for (let i = 0; i < n; i++) {
      const region = regions[i];
      const nextStart = i + 1 < n ? regions[i + 1].startTime : null;
      const start = region.startTime;
      const dur = region.duration;
      const end = start + dur;
      const prefix = `lane_${id}_r${i}`;

      if (region.loop) {
        if (nextStart !== null) {
          lines.push(`  if (t >= ${fmtGlslFloat(start)} && t < ${fmtGlslFloat(nextStart)}) {`);
        } else {
          lines.push(`  if (t >= ${fmtGlslFloat(start)}) {`);
        }
        lines.push(`    float localT = mod(t - ${fmtGlslFloat(start)}, ${fmtGlslFloat(dur)});`);
        lines.push(`    float s = localT / ${fmtGlslFloat(dur)};`);
        lines.push(emitCurveEvalGlslFn(region.curve, 's', prefix).replace(/^/gm, '    '));
        lines.push(`    return clamp(${minStr} + ${prefix}_raw * (${maxStr} - ${minStr}), ${minStr}, ${maxStr});`);
        lines.push(`  }`);
      } else {
        const insideEnd = nextStart !== null ? Math.min(end, nextStart) : end;
        lines.push(`  if (t >= ${fmtGlslFloat(start)} && t < ${fmtGlslFloat(insideEnd)}) {`);
        lines.push(`    float s = (t - ${fmtGlslFloat(start)}) / ${fmtGlslFloat(dur)};`);
        lines.push(emitCurveEvalGlslFn(region.curve, 's', prefix).replace(/^/gm, '    '));
        lines.push(`    return clamp(${minStr} + ${prefix}_raw * (${maxStr} - ${minStr}), ${minStr}, ${maxStr});`);
        lines.push(`  }`);
        if (nextStart !== null) {
          const hold = scaledCurveEndpoint(region, 1, min, max);
          lines.push(`  if (t >= ${fmtGlslFloat(end)} && t < ${fmtGlslFloat(nextStart)}) {`);
          lines.push(`    return ${fmtGlslFloat(hold)};`);
          lines.push(`  }`);
        }
      }
    }

    const last = regions[n - 1];
    if (!last.loop) {
      lines.push(`  return ${fmtGlslFloat(scaledCurveEndpoint(last, 1, min, max))};`);
    }

    lines.push(`}`);
    out.push(lines.join('\n'));
  }

  return out.length ? out.join('\n\n') : '';
}

/**
 * Find final output node in the graph.
 */
export function findFinalOutputNode(
  graph: NodeGraph,
  executionOrder: string[],
  nodeSpecs: Map<string, NodeSpec>
): NodeInstance | null {
  const outputNodes = graph.nodes.filter(n => {
    const spec = nodeSpecs.get(n.type);
    return spec?.id === 'final-output';
  });

  if (outputNodes.length === 1) return outputNodes[0];

  if (outputNodes.length > 1) {
    // Prefer a final-output node that is actually wired up (disambiguation when multiple exist).
    const wiredOutputs = outputNodes.filter((n) =>
      graph.connections.some((c) => c.targetNodeId === n.id && c.targetPort === 'in')
    );
    if (wiredOutputs.length === 1) return wiredOutputs[0];

    const candidates = wiredOutputs.length ? wiredOutputs : outputNodes;
    const outgoingConnections = new Set(graph.connections.map(c => c.sourceNodeId));
    const leaf = candidates.find(n => !outgoingConnections.has(n.id));
    if (leaf) return leaf;
    return candidates.sort((a, b) =>
      executionOrder.indexOf(b.id) - executionOrder.indexOf(a.id)
    )[0];
  }

  for (let i = executionOrder.length - 1; i >= 0; i--) {
    const node = graph.nodes.find(n => n.id === executionOrder[i]);
    if (!node) continue;
    const spec = nodeSpecs.get(node.type);
    const hasColorOutput = spec?.outputs.some(o => o.type === 'vec3' || o.type === 'vec4');
    if (hasColorOutput) return node;
  }

  return null;
}

/**
 * Generate final color variable expression for the shader.
 */
export function generateFinalColorVariable(
  graph: NodeGraph,
  finalOutputNode: NodeInstance | null,
  variableNames: Map<string, Map<string, string>>,
  nodeSpecs: Map<string, NodeSpec>,
  effectiveNodeSpecsById?: Map<string, NodeSpec>
): string {
  if (!finalOutputNode) {
    const executionOrder = Array.from(variableNames.keys());
    for (let i = executionOrder.length - 1; i >= 0; i--) {
      const nodeId = executionOrder[i];
      const outputVars = variableNames.get(nodeId);
      if (!outputVars || outputVars.size === 0) continue;
      const firstOutput = Array.from(outputVars.values())[0];
      const node = graph.nodes.find(n => n.id === nodeId);
      if (!node) continue;
      const nodeSpec = effectiveNodeSpecsById?.get(node.id) ?? nodeSpecs.get(node.type);
      const firstOutputPort = nodeSpec?.outputs[0];
      if (firstOutputPort) {
        if (firstOutputPort.type === 'vec4') return `${firstOutput}.rgb`;
        if (firstOutputPort.type === 'vec3') return firstOutput;
        if (firstOutputPort.type === 'vec2') return `vec3(${firstOutput}, 0.0)`;
        if (firstOutputPort.type === 'float') return `vec3(${firstOutput})`;
      }
    }
    return 'vec3(0.0)';
  }

  const finalOutputSpec = effectiveNodeSpecsById?.get(finalOutputNode.id) ?? nodeSpecs.get(finalOutputNode.type);
  if (finalOutputSpec?.id === 'final-output') {
    const inputConnection = graph.connections.find(
      conn => conn.targetNodeId === finalOutputNode.id && conn.targetPort === 'in'
    );
    if (inputConnection) {
      const sourceNode = graph.nodes.find(n => n.id === inputConnection.sourceNodeId);
      if (sourceNode) {
        const sourceSpec = effectiveNodeSpecsById?.get(sourceNode.id) ?? nodeSpecs.get(sourceNode.type);
        if (sourceSpec) {
          const sourceOutput = sourceSpec.outputs.find(o => o.name === inputConnection.sourcePort);
          const sourceVarName = variableNames.get(inputConnection.sourceNodeId)?.get(inputConnection.sourcePort);
          if (sourceVarName && sourceOutput) {
            if (sourceOutput.type === 'vec4') return `${sourceVarName}.rgb`;
            if (sourceOutput.type === 'vec3') return sourceVarName;
            if (sourceOutput.type === 'vec2') return `vec3(${sourceVarName}, 0.0)`;
            if (sourceOutput.type === 'float') return `vec3(${sourceVarName})`;
          }
        }
      }
    }
    return 'vec3(0.0)';
  }

  const outputVars = variableNames.get(finalOutputNode.id);
  if (!outputVars) return 'vec3(0.0)';
  const firstOutput = Array.from(outputVars.values())[0];
  if (firstOutput) {
    const nodeSpec = effectiveNodeSpecsById?.get(finalOutputNode.id) ?? nodeSpecs.get(finalOutputNode.type);
    const firstOutputPort = nodeSpec?.outputs[0];
    if (firstOutputPort) {
      if (firstOutputPort.type === 'vec4') return `${firstOutput}.rgb`;
      if (firstOutputPort.type === 'vec3') return firstOutput;
      if (firstOutputPort.type === 'vec2') return `vec3(${firstOutput}, 0.0)`;
      if (firstOutputPort.type === 'float') return `vec3(${firstOutput})`;
    }
    return firstOutput;
  }
  return 'vec3(0.0)';
}

/**
 * Assemble complete shader from parts.
 */
export function assembleShader(
  functions: string,
  uniforms: Array<{ name: string; type: string }>,
  variableDeclarations: string,
  mainCode: string,
  finalColorVar: string,
  automationFunctions: string = ''
): string {
  const uniformDeclarations = uniforms
    .map(u => {
      const type = u.type === 'int' ? 'int' : u.type === 'vec2' ? 'vec2' : u.type === 'vec3' ? 'vec3' : u.type === 'vec4' ? 'vec4' : 'float';
      return `uniform ${type} ${u.name};`;
    })
    .sort()
    .join('\n');

  const allFunctions = automationFunctions
    ? (automationFunctions + '\n\n' + functions)
    : functions;

  let shader = BASE_SHADER_TEMPLATE;
  shader = shader.replace('{{UNIFORMS}}', uniformDeclarations);
  shader = shader.replace('{{VARIABLE_DECLARATIONS}}', variableDeclarations);
  shader = shader.replace('{{FUNCTIONS}}', allFunctions);
  shader = shader.replace('{{MAIN_CODE}}', mainCode);
  shader = shader.replace('{{FINAL_COLOR}}', finalColorVar);
  return shader;
}
