/**
 * Migrates legacy `rings` nodes: merges ringAmplitude × ringIntensity → ringLevel,
 * introduces ringLineMode from legacy line detection (ringWidth > 0).
 */

import type { ParameterInputMode } from '../types/nodeSpec';
import type { AutomationLane, Connection, NodeGraph, NodeInstance } from './types';

const TAU = 2 * Math.PI;

function migrateRingFrequencyAutomationLane(lane: AutomationLane): AutomationLane {
  if (lane.paramName !== 'ringFrequency') return lane;
  return {
    ...lane,
    paramName: 'ringSpacing',
    regions: lane.regions.map((region) => ({
      ...region,
      curve: {
        ...region.curve,
        keyframes: region.curve.keyframes.map((kf) => ({
          ...kf,
          value: TAU / Math.max(0.001, kf.value)
        }))
      }
    }))
  };
}

function migrateParameters(node: NodeInstance): {
  parameters: NodeInstance['parameters'];
  parameterInputModes?: Record<string, ParameterInputMode> | 'omit';
} {
  if (node.type !== 'rings') {
    return { parameters: node.parameters };
  }

  const old = node.parameters ?? {};
  const p: Record<string, unknown> = { ...old };

  const hadAmp = 'ringAmplitude' in old;
  const hadInt = 'ringIntensity' in old;
  const amp = typeof p.ringAmplitude === 'number' ? p.ringAmplitude : 0.5;
  const inten = typeof p.ringIntensity === 'number' ? p.ringIntensity : 1.0;

  if (!('ringLevel' in p) && (hadAmp || hadInt)) {
    p.ringLevel = Math.min(4, Math.max(0, amp * inten));
  }
  delete p.ringAmplitude;
  delete p.ringIntensity;
  delete p.ringRadiusOffset;

  if ('ringFrequency' in p) {
    if (!('ringSpacing' in p) && typeof p.ringFrequency === 'number') {
      const f = Math.max(0.001, p.ringFrequency);
      p.ringSpacing = TAU / f;
    }
    delete p.ringFrequency;
  }
  if (!('ringSpacing' in p)) {
    p.ringSpacing = TAU / 10;
  }

  if (!('ringLineMode' in p)) {
    const w = typeof p.ringWidth === 'number' ? p.ringWidth : 0;
    p.ringLineMode = w > 0 ? 1 : 0;
  }

  let nextModes: Record<string, ParameterInputMode> | undefined = node.parameterInputModes
    ? { ...node.parameterInputModes }
    : undefined;
  if (nextModes) {
    const ampMode = nextModes.ringAmplitude;
    const intMode = nextModes.ringIntensity;
    delete nextModes.ringAmplitude;
    delete nextModes.ringIntensity;
    delete nextModes.ringRadiusOffset;
    if (nextModes.ringFrequency !== undefined) {
      nextModes.ringSpacing = nextModes.ringFrequency;
      delete nextModes.ringFrequency;
    }
    if (ampMode !== undefined) {
      nextModes.ringLevel = ampMode;
    } else if (intMode !== undefined && nextModes.ringLevel === undefined) {
      nextModes.ringLevel = intMode;
    }
    if (Object.keys(nextModes).length === 0) {
      nextModes = undefined;
    }
  }

  return {
    parameters: p as NodeInstance['parameters'],
    ...(nextModes !== undefined
      ? { parameterInputModes: nextModes }
      : node.parameterInputModes !== undefined
        ? { parameterInputModes: 'omit' as const }
        : {})
  };
}

function migrateNode(node: NodeInstance): NodeInstance {
  if (node.type !== 'rings') return node;
  const migrated = migrateParameters(node);
  const next: NodeInstance = { ...node, parameters: migrated.parameters };
  if ('parameterInputModes' in migrated) {
    const im = migrated.parameterInputModes;
    if (im === 'omit') {
      delete next.parameterInputModes;
    } else if (im !== undefined) {
      next.parameterInputModes = im;
    }
  }
  return next;
}

const PARAM_REMAP: Record<string, string> = {
  ringAmplitude: 'ringLevel',
  ringIntensity: 'ringLevel'
};

export function migrateRingsNode(graph: NodeGraph): NodeGraph {
  const hasRings = graph.nodes.some((n) => n.type === 'rings');
  if (!hasRings) return graph;

  const ringsIds = new Set(graph.nodes.filter((n) => n.type === 'rings').map((n) => n.id));

  const nodes = graph.nodes.map(migrateNode);

  let connections: Connection[] = graph.connections.filter((c) => {
    if (!c.targetParameter || !ringsIds.has(c.targetNodeId)) return true;
    if (c.targetParameter === 'ringRadiusOffset') return false;
    if (c.targetParameter === 'ringFrequency') return false;
    return true;
  });

  connections = connections.map((c) => {
    if (!c.targetParameter || !ringsIds.has(c.targetNodeId)) return c;
    const mapped = PARAM_REMAP[c.targetParameter];
    if (!mapped) return c;
    return { ...c, targetParameter: mapped };
  });

  // If two param wires now target ringLevel, drop duplicates (keep first).
  const seenRingLevelTargets = new Set<string>();
  connections = connections.filter((c) => {
    if (!c.targetParameter || c.targetParameter !== 'ringLevel' || !ringsIds.has(c.targetNodeId)) {
      return true;
    }
    const key = `${c.targetNodeId}:ringLevel`;
    if (seenRingLevelTargets.has(key)) return false;
    seenRingLevelTargets.add(key);
    return true;
  });

  let automation = graph.automation;
  if (automation) {
    const lanes: AutomationLane[] = [];
    const seenLaneKeys = new Set<string>();
    for (const lane of automation.lanes) {
      if (!ringsIds.has(lane.nodeId)) {
        lanes.push(lane);
        continue;
      }
      if (lane.paramName === 'ringRadiusOffset') {
        continue;
      }
      let laneWork: AutomationLane = lane;
      if (lane.paramName === 'ringFrequency') {
        laneWork = migrateRingFrequencyAutomationLane(lane);
      }
      let paramName = laneWork.paramName;
      if (paramName === 'ringAmplitude' || paramName === 'ringIntensity') {
        paramName = 'ringLevel';
      }
      const key = `${lane.nodeId}:${paramName}`;
      if (seenLaneKeys.has(key)) {
        continue;
      }
      seenLaneKeys.add(key);
      lanes.push({ ...laneWork, paramName });
    }
    automation = { ...automation, lanes };
  }

  return { ...graph, nodes, connections, ...(automation !== undefined && { automation }) };
}
