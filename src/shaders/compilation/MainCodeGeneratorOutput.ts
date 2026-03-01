import type { NodeGraph, NodeInstance } from '../../data-model/types';
import type { NodeSpec } from '../../types/nodeSpec';
import type { AutomationCurve } from '../../data-model/types';

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
  const times = keyframes.map(k => k.time.toFixed(10)).join(', ');
  const values = keyframes.map(k => k.value.toFixed(10)).join(', ');
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

    const id = sanitizeAutomationLaneIdFn(lane.id);
    const min = paramSpec.min ?? 0;
    const max = paramSpec.max ?? 1;
    const minStr = min.toFixed(10);
    const maxStr = max.toFixed(10);

    const regions = [...lane.regions].sort((a, b) => a.startTime - b.startTime);
    const blocks: string[] = [];
    regions.forEach((region, ri) => {
      const start = region.startTime.toFixed(10);
      const dur = region.duration.toFixed(10);
      const prefix = `lane_${id}_r${ri}`;
      const curve = region.curve;
      const keyframes = [...(curve?.keyframes ?? [])].sort((a, b) => a.time - b.time);
      if (keyframes.length === 0) return;

      const cond = region.loop
        ? `t >= ${start}`
        : `t >= ${start} && t < ${start} + ${dur}`;
      const localT = region.loop
        ? `mod(t - ${start}, ${dur})`
        : `t - ${start}`;
      blocks.push(`  if (${cond}) {`);
      blocks.push(`    float localT = ${localT};`);
      blocks.push(`    float s = localT / ${dur};`);
      blocks.push(emitCurveEvalGlslFn(curve, 's', prefix).replace(/^/gm, '    '));
      blocks.push(`    return clamp(${minStr} + ${prefix}_raw * (${maxStr} - ${minStr}), ${minStr}, ${maxStr});`);
      blocks.push(`  }`);
    });

    out.push(`float evalAutomation_${id}(float t) {`);
    out.push(blocks.join('\n'));
    out.push(`  return ${minStr};`);
    out.push(`}`);
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
    const outgoingConnections = new Set(graph.connections.map(c => c.sourceNodeId));
    const leaf = outputNodes.find(n => !outgoingConnections.has(n.id));
    if (leaf) return leaf;
    return outputNodes.sort((a, b) =>
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
  nodeSpecs: Map<string, NodeSpec>
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
      const nodeSpec = nodeSpecs.get(node.type);
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

  const finalOutputSpec = nodeSpecs.get(finalOutputNode.type);
  if (finalOutputSpec?.id === 'final-output') {
    const inputConnection = graph.connections.find(
      conn => conn.targetNodeId === finalOutputNode.id && conn.targetPort === 'in'
    );
    if (inputConnection) {
      const sourceNode = graph.nodes.find(n => n.id === inputConnection.sourceNodeId);
      if (sourceNode) {
        const sourceSpec = nodeSpecs.get(sourceNode.type);
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
    const nodeSpec = nodeSpecs.get(finalOutputNode.type);
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
