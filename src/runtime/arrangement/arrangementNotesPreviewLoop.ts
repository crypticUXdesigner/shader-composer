/**
 * Preview: updates arrangement-notes `noteLoopStart` / `noteLoopEnd` uniforms each frame so the
 * shader only scans notes overlapping the current timeline window (scrub-safe).
 */

import type { AudioSetup } from '../../data-model/audioSetupTypes';
import type { NodeGraph, NodeInstance } from '../../data-model/types';
import {
  arrangementNotesVisibleTimeWindow,
  clampNoteLoopRangeForPreviewBudget,
  findNoteIndexRangeForWindow,
  resolveArrangementNotesPreviewLoopBudget,
} from '../../audiotool/arrangement/arrangementNotesVisibleRange';
import { getArrangementNotesBakeCache } from '../../audiotool/arrangement/arrangementNotesBakeCache';
import { filterNotesForNode } from '../../shaders/arrangement/packArrangementNotesForGlsl';
import type { PreviewProgramInstance } from '../types';

/** Matches `arrangement-notes` `windowSeconds` NodeSpec max. */
const MAX_WINDOW_SECONDS = 100;

function readWindowSeconds(parameters: Record<string, unknown> | undefined): number {
  const raw = parameters?.windowSeconds;
  const v = typeof raw === 'number' && Number.isFinite(raw) ? raw : 32;
  return Math.min(MAX_WINDOW_SECONDS, Math.max(0.5, v));
}

function readTimelineAnchor(parameters: Record<string, unknown> | undefined): number {
  const raw = parameters?.timelineAnchor;
  return Number(raw) === 1 ? 1 : 0;
}

function bakedNotesForNode(node: NodeInstance, snapshot: NonNullable<AudioSetup['arrangementSnapshot']>) {
  return getArrangementNotesBakeCache(node.id) ?? filterNotesForNode(snapshot, node).notes;
}

export function applyArrangementNotesLoopUniforms(args: {
  graph: NodeGraph | null | undefined;
  shaderInstance: PreviewProgramInstance | null | undefined;
  timelineTime: number;
  audioSetup?: AudioSetup | null;
}): void {
  const { graph, shaderInstance, timelineTime, audioSetup } = args;
  if (!graph?.nodes?.length || !shaderInstance || !Number.isFinite(timelineTime)) {
    return;
  }

  const snapshot = audioSetup?.arrangementSnapshot;

  for (const node of graph.nodes) {
    if (node.type !== 'arrangement-notes') continue;

    const baked = snapshot ? bakedNotesForNode(node, snapshot) : getArrangementNotesBakeCache(node.id);
    if (!baked?.length) {
      shaderInstance.setParameter(node.id, 'noteLoopStart', 0);
      shaderInstance.setParameter(node.id, 'noteLoopEnd', 0);
      continue;
    }

    const { windowStart, windowEnd } = arrangementNotesVisibleTimeWindow(
      timelineTime,
      readWindowSeconds(node.parameters),
      readTimelineAnchor(node.parameters)
    );
    const windowRange = findNoteIndexRangeForWindow(baked, windowStart, windowEnd);
    const loopBudget = resolveArrangementNotesPreviewLoopBudget(baked.length);
    const { start, end } = clampNoteLoopRangeForPreviewBudget(
      baked,
      windowRange,
      timelineTime,
      loopBudget
    );
    shaderInstance.setParameter(node.id, 'noteLoopStart', start);
    shaderInstance.setParameter(node.id, 'noteLoopEnd', end);
  }
}
