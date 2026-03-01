/**
 * Orphan audio/analyzer node cleanup.
 * Extracted from AudioManager.cleanupOrphanedResources for smaller module size.
 */

export interface OrphanCleanupResult {
  orphanedAudioNodes: string[];
  orphanedAnalyzerNodes: string[];
}

/**
 * Find audio and analyzer node IDs that are not in validNodeIds.
 * Caller is responsible for logging and invoking removal.
 */
export function findOrphanedNodes(
  validNodeIds: Set<string>,
  getAllAudioNodeIds: () => Iterable<string>,
  getAllAnalyzerNodeIds: () => Iterable<string>
): OrphanCleanupResult {
  const orphanedAudioNodes: string[] = [];
  for (const nodeId of getAllAudioNodeIds()) {
    if (!validNodeIds.has(nodeId)) orphanedAudioNodes.push(nodeId);
  }
  const orphanedAnalyzerNodes: string[] = [];
  for (const nodeId of getAllAnalyzerNodeIds()) {
    if (!validNodeIds.has(nodeId)) orphanedAnalyzerNodes.push(nodeId);
  }
  return { orphanedAudioNodes, orphanedAnalyzerNodes };
}
