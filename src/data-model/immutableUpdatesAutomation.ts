/**
 * Immutable automation updates. Extracted from immutableUpdates.ts for smaller module size.
 */

import type { NodeGraph } from './types';
import type {
  AutomationState,
  AutomationLane,
  AutomationRegion,
  AutomationCurve,
  AutomationKeyframe,
} from './types';
import { sanitizeAutomationCurveKeyframes } from '../utils/automationKeyframes';

function sanitizeAutomationRegionKeyframes(
  keyframes: AutomationKeyframe[]
): AutomationKeyframe[] {
  return sanitizeAutomationCurveKeyframes(keyframes);
}

const DEFAULT_BPM = 120;
const DEFAULT_DURATION_SECONDS = 30;
const MIN_DURATION_SECONDS = 0.001;

/**
 * Resolve overlaps between an updated region and other regions on the lane.
 * Mirrors addAutomationRegion: if our span starts before a neighbor, trim the right edge
 * at the neighbor's start; otherwise push our start after the neighbor.
 * Iterates until stable so chained overlaps resolve.
 */
function resolveUpdatedRegionAgainstOthers(
  lane: AutomationLane,
  selfIndex: number,
  startTime: number,
  duration: number,
  durationMax: number
): { startTime: number; duration: number } {
  let st = startTime;
  let dur = Math.max(MIN_DURATION_SECONDS, duration);

  for (let iter = 0; iter < 128; iter++) {
    let changed = false;
    for (let i = 0; i < lane.regions.length; i++) {
      if (i === selfIndex) continue;
      const r = lane.regions[i];
      const rEnd = r.startTime + r.duration;
      if (st >= rEnd || st + dur <= r.startTime) continue;

      if (st < r.startTime) {
        const newDur = r.startTime - st;
        if (newDur < MIN_DURATION_SECONDS) {
          st = rEnd;
        } else {
          dur = newDur;
        }
      } else {
        st = rEnd;
      }
      dur = Math.max(MIN_DURATION_SECONDS, Math.min(dur, durationMax - st));
      st = Math.max(0, Math.min(st, durationMax - dur));
      changed = true;
    }
    if (!changed) break;
  }

  dur = Math.max(MIN_DURATION_SECONDS, Math.min(dur, durationMax - st));
  st = Math.max(0, Math.min(st, durationMax - dur));
  return { startTime: st, duration: dur };
}

function ensureAutomation(graph: NodeGraph): AutomationState {
  if (graph.automation) return graph.automation;
  return { bpm: DEFAULT_BPM, durationSeconds: DEFAULT_DURATION_SECONDS, lanes: [] };
}

function createDefaultCurve(): AutomationCurve {
  return { keyframes: [{ time: 0, value: 0 }, { time: 1, value: 1 }], interpolation: 'bezier' };
}

export function addAutomationLane(
  graph: NodeGraph,
  lane: { id: string; nodeId: string; paramName: string }
): NodeGraph {
  const automation = ensureAutomation(graph);
  const newLane: AutomationLane = { id: lane.id, nodeId: lane.nodeId, paramName: lane.paramName, regions: [] };
  return {
    ...graph,
    automation: { ...automation, lanes: [...automation.lanes, newLane] },
  };
}

export function addAutomationRegion(
  graph: NodeGraph,
  laneId: string,
  region: Omit<AutomationRegion, 'curve'> & { curve?: AutomationCurve }
): NodeGraph {
  const automation = ensureAutomation(graph);
  const laneIndex = automation.lanes.findIndex((l) => l.id === laneId);
  if (laneIndex === -1) return graph;

  const lane = automation.lanes[laneIndex];
  const curve = region.curve ?? createDefaultCurve();
  const newRegion: AutomationRegion = {
    id: region.id,
    startTime: Math.max(0, region.startTime),
    duration: Math.max(0.001, region.duration),
    loop: region.loop ?? false,
    curve,
  };

  let start = newRegion.startTime;
  let end = start + newRegion.duration;
  const duration = newRegion.duration;
  for (const r of lane.regions) {
    const rEnd = r.startTime + r.duration;
    if (start < rEnd && end > r.startTime) {
      if (start < r.startTime) {
        end = Math.min(end, r.startTime);
        start = Math.max(0, end - duration);
      } else {
        start = rEnd;
        end = start + duration;
      }
    }
  }
  const spanSeconds = Math.max(MIN_DURATION_SECONDS, end - start);
  const baseAutomationDuration = automation.durationSeconds ?? DEFAULT_DURATION_SECONDS;
  const newAutomationDuration = Math.max(baseAutomationDuration, start + spanSeconds);

  const finalRegion: AutomationRegion = {
    ...newRegion,
    startTime: start,
    duration: spanSeconds,
  };

  const newRegions = [...lane.regions, finalRegion].sort((a, b) => a.startTime - b.startTime);
  const newLanes = [...automation.lanes];
  newLanes[laneIndex] = { ...lane, regions: newRegions };

  return {
    ...graph,
    automation: { ...automation, durationSeconds: newAutomationDuration, lanes: newLanes },
  };
}

