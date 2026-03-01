import type { NodeGraph, NodeInstance } from '../../data-model/types';
import type { NodeSpec } from '../../types/nodeSpec';
import { sanitizeIdForGlsl } from './MainCodeGeneratorUtils';
import {
  buildFloatParamExpressions,
  getAutomationExpressionForParam,
  type FloatParamExpressionMap
} from './FloatParamExpressions';

/**
 * Collect local variable definitions from mainCode (type id = init;) in definition order.
 * Supports float, vec2/3/4, int, mat2/3/4 so that SDF nodes (e.g. kifs-sdf) that use mat3
 * locals get them inlined when used as raymarcher SDF input.
 */
export function getLocalDefinitionsFromMainCode(mainCode: string): { name: string; initializer: string }[] {
  const locals: { name: string; initializer: string }[] = [];
  const declRegex =
    /(?:(?:mediump|highp|lowp)\s+)?(?:float|vec2|vec3|vec4|int|mat2|mat3|mat4)\s+(\w+)\s*=\s*([\s\S]+?);/g;
  let m: RegExpExecArray | null;
  while ((m = declRegex.exec(mainCode)) !== null) {
    const line = m[0];
    if (line.includes('$output')) continue;
    locals.push({ name: m[1], initializer: m[2].trim() });
  }
  return locals;
}

/**
 * Expand a single-identifier expression by inlining local variable definitions from mainCode.
 */
export function expandOutputExpression(
  expr: string,
  mainCode: string,
  escapeRegex: (str: string) => string
): string {
  const locals = getLocalDefinitionsFromMainCode(mainCode);
  if (locals.length === 0) return expr;

  const localMap = new Map(locals.map((l) => [l.name, l.initializer]));
  const singleId = expr.match(/^\w+$/);
  if (singleId && localMap.has(singleId[0])) {
    expr = localMap.get(singleId[0])!;
  }
  for (let i = locals.length - 1; i >= 0; i--) {
    const { name, initializer } = locals[i];
    const re = new RegExp(`\\b${escapeRegex(name)}\\b`, 'g');
    expr = expr.replace(re, `(${initializer})`);
  }
  return expr;
}

/**
 * Get the output expression of a node when its vec3 position input is set to positionVarName.
 */
export function getOutputExpressionAtPosition(
  sourceNode: NodeInstance,
  sourceSpec: NodeSpec,
  positionVarName: string,
  uniformNames: Map<string, string>,
  functionNameMap: Map<string, Map<string, string>>,
  graph: NodeGraph,
  variableNames: Map<string, Map<string, string>>,
  nodeSpecs: Map<string, NodeSpec>,
  generateParameterCombination: (
    configValue: string,
    inputValue: string,
    mode: 'override' | 'add' | 'subtract' | 'multiply',
    paramType: 'float' | 'int'
  ) => string,
  escapeRegex: (str: string) => string
): string {
  const mainCode = sourceSpec.mainCode || '';
  const match = mainCode.match(/\$output\.(\w+)\s*=\s*([\s\S]+?);/);
  if (!match) return '1000.0';
  let expr = match[2].trim();

  expr = expandOutputExpression(expr, mainCode, escapeRegex);

  const vec3Input = sourceSpec.inputs.find((i) => i.type === 'vec3');
  if (vec3Input) {
    const re = new RegExp(`\\$input\\.${escapeRegex(vec3Input.name)}`, 'g');
    expr = expr.replace(re, positionVarName);
  }
  const floatParamExpressions: FloatParamExpressionMap = buildFloatParamExpressions(
    sourceNode,
    sourceSpec,
    graph,
    uniformNames,
    variableNames,
    nodeSpecs,
    generateParameterCombination,
    escapeRegex
  );

  for (const paramName of Object.keys(sourceSpec.parameters)) {
    const mappedExpr = floatParamExpressions[paramName];
    if (!mappedExpr) continue;
    const paramRegex = new RegExp(`\\$param\\.${escapeRegex(paramName)}\\b`, 'g');
    expr = expr.replace(paramRegex, mappedExpr);
  }

  expr = expr.replace(/\$time/g, 'uTime');
  expr = expr.replace(/\$resolution/g, 'uResolution');

  // Final cleanup pass: catch any remaining $param.* placeholders that weren't replaced
  // by floatParamExpressions (e.g. int params, or floats without uniforms/automation/inputs).
  expr = expr.replace(/\$param\.\w+/g, (match) => {
    const paramName = match.replace('$param.', '');
    const paramSpec = sourceSpec.parameters[paramName];
    const automationExpr = getAutomationExpressionForParam(
      sourceNode.id,
      paramName,
      graph,
      paramSpec
    );
    if (automationExpr) {
      return automationExpr;
    }
    const uniformName = uniformNames.get(`${sourceNode.id}.${paramName}`);
    if (uniformName) {
      return uniformName;
    }
    const paramValue = sourceNode.parameters[paramName];
    if (paramValue !== undefined) {
      return String(paramValue);
    }
    return paramSpec?.type === 'int' ? '0' : '0.0';
  });

  const nodeFunctionNameMap = functionNameMap.get(sourceNode.id);
  if (nodeFunctionNameMap) {
    for (const [originalName, nodeSpecificName] of nodeFunctionNameMap.entries()) {
      const re = new RegExp(`\\b${escapeRegex(originalName)}\\s*\\(`, 'g');
      expr = expr.replace(re, `${nodeSpecificName}(`);
    }
  }
  return expr;
}

