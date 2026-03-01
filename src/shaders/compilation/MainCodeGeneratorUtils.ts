/**
 * Format a numeric parameter value for GLSL (float literals for clamp etc.).
 */
export function formatParamLiteralForGlsl(
  value: number,
  paramSpec?: { type?: string } | null
): string {
  const isFloat = paramSpec?.type !== 'int';
  if (isFloat && typeof value === 'number') {
    return Number.isInteger(value) ? `${value}.0` : String(value);
  }
  return String(Math.round(value));
}

/**
 * Sanitize node id for use in GLSL function names (e.g. generic_raymarcher_sdf_<id>).
 */
export function sanitizeIdForGlsl(nodeId: string): string {
  return nodeId.replace(/[^a-zA-Z0-9_]/g, '_');
}

/**
 * Generate output variable name for a node/port (same convention as VariableNameGenerator).
 */
export function generateOutputVariableName(nodeId: string, portName: string): string {
  const sanitizedId = nodeId.replace(/[^a-zA-Z0-9]/g, '_');
  const sanitizedPort = portName.replace(/[^a-zA-Z0-9]/g, '_');
  return `node_${sanitizedId}_${sanitizedPort}`;
}

/**
 * Get default value for an unconnected input.
 */
export function getInputDefaultValue(type: string): string {
  switch (type) {
    case 'float': return '0.0';
    case 'vec2': return 'vec2(0.0)';
    case 'vec3': return 'vec3(0.0)';
    case 'vec4': return 'vec4(0.0)';
    case 'int': return '0';
    case 'bool': return 'false';
    default: return '0.0';
  }
}