export function updateAutomationRegion(
  graph: NodeGraph,
  laneId: string,
  regionId: string,
  updates: { startTime?: number; duration?: number; loop?: boolean; curve?: AutomationCurve }
): NodeGraph {
  const automation = ensureAutomation(graph);
  const laneIndex = automation.lanes.findIndex((l) => l.id === laneId);
  if (laneIndex === -1) return graph;

  const lane = automation.lanes[laneIndex];
  const regionIndex = lane.regions.findIndex((r) => r.id === regionId);
  if (regionIndex === -1) return graph;

  const region = lane.regions[regionIndex];
  let startTime = updates.startTime ?? region.startTime;
  let duration = updates.duration ?? region.duration;
  const baseAutomationDuration = automation.durationSeconds ?? DEFAULT_DURATION_SECONDS;
  const requestedEnd = startTime + duration;
  /** Grow the automation timeline so overlap resolution and clamps match the edited span (avoids negative duration when UI maps past stored durationSeconds). */
  let durationMax = Math.max(baseAutomationDuration, requestedEnd);

  duration = Math.min(duration, durationMax - startTime);
  startTime = Math.max(0, Math.min(startTime, durationMax - duration));

  const resolved = resolveUpdatedRegionAgainstOthers(lane, regionIndex, startTime, duration, durationMax);
  startTime = resolved.startTime;
  duration = resolved.duration;

  const curveUpdate = updates.curve;
  const resolvedCurve =
    curveUpdate != null
      ? {
          ...curveUpdate,
          keyframes: sanitizeAutomationRegionKeyframes(curveUpdate.keyframes ?? []),
        }
      : region.curve;

  const updatedRegion: AutomationRegion = {
    ...region,
    startTime,
    duration,
    loop: updates.loop ?? region.loop,
    curve: resolvedCurve,
  };

  const newRegions = [...lane.regions];
  newRegions[regionIndex] = updatedRegion;
  newRegions.sort((a, b) => a.startTime - b.startTime);
  const newLanes = [...automation.lanes];
  newLanes[laneIndex] = { ...lane, regions: newRegions };

  const regionEnd = startTime + duration;
  const newAutomationDuration = Math.max(baseAutomationDuration, regionEnd);

  return {
    ...graph,
    automation: { ...automation, durationSeconds: newAutomationDuration, lanes: newLanes },
  };
}

export function removeAutomationRegion(graph: NodeGraph, laneId: string, regionId: string): NodeGraph {
  const automation = ensureAutomation(graph);
  const laneIndex = automation.lanes.findIndex((l) => l.id === laneId);
  if (laneIndex === -1) return graph;

  const lane = automation.lanes[laneIndex];
  const newRegions = lane.regions.filter((r) => r.id !== regionId);
  if (newRegions.length === lane.regions.length) return graph;

  const newLanes = [...automation.lanes];
  newLanes[laneIndex] = { ...lane, regions: newRegions };
  return { ...graph, automation: { ...automation, lanes: newLanes } };
}

export function removeAutomationLane(graph: NodeGraph, laneId: string): NodeGraph {
  const automation = ensureAutomation(graph);
  const newLanes = automation.lanes.filter((l) => l.id !== laneId);
  if (newLanes.length === automation.lanes.length) return graph;
  return { ...graph, automation: { ...automation, lanes: newLanes } };
}

export function setAutomationBpm(graph: NodeGraph, bpm: number): NodeGraph {
  const clamped = Math.max(20, Math.min(300, bpm));
  const automation = ensureAutomation(graph);
  if (automation.bpm === clamped) return graph;
  return { ...graph, automation: { ...automation, bpm: clamped } };
}

export function setAutomationDuration(graph: NodeGraph, durationSeconds: number): NodeGraph {
  const clamped = Math.max(MIN_DURATION_SECONDS, Number.isFinite(durationSeconds) ? durationSeconds : DEFAULT_DURATION_SECONDS);
  const automation = ensureAutomation(graph);
  if (automation.durationSeconds === clamped) return graph;
  return { ...graph, automation: { ...automation, durationSeconds: clamped } };
}
