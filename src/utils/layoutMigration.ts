/**
 * Layout Migration Utility
 * 
 * Auto-generates parameterLayout from existing node specs.
 * Used to migrate nodes from legacy layout system to new flexbox-based system.
 */

import type { NodeSpec, ParameterLayout, LayoutElement, GridElement } from '../types/nodeSpec';

/**
 * Check if a node is a remap-range node (has inMin, inMax, outMin, outMax as parameters)
 */
function isRemapRangeNode(spec: NodeSpec): boolean {
  return (
    spec.parameters.inMin !== undefined &&
    spec.parameters.inMax !== undefined &&
    spec.parameters.outMin !== undefined &&
    spec.parameters.outMax !== undefined &&
    spec.parameters.inMin.type === 'float' &&
    spec.parameters.inMax.type === 'float' &&
    spec.parameters.outMin.type === 'float' &&
    spec.parameters.outMax.type === 'float'
  );
}

/**
 * Check if a node is a bezier curve node (has x1, y1, x2, y2 parameters)
 */
function isBezierNode(spec: NodeSpec): boolean {
  return (
    spec.id === 'bezier-curve' ||
    (
      spec.parameters.x1 !== undefined &&
      spec.parameters.y1 !== undefined &&
      spec.parameters.x2 !== undefined &&
      spec.parameters.y2 !== undefined &&
      spec.parameters.x1.type === 'float' &&
      spec.parameters.y1.type === 'float' &&
      spec.parameters.x2.type === 'float' &&
      spec.parameters.y2.type === 'float'
    )
  );
}

// calculateOptimalColumns not needed - grid elements use 'auto' columns
// function calculateOptimalColumns(paramCount: number): number {
//   if (paramCount <= 1) return 1;
//   if (paramCount <= 2) return 2;
//   if (paramCount <= 4) return 2;
//   if (paramCount <= 6) return 3;
//   if (paramCount <= 9) return 3;
//   return 4;
// }

/**
 * Auto-generate parameterLayout from existing node spec
 */
export function autoGenerateLayout(spec: NodeSpec): ParameterLayout {
  // Skip if already has layout
  if (spec.parameterLayout) {
    return spec.parameterLayout;
  }

  // 1. Check for special cases first
  
  // Remap range node
  if (isRemapRangeNode(spec)) {
    // Get all parameters except the remap-range ones
    const remapParams = ['inMin', 'inMax', 'outMin', 'outMax'];
    const otherParams = Object.keys(spec.parameters).filter(
      p => !remapParams.includes(p)
    );
    
    const elements: LayoutElement[] = [
      {
        type: 'remap-range'
      }
    ];
    
    // Add grid for remaining parameters (e.g., clamp)
    if (otherParams.length > 0) {
      elements.push({
        type: 'grid',
        parameters: otherParams,
        layout: {
          columns: 'auto'
        }
      });
    }
    
    return { elements };
  }
  
  // Bezier curve node
  if (isBezierNode(spec)) {
    return {
      elements: [
        {
          type: 'bezier-editor',
          parameters: ['x1', 'y1', 'x2', 'y2']
        }
      ]
    };
  }
  
  // 2. Use parameterGroups to create grid elements
  if (spec.parameterGroups && spec.parameterGroups.length > 0) {
    const elements: LayoutElement[] = [];
    
    spec.parameterGroups.forEach(group => {
      if (group.parameters.length > 0) {
        elements.push({
          type: 'grid',
          label: group.label,
          parameters: group.parameters,
          layout: {
            columns: 'auto'
          }
        } as GridElement);
      }
    });
    
    // Add ungrouped parameters
    const allGroupedParams = new Set(
      spec.parameterGroups.flatMap(g => g.parameters)
    );
    const ungroupedParams = Object.keys(spec.parameters).filter(
      p => !allGroupedParams.has(p)
    );
    
    if (ungroupedParams.length > 0) {
      elements.push({
        type: 'grid',
        parameters: ungroupedParams,
        layout: {
          columns: 'auto'
        }
      } as GridElement);
    }
    
    // If no elements were created (all groups empty), use auto-grid
    if (elements.length === 0) {
      return {
        elements: [
          { type: 'auto-grid' }
        ]
      };
    }
    
    return { elements };
  }
  
  // 3. Default: auto-grid (handles all parameters automatically)
  return {
    elements: [
      { type: 'auto-grid' }
    ]
  };
}

/**
 * Migrate a node spec by adding parameterLayout if missing
 */
export function migrateNodeSpec(spec: NodeSpec): NodeSpec {
  // Skip if already has parameterLayout
  if (spec.parameterLayout) {
    return spec;
  }
  
  // Auto-generate layout
  spec.parameterLayout = autoGenerateLayout(spec);
  
  return spec;
}
