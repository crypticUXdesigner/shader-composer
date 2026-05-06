/**
 * Automation state comparison for graph change detection.
 * Extracted from GraphChangeDetector for smaller module size.
 */

import type { NodeGraph } from '../../data-model/types';

export type AutomationState = NodeGraph['automation'];

/**
 * Compare automation state (equal lanes, regions, curves).
 * Used so automation-only changes are treated as structure change (trigger recompile).
 */
export function automationEqual(a: AutomationState, b: AutomationState): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.bpm !== b.bpm || a.durationSeconds !== b.durationSeconds) return false;
  if ((a.lanes?.length ?? 0) !== (b.lanes?.length ?? 0)) return false;
  const lanesA = a.lanes ?? [];
  const lanesB = b.lanes ?? [];
  for (let i = 0; i < lanesA.length; i++) {
    const la = lanesA[i];
    const lb = lanesB[i];
    if (!lb || la.id !== lb.id || la.nodeId !== lb.nodeId || la.paramName !== lb.paramName) return false;
    if ((la.regions?.length ?? 0) !== (lb.regions?.length ?? 0)) return false;
    const ra = la.regions ?? [];
    const rb = lb.regions ?? [];
    for (let j = 0; j < ra.length; j++) {
      const rj = ra[j];
      const rjb = rb[j];
      if (!rjb || rj.id !== rjb.id || rj.startTime !== rjb.startTime || rj.duration !== rjb.duration || rj.loop !== rjb.loop) return false;
      if ((rj.curve?.interpolation ?? 'linear') !== (rjb.curve?.interpolation ?? 'linear')) return false;
      const kfA = rj.curve?.keyframes ?? [];
      const kfB = rjb.curve?.keyframes ?? [];
      if (kfA.length !== kfB.length) return false;
      for (let k = 0; k < kfA.length; k++) {
        if (kfA[k].time !== kfB[k].time || kfA[k].value !== kfB[k].value) return false;
      }
    }
  }
  return true;
}

/**
 * True when automation differs only by region startTime/duration/loop (same lanes, region ids, curve keyframes).
 */
export function automationOnlyRegionTimesDiffer(a: AutomationState, b: AutomationState): boolean {
  if (a === b) return false;
  if (!a || !b) return false;
  if (a.bpm !== b.bpm || a.durationSeconds !== b.durationSeconds) return false;
  if ((a.lanes?.length ?? 0) !== (b.lanes?.length ?? 0)) return false;
  const lanesA = a.lanes ?? [];
  const lanesB = b.lanes ?? [];
  let hasRegionTimeDifference = false;
  for (let i = 0; i < lanesA.length; i++) {
    const la = lanesA[i];
    const lb = lanesB[i];
    if (!lb || la.id !== lb.id || la.nodeId !== lb.nodeId || la.paramName !== lb.paramName) return false;
    if ((la.regions?.length ?? 0) !== (lb.regions?.length ?? 0)) return false;
    const ra = la.regions ?? [];
    const rb = lb.regions ?? [];
    for (let j = 0; j < ra.length; j++) {
      const rj = ra[j];
      const rjb = rb[j];
      if (!rjb || rj.id !== rjb.id) return false;
      if (rj.startTime !== rjb.startTime || rj.duration !== rjb.duration || rj.loop !== rjb.loop) {
        hasRegionTimeDifference = true;
      }
      const kfA = rj.curve?.keyframes ?? [];
      const kfB = rjb.curve?.keyframes ?? [];
      if (kfA.length !== kfB.length) return false;
      for (let k = 0; k < kfA.length; k++) {
        if (kfA[k].time !== kfB[k].time || kfA[k].value !== kfB[k].value) return false;
      }
    }
  }
  return hasRegionTimeDifference;
}
