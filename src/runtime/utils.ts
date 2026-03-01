/**
 * Runtime Utility Functions
 * 
 * Uniform name mapping function that matches the compiler's naming convention.
 */

/**
 * Generate uniform name from node ID and parameter name.
 * This matches the compiler's sanitizeUniformName function exactly.
 * 
 * @param nodeId - Node ID (e.g., "node-123")
 * @param paramName - Parameter name (e.g., "scale")
 * @returns Uniform name (e.g., "uNode_123Scale")
 */
export function getUniformName(nodeId: string, paramName: string): string {
  // Sanitize node ID: replace non-alphanumeric with underscore
  let sanitizedId = nodeId.replace(/[^a-zA-Z0-9]/g, '_');
  
  // If starts with digit, prefix with 'n'
  if (/^\d/.test(sanitizedId)) {
    sanitizedId = 'n' + sanitizedId;
  }
  
  // Sanitize parameter name: remove non-alphanumeric, capitalize first letter
  let sanitizedParam = paramName.replace(/[^a-zA-Z0-9]/g, '');
  sanitizedParam = sanitizedParam.charAt(0).toUpperCase() + sanitizedParam.slice(1);
  
  return `u${sanitizedId}${sanitizedParam}`;
}

/**
 * Hash a graph structure to detect changes.
 * Includes automation so that adding/editing lanes or curves triggers recompile (shader uses evalAutomation_*).
 */
export function hashGraph(graph: import('../data-model/types').NodeGraph): string {
  const nodeIds = graph.nodes.map(n => n.id).sort().join(',');
  const connectionIds = graph.connections.map(c => c.id).sort().join(',');
  const connections = graph.connections
    .map(c => `${c.sourceNodeId}:${c.sourcePort}->${c.targetNodeId}:${c.targetPort ?? ''}:${c.targetParameter ?? ''}`)
    .sort()
    .join(',');
  const automation =
    graph.automation == null
      ? ''
      : JSON.stringify({
          bpm: graph.automation.bpm,
          durationSeconds: graph.automation.durationSeconds,
          lanes: (graph.automation.lanes ?? []).map((l) => ({
            id: l.id,
            nodeId: l.nodeId,
            paramName: l.paramName,
            regions: (l.regions ?? []).map((r) => ({
              id: r.id,
              startTime: r.startTime,
              duration: r.duration,
              loop: r.loop,
              curve: r.curve,
            })),
          })),
        });
  return `${nodeIds}|${connectionIds}|${connections}|${automation}`;
}
