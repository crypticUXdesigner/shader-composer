import type { NodeInstance } from '../data-model/types';
import type { NodeSpec } from '../types/nodeSpec';

function resolveStoredNumber(parameter: string, node: NodeInstance, spec: NodeSpec): number {
  const raw = node.parameters[parameter];
  const def = spec.parameters[parameter]?.default;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof def === 'number' && Number.isFinite(def)) return def;
  return 0;
}

export type ParameterVisibilityClause = {
  parameter: string;
  equals: number | number[];
};

/**
 * Grid layout sections (`GridElement.visibleWhen`) show only when the controlling
 * parameter equals the given number (stored node value or spec default).
 */
export function layoutSectionVisible(
  clause: { parameter: string; equals: number } | undefined,
  node: NodeInstance,
  spec: NodeSpec
): boolean {
  if (!clause) return true;
  return layoutParameterVisible(clause, node, spec);
}

/**
 * Per-parameter visibility inside a grid (`GridElement.parameterVisibleWhen`).
 */
export function layoutParameterVisible(
  clause: ParameterVisibilityClause | undefined,
  node: NodeInstance,
  spec: NodeSpec
): boolean {
  if (!clause) return true;
  const value = resolveStoredNumber(clause.parameter, node, spec);
  if (Array.isArray(clause.equals)) return clause.equals.includes(value);
  return value === clause.equals;
}
