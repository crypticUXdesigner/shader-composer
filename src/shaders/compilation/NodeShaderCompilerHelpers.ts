import type { NodeGraph } from '../../data-model/types';
import type { NodeSpec } from '../../types/nodeSpec';
import type { ParameterValue } from '../../types/nodeSpec';

/**
 * Helper functions used by NodeShaderCompiler and passed to compilation components.
 * Extracted to keep NodeShaderCompiler under ~450 lines.
 */

export function audioNodesFirst(sorted: string[], _graph: NodeGraph): string[] {
  return sorted;
}

export function isAudioNode(nodeSpec: NodeSpec): boolean {
  return nodeSpec.category === 'Audio';
}

export function getParameterDefaultValue(
  paramSpec: { type: string; default?: ParameterValue },
  _paramName: string
): number | [number, number] | [number, number, number] | [number, number, number, number] {
  const def = paramSpec.default;
  if (def !== undefined) {
    if (typeof def === 'number') return def;
    if (Array.isArray(def)) {
      if (def.length === 2) return [def[0], def[1]] as [number, number];
      if (def.length === 3) return [def[0], def[1], def[2]] as [number, number, number];
      if (def.length === 4) return def as [number, number, number, number];
      return def as [number, number, number, number];
    }
  }
  if (paramSpec.type === 'int') return 0;
  if (paramSpec.type === 'vec2') return [0, 0];
  if (paramSpec.type === 'vec3') return [0, 0, 0];
  if (paramSpec.type === 'vec4') return [0, 0, 0, 0];
  return 0.0;
}

export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function normalizeSwizzlePattern(pattern: string): string | null {
  if (!pattern || typeof pattern !== 'string') return null;
  let normalized = pattern.toLowerCase();
  normalized = normalized.replace(/r/g, 'x');
  normalized = normalized.replace(/g/g, 'y');
  normalized = normalized.replace(/b/g, 'z');
  normalized = normalized.replace(/a/g, 'w');
  if (!/^[xyzw]{1,4}$/.test(normalized)) return null;
  return normalized;
}

export function generateParameterCombination(
  configValue: string,
  inputValue: string,
  mode: 'override' | 'add' | 'subtract' | 'multiply',
  _paramType: 'float' | 'int' = 'float'
): string {
  if (mode === 'override') return inputValue;
  switch (mode) {
    case 'add': return `(${configValue} + ${inputValue})`;
    case 'subtract': return `(${configValue} - ${inputValue})`;
    case 'multiply': return `(${configValue} * ${inputValue})`;
    default: return inputValue;
  }
}

export function generateSwizzleCode(
  code: string,
  swizzleValue: string,
  inputVars: Map<string, string>,
  outputVars: Map<string, string>,
  escapeRegexFn: (str: string) => string,
  normalizeSwizzlePatternFn: (pattern: string) => string | null
): string {
  const inputVar = inputVars.get('in') || 'vec4(0.0)';
  const outputVar = outputVars.get('out') || 'vec4(0.0)';
  const escapedOutputVar = escapeRegexFn(outputVar);
  const normalized = normalizeSwizzlePatternFn(swizzleValue);
  if (!normalized) {
    const passThroughRegex = new RegExp(`vec4\\s+v\\s*=\\s*[^;]+;[\\s\\S]*?if\\s*\\([^)]+\\)[\\s\\S]*?else\\s*\\{[\\s\\S]*?${escapedOutputVar}\\s*=\\s*v;[\\s\\S]*?\\}`);
    return code.replace(passThroughRegex, `${outputVar} = ${inputVar};`);
  }
  let swizzleExpr: string;
  const pattern = normalized.toLowerCase();
  if (pattern.length === 2) swizzleExpr = `vec4(${inputVar}.${pattern}, 0.0, 1.0)`;
  else if (pattern.length === 3) swizzleExpr = `vec4(${inputVar}.${pattern}, 1.0)`;
  else if (pattern.length === 4) swizzleExpr = `${inputVar}.${pattern}`;
  else swizzleExpr = inputVar;
  const swizzleBlockRegex = new RegExp(
    `vec4\\s+v\\s*=\\s*[^;]+;[\\s\\S]*?if\\s*\\([^)]+\\)[\\s\\S]*?(?:else\\s+if\\s*\\([^)]+\\)[\\s\\S]*?)*else\\s*\\{[\\s\\S]*?${escapedOutputVar}\\s*=\\s*v;[\\s\\S]*?\\}`
  );
  const result = code.replace(swizzleBlockRegex, `${outputVar} = ${swizzleExpr};`);
  if (result === code) return code.replace(/\$param\.swizzle/g, '""');
  return result;
}
