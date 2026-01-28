/**
 * Parameter Handling Utilities
 * 
 * Shared utilities for parameter validation, type conversion, and value handling.
 * Consolidates parameter handling patterns used across the codebase.
 */

import { coerceParameterValue, clampParameterValue } from '../data-model/utils';
import type { ParameterValue } from '../data-model/types';
import type { ParameterSpec } from '../types/nodeSpec';

/**
 * Validate a parameter value against its specification
 * 
 * @param value - Parameter value to validate
 * @param paramSpec - Parameter specification
 * @returns true if value is valid, false otherwise
 */
export function validateParameterValue(
  value: ParameterValue,
  paramSpec: ParameterSpec | undefined
): boolean {
  if (!paramSpec) return false;

  switch (paramSpec.type) {
    case 'float':
    case 'int':
      return typeof value === 'number';
    case 'string':
      return typeof value === 'string';
    case 'vec4':
      return (
        Array.isArray(value) &&
        value.length === 4 &&
        value.every(v => typeof v === 'number')
      );
    case 'array':
      return Array.isArray(value) && value.every(v => typeof v === 'number');
    default:
      return false;
  }
}

/**
 * Coerce and validate a parameter value
 * 
 * @param value - Value to coerce
 * @param paramSpec - Parameter specification
 * @returns Coerced and validated parameter value
 */
export function coerceAndValidateParameterValue(
  value: unknown,
  paramSpec: ParameterSpec
): ParameterValue {
  // First coerce to the correct type
  const coerced = coerceParameterValue(value, paramSpec.type);
  
  // Then clamp if min/max are specified
  if (paramSpec.type === 'float' || paramSpec.type === 'int') {
    if (typeof coerced === 'number') {
      return clampParameterValue(
        coerced,
        paramSpec.min,
        paramSpec.max
      ) as ParameterValue;
    }
  }
  
  return coerced;
}

/**
 * Get parameter value with default fallback
 * 
 * @param value - Parameter value (may be undefined)
 * @param paramSpec - Parameter specification
 * @returns Parameter value or default value
 */
export function getParameterValueWithDefault(
  value: ParameterValue | undefined,
  paramSpec: ParameterSpec
): ParameterValue {
  if (value !== undefined) {
    // Convert NodeSpec ParameterValue to data-model ParameterValue if needed
    return value as ParameterValue;
  }
  const defaultValue = paramSpec.default ?? getDefaultValueForType(paramSpec.type);
  return defaultValue as ParameterValue;
}

/**
 * Get default value for a parameter type
 * 
 * @param type - Parameter type
 * @returns Default value for the type
 */
export function getDefaultValueForType(
  type: 'float' | 'int' | 'string' | 'vec4' | 'array'
): ParameterValue {
  switch (type) {
    case 'float':
      return 0.0;
    case 'int':
      return 0;
    case 'string':
      return '';
    case 'vec4':
      return [0, 0, 0, 0];
    case 'array':
      return [];
    default:
      return 0.0;
  }
}

/**
 * Check if a parameter value is within valid range
 * 
 * @param value - Parameter value
 * @param paramSpec - Parameter specification
 * @returns true if value is within range (or no range specified)
 */
export function isParameterValueInRange(
  value: ParameterValue,
  paramSpec: ParameterSpec
): boolean {
  if (paramSpec.type !== 'float' && paramSpec.type !== 'int') {
    return true; // Range only applies to numeric types
  }
  
  if (typeof value !== 'number') {
    return false;
  }
  
  if (paramSpec.min !== undefined && value < paramSpec.min) {
    return false;
  }
  
  if (paramSpec.max !== undefined && value > paramSpec.max) {
    return false;
  }
  
  return true;
}

/**
 * Normalize a parameter value to a 0-1 range (for UI sliders, etc.)
 * 
 * @param value - Parameter value
 * @param paramSpec - Parameter specification
 * @returns Normalized value (0-1) or null if normalization not applicable
 */
export function normalizeParameterValue(
  value: ParameterValue,
  paramSpec: ParameterSpec
): number | null {
  if (paramSpec.type !== 'float' && paramSpec.type !== 'int') {
    return null;
  }
  
  if (typeof value !== 'number') {
    return null;
  }
  
  const min = paramSpec.min ?? 0;
  const max = paramSpec.max ?? 1;
  const range = max - min;
  
  if (range === 0) {
    return 0;
  }
  
  return (value - min) / range;
}

/**
 * Denormalize a normalized value (0-1) back to parameter range
 * 
 * @param normalized - Normalized value (0-1)
 * @param paramSpec - Parameter specification
 * @returns Denormalized parameter value
 */
export function denormalizeParameterValue(
  normalized: number,
  paramSpec: ParameterSpec
): ParameterValue {
  if (paramSpec.type !== 'float' && paramSpec.type !== 'int') {
    return getDefaultValueForType(paramSpec.type);
  }
  
  const min = paramSpec.min ?? 0;
  const max = paramSpec.max ?? 1;
  const range = max - min;
  
  const value = min + normalized * range;
  
  if (paramSpec.type === 'int') {
    return Math.round(value);
  }
  
  return value;
}
