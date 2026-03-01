/**
 * Shared types for validation (node/connection/graph).
 * Split out to avoid circular imports when splitting validation.ts.
 */

import type { ParameterValue } from './types';

export interface NodeSpecification {
  id: string;
  inputs?: Array<{ name: string; type: string }>;
  outputs?: Array<{ name: string; type: string }>;
  parameters?: Record<string, {
    type: 'float' | 'int' | 'string' | 'vec4' | 'array';
    default?: ParameterValue;
    min?: number;
    max?: number;
    required?: boolean;
  }>;
}
