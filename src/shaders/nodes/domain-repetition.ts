import type { NodeSpec } from '../../types';

/**
 * Domain Repetition
 * Tiles UV space so any upstream pattern repeats: out = fract(in * scale) + offset.
 * vec2 in → vec2 out. Category Distort (Transform section).
 */
export const domainRepetitionNodeSpec: NodeSpec = {
  id: 'domain-repetition',
  category: 'Distort',
  displayName: 'Domain Repetition',
  description: 'Tiles coordinates so upstream patterns repeat; output is in 0–1 per tile plus optional offset',
  icon: 'grid',
  inputs: [
    {
      name: 'in',
      type: 'vec2'
    }
  ],
  outputs: [
    {
      name: 'out',
      type: 'vec2'
    }
  ],
  parameters: {
    scaleX: {
      type: 'float',
      default: 3.0,
      min: 0.1,
      max: 50.0,
      step: 0.1,
      label: 'Scale X'
    },
    scaleY: {
      type: 'float',
      default: 3.0,
      min: 0.1,
      max: 50.0,
      step: 0.1,
      label: 'Scale Y'
    },
    offsetX: {
      type: 'float',
      default: 0.0,
      min: -1.0,
      max: 1.0,
      step: 0.01,
      label: 'Offset X'
    },
    offsetY: {
      type: 'float',
      default: 0.0,
      min: -1.0,
      max: 1.0,
      step: 0.01,
      label: 'Offset Y'
    }
  },
  parameterGroups: [
    {
      id: 'tiling',
      label: 'Tiling',
      parameters: ['scaleX', 'scaleY'],
      collapsible: false,
      defaultCollapsed: false
    },
    {
      id: 'offset',
      label: 'Offset',
      parameters: ['offsetX', 'offsetY'],
      collapsible: false,
      defaultCollapsed: false
    }
  ],
  mainCode: `
  $output.out = fract($input.in * vec2($param.scaleX, $param.scaleY)) + vec2($param.offsetX, $param.offsetY);
  `
};
