// Utility functions for working with NodeSpecs
// These functions were previously in nodeSpecAdapter.ts but are now standalone utilities

import type { NodeSpec, PortSpec } from '../types/nodeSpec';
import type { NodeIconIdentifier } from './icons';
import type { NodeSpecification } from '../data-model/validation';

/**
 * Gets the icon identifier for a node spec
 * Returns the spec's icon if defined, otherwise returns a default icon based on category
 */
export function getNodeIcon(spec: NodeSpec): NodeIconIdentifier | string {
  // If the spec has an explicit icon, use it
  if (spec.icon) {
    return spec.icon;
  }
  
  // Otherwise, return a default icon based on category
  return getCategoryDefaultIcon(spec.category);
}

/** Default icon identifier for a category (e.g. for panel section headers).
 * Chosen so categories are visually distinct: no duplicate icons, and line vs filled
 * used to differentiate (e.g. Patterns = sparkles filled, Effects = adjustments line). */
const categoryIconMap: Record<string, NodeIconIdentifier> = {
  'Inputs': 'settings',
  'Patterns': 'grid',          /* line – grid-4x4; clearly not circle-like */
  'Shapes': 'kaleidoscope',    /* line – multiple shapes */
  'Math': 'calculator',
  'Utilities': 'resize',       /* maximize – transform/toolbox; distinct from Inputs */
  'Distort': 'move',
  'Blend': 'blend-mode',      /* line – blend controls; distinct from circle-like layers */
  'Mask': 'mask',             /* line – mask/cutout; distinct from generic square */
  'Effects': 'adjustments',   /* line – filters/effects; distinct from Patterns sparkles */
  'Output': 'video',
  'Audio': 'audio-waveform'
};

export function getCategoryDefaultIcon(category: string): NodeIconIdentifier | string {
  return categoryIconMap[category] ?? 'circle';
}

/**
 * True when the node is an input node with a single output whose label is the same or very similar
 * to the node's display name (e.g. "Resolution" / "Resolution", "UV Coords" / "UV").
 * Only applied to category Inputs so nodes like Noise (Patterns) always show their output label.
 * Used to hide redundant output labels on input-style nodes in the node header and help UI.
 */
export function isRedundantOutputLabel(spec: NodeSpec, port: PortSpec): boolean {
  if (spec.category !== 'Inputs') return false;
  if (!spec.outputs?.length || spec.outputs.length !== 1) return false;
  const nodeName = (spec.displayName ?? '').trim().toLowerCase();
  const portLabel = (port.label ?? port.name).trim().toLowerCase();
  if (!nodeName || !portLabel) return false;
  return nodeName === portLabel || nodeName.includes(portLabel) || portLabel.includes(nodeName);
}

/**
 * Convert app NodeSpec[] to data-model NodeSpecification[] for validation (e.g. preset load).
 */
export function toValidationSpecs(specs: NodeSpec[]): NodeSpecification[] {
  return specs.map((s) => ({
    id: s.id,
    inputs: s.inputs?.map((p) => ({ name: p.name, type: p.type })),
    outputs: s.outputs?.map((p) => ({ name: p.name, type: p.type })),
    parameters: s.parameters
      ? Object.fromEntries(
          Object.entries(s.parameters).map(([k, v]) => [
            k,
            {
              type: v.type,
              default: v.default,
              min: v.min,
              max: v.max,
            },
          ])
        )
      : undefined,
  }));
}
