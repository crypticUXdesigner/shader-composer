import type { NodeGraph, NodeInstance } from '../../data-model/types';
import type { NodeSpec } from '../../types/nodeSpec';
import { formatParamLiteralForGlsl } from './MainCodeGeneratorUtils';
import { sanitizeAutomationLaneId } from './MainCodeGeneratorOutput';

export type PlaceholderContext = {
  escapeRegex: (str: string) => string;
  generateArrayVariableName: (nodeId: string, paramName: string) => string;
  generateParameterCombination: (
    configValue: string,
    inputValue: string,
    mode: 'override' | 'add' | 'subtract' | 'multiply',
    paramType: 'float' | 'int'
  ) => string;
  generateSwizzleCode: (
    code: string,
    swizzleValue: string,
    inputVars: Map<string, string>,
    outputVars: Map<string, string>
  ) => string;
};

/**
 * Replace placeholders in node mainCode ($input, $output, $param, $time, $resolution, $p).
 */
export function replacePlaceholders(
  code: string,
  node: NodeInstance,
  nodeSpec: NodeSpec,
  inputVars: Map<string, string>,
  outputVars: Map<string, string>,
  uniformNames: Map<string, string>,
  ctx: PlaceholderContext,
  parameterInputVars: Map<string, string> = new Map(),
  graph?: NodeGraph
): string {
  let result = code;

  for (const [portName, varName] of inputVars.entries()) {
    const regex = new RegExp(`\\$input\\.${ctx.escapeRegex(portName)}`, 'g');
    result = result.replace(regex, varName);
  }

  for (const [portName, varName] of outputVars.entries()) {
    const regex = new RegExp(`\\$output\\.${ctx.escapeRegex(portName)}`, 'g');
    result = result.replace(regex, varName);
  }

  const allParamNames = new Set([
    ...Object.keys(node.parameters),
    ...Object.keys(nodeSpec.parameters)
  ]);
  for (const paramName of allParamNames) {
    const paramSpec = nodeSpec.parameters[paramName];

    if (paramSpec?.type === 'array') {
      const arrayValue = node.parameters[paramName] as number[] | undefined;
      if (Array.isArray(arrayValue) && arrayValue.length > 0) {
        const arrayVarName = ctx.generateArrayVariableName(node.id, paramName);
        const arrayAccessRegex = new RegExp(
          `\\$param\\.${ctx.escapeRegex(paramName)}\\[([^\\]]+)\\]`,
          'g'
        );
        result = result.replace(arrayAccessRegex, `${arrayVarName}[$1]`);
        const simpleRegex = new RegExp(`\\$param\\.${ctx.escapeRegex(paramName)}\\b`, 'g');
        result = result.replace(simpleRegex, arrayVarName);
      }
    } else if (paramSpec?.type === 'string') {
      if (nodeSpec.id === 'swizzle' && paramName === 'swizzle') {
        const swizzleValue = (node.parameters[paramName] as string | undefined) ||
          (paramSpec.default as string | undefined) || 'xyzw';
        result = ctx.generateSwizzleCode(result, swizzleValue, inputVars, outputVars);
      } else {
        const regex = new RegExp(`\\$param\\.${ctx.escapeRegex(paramName)}\\b`, 'g');
        result = result.replace(regex, '""');
      }
    } else {
      if (graph?.automation?.lanes && paramSpec?.type === 'float') {
        const lane = graph.automation.lanes.find(
          (l) => l.nodeId === node.id && l.paramName === paramName
        );
        if (lane) {
          const expr = `evalAutomation_${sanitizeAutomationLaneId(lane.id)}(uTimelineTime)`;
          const regex = new RegExp(`\\$param\\.${ctx.escapeRegex(paramName)}\\b`, 'g');
          result = result.replace(regex, expr);
          continue;
        }
      }
      const paramInputVar = parameterInputVars.get(paramName);
      if (paramInputVar) {
        const inputMode = node.parameterInputModes?.[paramName] || paramSpec?.inputMode || 'override';
        if (inputMode === 'override') {
          const regex = new RegExp(`\\$param\\.${ctx.escapeRegex(paramName)}\\b`, 'g');
          result = result.replace(regex, paramInputVar);
        } else {
          const uniformName = uniformNames.get(`${node.id}.${paramName}`) || '';
          let configValue: string;
          if (uniformName) {
            configValue = uniformName;
          } else {
            const paramValue = node.parameters[paramName];
            configValue = paramValue !== undefined ? String(paramValue) : (paramSpec?.default !== undefined ? String(paramSpec.default) : (paramSpec?.type === 'int' ? '0' : '0.0'));
          }
          const paramType = (paramSpec?.type === 'float' || paramSpec?.type === 'int') ? paramSpec.type : 'float';
          const combinedExpr = ctx.generateParameterCombination(configValue, paramInputVar, inputMode, paramType);
          const regex = new RegExp(`\\$param\\.${ctx.escapeRegex(paramName)}\\b`, 'g');
          result = result.replace(regex, combinedExpr);
        }
      } else {
        const uniformName = uniformNames.get(`${node.id}.${paramName}`) || '';
        if (uniformName) {
          const regex = new RegExp(`\\$param\\.${ctx.escapeRegex(paramName)}\\b`, 'g');
          result = result.replace(regex, uniformName);
        } else if (paramSpec) {
          const rawDefault: number = paramSpec.default !== undefined && typeof paramSpec.default === 'number'
            ? paramSpec.default
            : (paramSpec.type === 'int' ? 0 : 0.0);
          const defaultValue = formatParamLiteralForGlsl(rawDefault, paramSpec);
          const regex = new RegExp(`\\$param\\.${ctx.escapeRegex(paramName)}\\b`, 'g');
          result = result.replace(regex, defaultValue);
        } else {
          const paramValue = node.parameters[paramName];
          if (paramValue !== undefined && typeof paramValue === 'number') {
            const valueStr = formatParamLiteralForGlsl(paramValue, undefined);
            const regex = new RegExp(`\\$param\\.${ctx.escapeRegex(paramName)}\\b`, 'g');
            result = result.replace(regex, valueStr);
          } else {
            const regex = new RegExp(`\\$param\\.${ctx.escapeRegex(paramName)}\\b`, 'g');
            result = result.replace(regex, '0.0');
          }
        }
      }
    }
  }

  result = result.replace(/\$param\.\w+/g, (match) => {
    const paramName = match.replace('$param.', '');
    const paramSpec = nodeSpec.parameters[paramName];
    const uniformName = uniformNames.get(`${node.id}.${paramName}`);
    if (paramSpec?.type === 'int' && uniformName) return uniformName;
    const paramValue = node.parameters[paramName];
    if (paramValue !== undefined && typeof paramValue === 'number') {
      return formatParamLiteralForGlsl(paramValue, paramSpec);
    }
    return paramSpec?.type === 'int' ? '0' : '0.0';
  });

  result = result.replace(/\$time/g, 'uTime');
  result = result.replace(/\$resolution/g, 'uResolution');
  result = result.replace(/\$p/g, 'p');

  return result;
}
