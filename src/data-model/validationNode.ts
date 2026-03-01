/**
 * Node-level validation. Extracted from validation.ts for smaller module size.
 */

import type { NodeInstance, ParameterValue } from './types';
import type { NodeSpecification } from './validationTypes';

function validateParameterValue(
  value: ParameterValue,
  paramSpec: { type: string; default?: ParameterValue; min?: number; max?: number; required?: boolean } | undefined
): boolean {
  if (!paramSpec) return false;
  switch (paramSpec.type) {
    case 'float':
    case 'int':
      return typeof value === 'number';
    case 'string':
      return typeof value === 'string';
    case 'vec4':
      return Array.isArray(value) && value.length === 4 && value.every(v => typeof v === 'number');
    case 'array':
      return Array.isArray(value) && value.every(v => typeof v === 'number');
    default:
      return false;
  }
}

/**
 * Validates a single node instance.
 */
export function validateNode(
  node: NodeInstance,
  nodeSpecs: NodeSpecification[],
  errors: string[],
  warnings: string[]
): void {
  if (!node.id) {
    errors.push(`Node missing id`);
    return;
  }
  if (!node.type) {
    errors.push(`Node ${node.id} missing type`);
    return;
  }
  if (!node.position) {
    errors.push(`Node ${node.id} missing position`);
    return;
  }
  if (node.parameters === undefined) {
    errors.push(`Node ${node.id} missing parameters`);
    return;
  }
  if (typeof node.position.x !== 'number' || typeof node.position.y !== 'number') {
    errors.push(`Node ${node.id} has invalid position`);
  }
  const nodeSpec = nodeSpecs.find(spec => spec.id === node.type);
  if (!nodeSpec) {
    errors.push(`Node ${node.id} has unknown node type: ${node.type}`);
    return;
  }
  if (nodeSpec.parameters) {
    for (const paramName of Object.keys(node.parameters)) {
      if (!(paramName in nodeSpec.parameters)) {
        warnings.push(`Node ${node.id} (${node.type}) has unknown parameter: ${paramName}`);
        continue;
      }
      const paramSpec = nodeSpec.parameters[paramName];
      if (!paramSpec) continue;
      const paramValue = node.parameters[paramName];
      if (!validateParameterValue(paramValue, paramSpec)) {
        errors.push(`Node ${node.id} (${node.type}) has invalid parameter value type for: ${paramName}`);
        continue;
      }
      if (typeof paramValue === 'number') {
        if (paramSpec.min !== undefined && paramValue < paramSpec.min) {
          errors.push(`Node ${node.id} (${node.type}) parameter ${paramName} is out of range: ${paramValue} < ${paramSpec.min}`);
        }
        if (paramSpec.max !== undefined && paramValue > paramSpec.max) {
          errors.push(`Node ${node.id} (${node.type}) parameter ${paramName} is out of range: ${paramValue} > ${paramSpec.max}`);
        }
      }
    }
    for (const [paramName, paramSpec] of Object.entries(nodeSpec.parameters)) {
      if (paramSpec.required && !(paramName in node.parameters)) {
        errors.push(`Node ${node.id} (${node.type}) is missing required parameter: ${paramName}`);
      }
    }
  }
  if (node.color !== undefined) {
    const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;
    if (!hexColorRegex.test(node.color)) {
      errors.push(`Node ${node.id} has invalid color format: ${node.color}`);
    }
  }
}