/**
 * Build GLSL function float generic_raymarcher_sdf_<id>(vec3 p) for one generic-raymarcher node.
 */
export function buildGenericRaymarcherSdfFunction(
  raymarcherNode: NodeInstance,
  graph: NodeGraph,
  uniformNames: Map<string, string>,
  variableNames: Map<string, Map<string, string>>,
  functionNameMap: Map<string, Map<string, string>>,
  nodeSpecs: Map<string, NodeSpec>,
  generateParameterCombination: (
    configValue: string,
    inputValue: string,
    mode: 'override' | 'add' | 'subtract' | 'multiply',
    paramType: 'float' | 'int'
  ) => string,
  escapeRegex: (str: string) => string
): string {
  const sdfConn = graph.connections.find(
    (c) => c.targetNodeId === raymarcherNode.id && c.targetPort === 'sdf'
  );
  const funcName = `generic_raymarcher_sdf_${sanitizeIdForGlsl(raymarcherNode.id)}`;
  if (!sdfConn) {
    return `float ${funcName}(vec3 p) {\n  return 1000.0;\n}`;
  }
  const sourceNode = graph.nodes.find((n) => n.id === sdfConn.sourceNodeId);
  const sourceSpec = nodeSpecs.get(sourceNode?.type ?? '');
  if (!sourceNode || !sourceSpec) {
    return `float ${funcName}(vec3 p) {\n  return 1000.0;\n}`;
  }
  const body = getOutputExpressionAtPosition(
    sourceNode,
    sourceSpec,
    'p',
    uniformNames,
    functionNameMap,
    graph,
    variableNames,
    nodeSpecs,
    generateParameterCombination,
    escapeRegex
  );
  return `float ${funcName}(vec3 p) {\n  return ${body};\n}`;
}

/**
 * Get replacement strings for $sdf_call and $displacement_at_p in generic-raymarcher mainCode.
 */
export function getGenericRaymarcherReplacements(
  node: NodeInstance,
  graph: NodeGraph,
  variableNames: Map<string, Map<string, string>>,
  uniformNames: Map<string, string>,
  functionNameMap: Map<string, Map<string, string>>,
  nodeSpecs: Map<string, NodeSpec>,
  generateParameterCombination: (
    configValue: string,
    inputValue: string,
    mode: 'override' | 'add' | 'subtract' | 'multiply',
    paramType: 'float' | 'int'
  ) => string,
  escapeRegex: (str: string) => string
): { sdfCall: string; displacementAtP: string } {
  const funcName = `generic_raymarcher_sdf_${sanitizeIdForGlsl(node.id)}`;
  const sdfCall = `${funcName}(posDisplaced)`;

  const dispConn = graph.connections.find(
    (c) => c.targetNodeId === node.id && c.targetPort === 'displacement'
  );
  if (!dispConn) {
    return { sdfCall, displacementAtP: 'vec3(0.0)' };
  }
  const sourceNode = graph.nodes.find((n) => n.id === dispConn.sourceNodeId);
  const sourceSpec = nodeSpecs.get(sourceNode?.type ?? '');
  if (!sourceNode || !sourceSpec) {
    return { sdfCall, displacementAtP: 'vec3(0.0)' };
  }
  const displacementAtP = getOutputExpressionAtPosition(
    sourceNode,
    sourceSpec,
    'pos',
    uniformNames,
    functionNameMap,
    graph,
    variableNames,
    nodeSpecs,
    generateParameterCombination,
    escapeRegex
  );
  return { sdfCall, displacementAtP };
}
