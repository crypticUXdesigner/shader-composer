import type { Connection, ParameterValue } from '../../data-model/types';

/**
 * Compare two parameter objects efficiently
 * Returns true if parameters are equal (deep comparison)
 */
export function parametersEqual(
  oldParams: Record<string, ParameterValue | unknown>,
  newParams: Record<string, ParameterValue | unknown>
): boolean {
  const oldKeys = Object.keys(oldParams);
  const newKeys = Object.keys(newParams);

  if (oldKeys.length !== newKeys.length) return false;

  for (const key of oldKeys) {
    if (!Object.prototype.hasOwnProperty.call(newParams, key)) return false;

    const oldVal = oldParams[key];
    const newVal = newParams[key];

    if (!valuesEqual(oldVal, newVal)) return false;
  }

  return true;
}

/**
 * Compare two values (handles primitives, arrays, objects)
 */
function valuesEqual(oldVal: unknown, newVal: unknown): boolean {
  // Primitive comparison
  if (oldVal === newVal) return true;

  // Array comparison
  if (Array.isArray(oldVal) && Array.isArray(newVal)) {
    if (oldVal.length !== newVal.length) return false;
    for (let i = 0; i < oldVal.length; i++) {
      if (!valuesEqual(oldVal[i], newVal[i])) return false;
    }
    return true;
  }

  // Object comparison (for nested objects)
  if (typeof oldVal === 'object' && typeof newVal === 'object' &&
      oldVal !== null && newVal !== null &&
      !Array.isArray(oldVal) && !Array.isArray(newVal)) {
    return parametersEqual(
      oldVal as Record<string, ParameterValue | unknown>,
      newVal as Record<string, ParameterValue | unknown>
    );
  }

  return false;
}

/**
 * Compare connection arrays efficiently
 * Returns true if connections are structurally identical
 */
export function connectionsEqual(
  oldConnections: Connection[],
  newConnections: Connection[]
): boolean {
  if (oldConnections.length !== newConnections.length) return false;
  
  // Create sets for fast lookup
  const oldConnSet = new Set(
    oldConnections.map(c => 
      `${c.sourceNodeId}:${c.sourcePort}->${c.targetNodeId}:${c.targetPort}:${c.targetParameter || ''}`
    )
  );
  
  for (const newConn of newConnections) {
    const key = `${newConn.sourceNodeId}:${newConn.sourcePort}->${newConn.targetNodeId}:${newConn.targetPort}:${newConn.targetParameter || ''}`;
    if (!oldConnSet.has(key)) return false;
  }
  
  return true;
}
