// Utility functions for working with NodeSpecs
// These functions were previously in nodeSpecAdapter.ts but are now standalone utilities

import type { NodeSpec } from '../types/nodeSpec';
import type { NodeIconIdentifier } from './icons';

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
  const categoryIconMap: Record<string, NodeIconIdentifier> = {
    'Inputs': 'settings',
    'Patterns': 'sparkles',
    'Shapes': 'circle',
    'Math': 'calculator',
    'Utilities': 'settings',
    'Distort': 'move',
    'Blend': 'layers',
    'Mask': 'square',
    'Effects': 'sparkles',
    'Output': 'monitor',
    'Audio': 'audio-waveform'
  };
  
  return categoryIconMap[spec.category] || 'circle';
}

/**
 * Gets the color for a node category (used for header gradients)
 */
export function getNodeColorByCategory(category: string): string {
  // This function returns a CSS color token name or color value
  // The actual color resolution happens via getCSSColor in the calling code
  // This function just returns the token name
  
  const categoryColorMap: Record<string, string> = {
    'Inputs': 'category-color-inputs',
    'Patterns': 'category-color-patterns',
    'Shapes': 'category-color-shapes',
    'Math': 'category-color-math',
    'Utilities': 'category-color-utilities',
    'Distort': 'category-color-distort',
    'Blend': 'category-color-blend',
    'Mask': 'category-color-mask',
    'Effects': 'category-color-effects',
    'Output': 'category-color-output',
    'Audio': 'category-color-audio'
  };
  
  return categoryColorMap[category] || 'category-color-default';
}
