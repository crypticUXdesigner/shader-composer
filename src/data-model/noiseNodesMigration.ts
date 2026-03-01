/**
 * Noise Nodes Migration
 *
 * Migrates legacy presets containing simplex-3d, simplex-noise, fbm-noise
 * to the unified noise node with mode selection.
 */

import type { ParameterInputMode } from '../types/nodeSpec';
import type { NodeGraph, NodeInstance } from './types';

/** Legacy noise node types replaced by unified noise node */
export const LEGACY_NOISE_NODE_TYPES = new Set([
  'simplex-3d',
  'simplex-noise',
  'fbm-noise',
]);

/** Parameter mapping: old param -> new param */
const PARAM_MAP: Record<string, string> = {
  simplex3dScale: 'noiseScale',
  simplex3dOctaves: 'noiseOctaves',
  simplex3dLacunarity: 'noiseLacunarity',
  simplex3dGain: 'noiseGain',
  simplex3dTimeSpeed: 'noiseTimeSpeed',
  simplex3dTimeOffset: 'noiseTimeOffset',
  simplex3dIntensity: 'noiseIntensity',
  simplexScale: 'noiseScale',
  simplexOctaves: 'noiseOctaves',
  simplexLacunarity: 'noiseLacunarity',
  simplexGain: 'noiseGain',
  simplexTimeSpeed: 'noiseTimeSpeed',
  simplexTimeOffset: 'noiseTimeOffset',
  simplexIntensity: 'noiseIntensity',
  fbmScale: 'noiseScale',
  fbmOctaves: 'noiseOctaves',
  fbmLacunarity: 'noiseLacunarity',
  fbmGain: 'noiseGain',
  fbmTimeSpeed: 'noiseTimeSpeed',
  fbmTimeOffset: 'noiseTimeOffset',
  fbmIntensity: 'noiseIntensity',
};

/** Mode: 0=Simplex 2D, 1=Simplex 3D, 2=Value fBm */
function getModeForLegacyType(type: string): number {
  switch (type) {
    case 'simplex-noise':
      return 0;
    case 'simplex-3d':
      return 1;
    case 'fbm-noise':
      return 2;
    default:
      return 2;
  }
}

export function hasLegacyNoiseNodes(graph: NodeGraph): boolean {
  return graph.nodes.some((n) => LEGACY_NOISE_NODE_TYPES.has(n.type));
}

/**
 * Migrate graph with legacy noise nodes to unified noise node.
 */
export function migrateNoiseNodes(graph: NodeGraph): NodeGraph {
  if (!hasLegacyNoiseNodes(graph)) {
    return graph;
  }

  const migratedNodes = graph.nodes.map((node): NodeInstance => {
    if (!LEGACY_NOISE_NODE_TYPES.has(node.type)) {
      return node;
    }

    const mode = getModeForLegacyType(node.type);
    const newParams: Record<string, number> = {
      noiseMode: mode,
      noiseScale: 2.0,
      noiseOctaves: 4,
      noiseLacunarity: 2.0,
      noiseGain: 0.5,
      noiseTimeSpeed: 1.0,
      noiseTimeOffset: 0.0,
      noiseIntensity: 1.0,
    };

    if (node.parameters) {
      for (const [oldKey, newKey] of Object.entries(PARAM_MAP)) {
        if (oldKey in node.parameters && typeof node.parameters[oldKey] === 'number') {
          newParams[newKey] = node.parameters[oldKey] as number;
        }
      }
    }

    const newParameterInputModes: Record<string, ParameterInputMode> = {};
    if (node.parameterInputModes) {
      for (const [oldKey, modeVal] of Object.entries(node.parameterInputModes)) {
        const newKey = PARAM_MAP[oldKey];
        if (newKey && (modeVal === 'override' || modeVal === 'add' || modeVal === 'subtract' || modeVal === 'multiply')) {
          newParameterInputModes[newKey] = modeVal;
        }
      }
    }

    return {
      ...node,
      type: 'noise',
      parameters: newParams,
      ...(Object.keys(newParameterInputModes).length > 0 && {
        parameterInputModes: newParameterInputModes,
      }),
    };
  });

  return {
    ...graph,
    nodes: migratedNodes,
  };
}
