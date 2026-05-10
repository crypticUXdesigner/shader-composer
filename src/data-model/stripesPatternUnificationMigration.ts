/**
 * Legacy: `sunbeams` removed; old fract `stripes` + `wave-patterns` unified into single `stripes` (wave-based).
 */

import type {
  AutomationLane,
  AutomationState,
  NodeGraph,
  NodeInstance,
  ParameterValue
} from './types';

const LEGACY_STRIPE_PARAM_PREFIX = 'stripes';

function ownsLegacyStripeParams(parameters: Record<string, ParameterValue>): boolean {
  for (const k of Object.keys(parameters)) {
    if (k.startsWith(LEGACY_STRIPE_PARAM_PREFIX)) return true;
  }
  return false;
}

function coerceNumber(v: ParameterValue | undefined, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

/**
 * Maps legacy alternating-band strip parameters to waveshape parameters (best-effort).
 */
export function migrateLegacyStripeParameters(
  parameters: Record<string, ParameterValue>
): Record<string, ParameterValue> {
  const sharpness = coerceNumber(parameters.stripesSharpness, 1.0);
  let waveType = 0;
  if (sharpness >= 0.95) waveType = 2;
  else if (sharpness <= 0.06) waveType = 3;

  return {
    waveScale: 1.0,
    waveFrequency: coerceNumber(parameters.stripesFrequency, 5.0),
    waveAmplitude: 1.0,
    waveType,
    waveDirection: coerceNumber(parameters.stripesAngle, 0.0),
    wavePhaseSpeed: 1.0,
    wavePhaseOffset: coerceNumber(parameters.stripesPhase, 0.0),
    waveTimeSpeed: coerceNumber(parameters.stripesTimeSpeed, 0.0),
    waveIntensity: coerceNumber(parameters.stripesIntensity, 1.0),
    waveTimeOffset: 0.0
  };
}

function mapLegacyStripeAutomationParam(paramName: string): string | undefined {
  switch (paramName) {
    case 'stripesAngle':
      return 'waveDirection';
    case 'stripesFrequency':
      return 'waveFrequency';
    case 'stripesIntensity':
      return 'waveIntensity';
    case 'stripesPhase':
      return 'wavePhaseOffset';
    case 'stripesTimeSpeed':
      return 'waveTimeSpeed';
    default:
      return undefined;
  }
}

function pruneAutomation(
  automation: AutomationState | undefined,
  removedNodeIds: Set<string>
): AutomationState | undefined {
  if (!automation) return undefined;
  const lanes = automation.lanes.filter((l: AutomationLane) => !removedNodeIds.has(l.nodeId));
  if (lanes.length === automation.lanes.length) return automation;
  return { ...automation, lanes };
}

function remapAutomationLanes(automation: AutomationState | undefined): AutomationState | undefined {
  if (!automation) return undefined;
  let changed = false;
  const lanes: AutomationLane[] = automation.lanes
    .map((lane: AutomationLane): AutomationLane | null => {
      const next = mapLegacyStripeAutomationParam(lane.paramName);
      if (next !== undefined && next !== lane.paramName) {
        changed = true;
        return { ...lane, paramName: next };
      }
      if (lane.paramName.startsWith('stripes')) {
        changed = true;
        return null;
      }
      return lane;
    })
    .filter((l: AutomationLane | null): l is AutomationLane => l !== null);
  return changed ? { ...automation, lanes } : automation;
}

export function migrateSunbeamsRemoval(graph: NodeGraph): NodeGraph {
  const removeIds = new Set(graph.nodes.filter((n) => n.type === 'sunbeams').map((n) => n.id));
  if (removeIds.size === 0) return graph;

  const nodes = graph.nodes.filter((n) => n.type !== 'sunbeams');
  const connections = graph.connections.filter(
    (c) => !removeIds.has(c.sourceNodeId) && !removeIds.has(c.targetNodeId)
  );

  const automation = pruneAutomation(graph.automation, removeIds);

  let viewState = graph.viewState;
  if (viewState?.selectedNodeIds?.length) {
    const nextSel = viewState.selectedNodeIds.filter((id) => !removeIds.has(id));
    if (nextSel.length !== viewState.selectedNodeIds.length) {
      viewState = {
        ...viewState,
        ...(nextSel.length > 0 ? { selectedNodeIds: nextSel } : { selectedNodeIds: undefined })
      };
    }
  }

  return {
    ...graph,
    nodes,
    connections,
    ...(automation !== undefined ? { automation } : {}),
    ...(viewState !== undefined ? { viewState } : {})
  };
}

export function migrateWavePatternsTypeRename(graph: NodeGraph): NodeGraph {
  const nodes: NodeInstance[] = graph.nodes.map((n) =>
    n.type === 'wave-patterns' ? { ...n, type: 'stripes' } : n
  );
  const changed = nodes.some((n, i) => n !== graph.nodes[i]);
  return changed ? { ...graph, nodes } : graph;
}

export function migrateLegacyFractStripeNodes(graph: NodeGraph): NodeGraph {
  const nodes: NodeInstance[] = graph.nodes.map((n) => {
    if (n.type !== 'stripes') return n;
    if (!n.parameters || !ownsLegacyStripeParams(n.parameters)) return n;

    const waveMerged =
      typeof n.parameters.waveFrequency === 'number' || typeof n.parameters.waveDirection === 'number';
    let nextParameters: Record<string, ParameterValue>;

    if (waveMerged) {
      nextParameters = { ...n.parameters };
      for (const k of Object.keys(nextParameters)) {
        if (k.startsWith(LEGACY_STRIPE_PARAM_PREFIX)) {
          delete nextParameters[k];
        }
      }
    } else {
      nextParameters = { ...migrateLegacyStripeParameters(n.parameters) };
    }

    const nextModes = n.parameterInputModes ? { ...n.parameterInputModes } : undefined;
    if (nextModes) {
      for (const k of Object.keys(nextModes)) {
        if (k.startsWith(LEGACY_STRIPE_PARAM_PREFIX)) {
          delete nextModes[k];
        }
      }
    }

    return {
      ...n,
      parameters: nextParameters,
      ...(nextModes !== undefined ? { parameterInputModes: nextModes } : {})
    };
  });
  const nodesChanged = nodes.some((n, i) => n !== graph.nodes[i]);

  const prevAuto = graph.automation;
  const automation = remapAutomationLanes(graph.automation);
  const automationChanged = automation !== prevAuto;

  if (!nodesChanged && !automationChanged) return graph;
  return {
    ...graph,
    ...(nodesChanged ? { nodes } : {}),
    ...(automationChanged && automation !== undefined ? { automation } : {})
  };
}

/** Ordered pipeline: strip sunbeams, rename wave-patterns, remap legacy fract stripes params. */
export function migrateUnifiedStripesPattern(graph: NodeGraph): NodeGraph {
  let g = migrateSunbeamsRemoval(graph);
  g = migrateWavePatternsTypeRename(g);
  g = migrateLegacyFractStripeNodes(g);
  return g;
}
