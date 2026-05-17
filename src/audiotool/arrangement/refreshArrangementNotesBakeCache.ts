import type { NodeGraph } from '../../data-model/types';
import type { ArrangementSnapshot } from './types';
import { clearArrangementNotesBakeCache, setArrangementNotesBakeCache } from './arrangementNotesBakeCache';
import { filterNotesForNode } from '../../shaders/arrangement/packArrangementNotesForGlsl';

/** Rebuild preview note index cache on the main thread (worker compile does not share module state). */
export function refreshArrangementNotesBakeCacheFromGraph(
  graph: NodeGraph | null | undefined,
  snapshot: ArrangementSnapshot | undefined
): void {
  clearArrangementNotesBakeCache();
  if (!graph?.nodes?.length || !snapshot?.notes?.length) return;

  for (const node of graph.nodes) {
    if (node.type !== 'arrangement-notes') continue;
    const packed = filterNotesForNode(snapshot, node);
    setArrangementNotesBakeCache(node.id, packed.notes);
  }
}
