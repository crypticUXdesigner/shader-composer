import type { AutomationRegion } from '../../../data-model/types';
import { snapToGrid, snapToGridAvoidZero } from '../../../utils/timelineSnap';
import { getTimeFromClientXInRect, type TimelineTransformParams } from './timelineMath';

export type RegionEdge = 'left' | 'right';

export interface RegionSelectionKey {
  laneId: string;
  regionId: string;
}

export interface RegionDragState {
  laneId: string;
  regionId: string;
  /** Proposed startTime while dragging (in seconds). */
  startTime: number;
  /** Time offset from cursor to region start (cursorTime - region.startTime) so region sticks to cursor. */
  gripOffset: number;
  /** When true, the original should NOT move (duplicate will be created on commit). */
  isDuplicate: boolean;
  /** Lane receiving the duplicate on drop (copy-drag); equals laneId for in-lane move. */
  targetLaneId: string;
}

export interface RegionResizeState {
  laneId: string;
  regionId: string;
  edge: RegionEdge;
  startX: number;
  startTime: number;
  startDuration: number;
}

export interface DragUpdateParams {
  cursorTime: number;
  region: Pick<AutomationRegion, 'duration'>;
  durationMax: number;
  gripOffset: number;
  snapEnabled: boolean;
  snapStartTime: (t: number) => number;
}

export function computeDraggedStartTime(params: DragUpdateParams): number {
  const { cursorTime, region, durationMax, gripOffset, snapEnabled, snapStartTime } = params;
  const maxStart = Math.max(0, durationMax - region.duration);
  let newStart = cursorTime - gripOffset;
  newStart = Math.max(0, Math.min(maxStart, newStart));
  if (snapEnabled) {
    newStart = snapStartTime(newStart);
    newStart = Math.max(0, Math.min(maxStart, newStart));
  }
  return newStart;
}

export interface ResizeUpdateParams {
  edge: RegionEdge;
  startTime: number;
  startDuration: number;
  dt: number;
  durationMax: number;
  minDuration: number;
  snapEnabled: boolean;
  /** Apply snapping for startTime only (left edge). */
  snapStartTime: (t: number) => number;
}

export function computeResizedRegion(params: ResizeUpdateParams): { startTime: number; duration: number } {
  const {
    edge,
    startTime,
    startDuration,
    dt,
    durationMax,
    minDuration,
    snapEnabled,
    snapStartTime,
  } = params;

  let newStart = startTime;
  let newDuration = startDuration;

  if (edge === 'left') {
    newStart = Math.max(0, Math.min(startTime + dt, startTime + startDuration - minDuration));
    newDuration = startTime + startDuration - newStart;

    if (snapEnabled) {
      newStart = snapStartTime(newStart);
      newStart = Math.max(0, Math.min(newStart, startTime + startDuration - minDuration));
      newDuration = startTime + startDuration - newStart;
    }
  } else {
    let newEnd = Math.max(startTime + minDuration, Math.min(durationMax, startTime + startDuration + dt));
    if (snapEnabled) {
      newEnd = snapStartTime(newEnd);
      newEnd = Math.max(startTime + minDuration, Math.min(durationMax, newEnd));
    }
    newDuration = newEnd - startTime;
  }

  return { startTime: newStart, duration: newDuration };
}

export function createRegionDragState(args: {
  laneId: string;
  regionId: string;
  regionStartTime: number;
  cursorTime: number;
  isDuplicate: boolean;
}): RegionDragState {
  return {
    laneId: args.laneId,
    regionId: args.regionId,
    startTime: args.regionStartTime,
    gripOffset: args.cursorTime - args.regionStartTime,
    isDuplicate: args.isDuplicate,
    targetLaneId: args.laneId,
  };
}

/** Lane track under the pointer within the timeline lanes container (for cross-lane copy-drag). */
export function resolveLaneIdAtClientPoint(
  clientX: number,
  clientY: number,
  lanesContainer: HTMLElement | null
): string | null {
  if (!lanesContainer) return null;
  const stack = document.elementsFromPoint(clientX, clientY);
  for (const el of stack) {
    if (typeof (el as Element | null)?.closest !== 'function') continue;
    const track = el.closest('.track[data-lane-id]');
    if (track && lanesContainer.contains(track)) {
      return track.getAttribute('data-lane-id');
    }
  }
  return null;
}

export function createRegionResizeState(args: {
  laneId: string;
  regionId: string;
  edge: RegionEdge;
  startX: number;
  regionStartTime: number;
  regionDuration: number;
}): RegionResizeState {
  return {
    laneId: args.laneId,
    regionId: args.regionId,
    edge: args.edge,
    startX: args.startX,
    startTime: args.regionStartTime,
    startDuration: args.regionDuration,
  };
}

export function updateRegionDragTime(args: {
  cursorTime: number;
  gripOffset: number;
  duration: number;
  regionDuration: number;
  snapEnabled: boolean;
  bpm: number;
  snapGridBars: number;
}): number {
  return computeDraggedStartTime({
    cursorTime: args.cursorTime,
    region: { duration: args.regionDuration },
    durationMax: args.duration,
    gripOffset: args.gripOffset,
    snapEnabled: args.snapEnabled,
    snapStartTime: (t) => snapToGridAvoidZero(t, args.bpm, args.snapGridBars),
  });
}

export function computeResizeFromMouseDelta(args: {
  edge: RegionEdge;
  startTime: number;
  startDuration: number;
  dxPx: number;
  secondsPerPx: number;
  durationMax: number;
  minDuration: number;
  snapEnabled: boolean;
  bpm: number;
  snapGridBars: number;
}): { startTime: number; duration: number } {
  return computeResizedRegion({
    edge: args.edge,
    startTime: args.startTime,
    startDuration: args.startDuration,
    dt: args.dxPx * args.secondsPerPx,
    durationMax: args.durationMax,
    minDuration: args.minDuration,
    snapEnabled: args.snapEnabled,
    snapStartTime: (t) => snapToGridAvoidZero(t, args.bpm, args.snapGridBars),
  });
}

export function computeDuplicateDropStart(args: {
  clientX: number;
  trackRect: DOMRect;
  math: TimelineTransformParams;
  snapEnabled: boolean;
  bpm: number;
  snapGridBars: number;
}): number {
  let start = getTimeFromClientXInRect(args.clientX, args.trackRect, args.math);
  if (args.snapEnabled) {
    start = snapToGrid(start, args.bpm, args.snapGridBars);
    start = Math.max(0, start);
  }
  return start;
}

