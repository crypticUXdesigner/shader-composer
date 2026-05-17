import type { PackedArrangementNote } from '../../shaders/arrangement/packArrangementNotesForGlsl';

const bakeByNodeId = new Map<string, readonly PackedArrangementNote[]>();

export function clearArrangementNotesBakeCache(): void {
  bakeByNodeId.clear();
}

export function setArrangementNotesBakeCache(
  nodeId: string,
  notes: readonly PackedArrangementNote[]
): void {
  bakeByNodeId.set(nodeId, notes);
}

export function getArrangementNotesBakeCache(
  nodeId: string
): readonly PackedArrangementNote[] | undefined {
  return bakeByNodeId.get(nodeId);
}
