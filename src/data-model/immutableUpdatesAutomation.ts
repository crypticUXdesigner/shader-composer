/**
 * Immutable automation updates. Extracted from immutableUpdates.ts for smaller module size.
 */

import type { NodeGraph } from './types';
import type { AutomationState, AutomationLane, AutomationRegion, AutomationCurve } from './types';

const DEFAULT_BPM = 120;
const DEFAULT_DURATION_SECONDS = 30;
const MIN_DURATION_SECONDS = 0.001;

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
  const finalRegion: AutomationRegion = {
    ...newRegion,
    startTime: start,
    duration: Math.min(duration, (automation.durationSeconds ?? DEFAULT_DURATION_SECONDS) - start),
  };

  const newRegions = [...lane.regions, finalRegion].sort((a, b) => a.startTime - b.startTime);
  const newLanes = [...automation.lanes];
  newLanes[laneIndex] = { ...lane, regions: newRegions };

  return { ...graph, automation: { ...automation, lanes: newLanes } };
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
  const durationMax = automation.durationSeconds ?? DEFAULT_DURATION_SECONDS;
  duration = Math.min(duration, durationMax - startTime);
  startTime = Math.max(0, Math.min(startTime, durationMax - duration));

  for (let i = 0; i < lane.regions.length; i++) {
    if (i === regionIndex) continue;
    const r = lane.regions[i];
    const rEnd = r.startTime + r.duration;
    if (startTime < rEnd && startTime + duration > r.startTime) {
      startTime = rEnd;
      if (startTime + duration > durationMax) duration = durationMax - startTime;
    }
  }

  const updatedRegion: AutomationRegion = {
    ...region,
    startTime,
    duration,
    loop: updates.loop ?? region.loop,
    curve: updates.curve ?? region.curve,
  };

  const newRegions = [...lane.regions];
  newRegions[regionIndex] = updatedRegion;
  newRegions.sort((a, b) => a.startTime - b.startTime);
  const newLanes = [...automation.lanes];
  newLanes[laneIndex] = { ...lane, regions: newRegions };

  return { ...graph, automation: { ...automation, lanes: newLanes } };
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
