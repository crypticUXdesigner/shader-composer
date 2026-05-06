import type { NodeSpec } from '../../types/nodeSpec';

/**
 * Transform Nodes
 * These nodes modify coordinates (vec2 → vec2)
 */

export const rotateNodeSpec: NodeSpec = {
  id: 'rotate',
  category: 'Distort',
  displayName: 'Rotate',
  description: 'Rotates coordinates around a center point',
  icon: 'rotate',
  inputs: [
    {
      name: 'in',
      type: 'vec2',
      label: 'UV'
    }
  ],
  outputs: [
    {
      name: 'out',
      type: 'vec2',
      label: 'UV'
    }
  ],
  parameters: {
    angle: {
      type: 'float',
      default: 0.0,
      min: -6.28,
      max: 6.28,
      step: 0.05,
      label: 'Angle',
      knobPolarity: 'two-sided' },
    centerX: {
      type: 'float',
      default: 0.0,
      min: -10.0,
      max: 10.0,
      step: 0.01,
      label: 'Center X',
      knobPolarity: 'two-sided' },
    centerY: {
      type: 'float',
      default: 0.0,
      min: -10.0,
      max: 10.0,
      step: 0.01,
      label: 'Center Y',
      knobPolarity: 'two-sided' }
  },
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        parameters: ['angle', 'centerX', 'centerY'],
        parameterUI: { centerX: 'coords', centerY: 'coords' },
        layout: { columns: 3, coordsSpan: 2 }
      }
    ]
  },
  mainCode: `
    vec2 center = vec2($param.centerX, $param.centerY);
    vec2 offset = $input.in - center;
    float c = cos($param.angle);
    float s = sin($param.angle);
    $output.out = center + vec2(offset.x * c - offset.y * s, offset.x * s + offset.y * c);
  `
};

export const scaleNodeSpec: NodeSpec = {
  id: 'scale',
  category: 'Distort',
  displayName: 'Scale',
  description: 'Scales coordinates around a center point',
  icon: 'arrow-autofit-height',
  inputs: [
    {
      name: 'in',
      type: 'vec2',
      label: 'UV'
    }
  ],
  outputs: [
    {
      name: 'out',
      type: 'vec2',
      label: 'UV'
    }
  ],
  parameters: {
    scaleX: {
      type: 'float',
      default: 1.0,
      min: 0.1,
      max: 10.0,
      step: 0.01,
      label: 'Scale X'
    },
    scaleY: {
      type: 'float',
      default: 1.0,
      min: 0.1,
      max: 10.0,
      step: 0.01,
      label: 'Scale Y'
    },
    centerX: {
      type: 'float',
      default: 0.0,
      min: -10.0,
      max: 10.0,
      step: 0.01,
      label: 'Center X',
      knobPolarity: 'two-sided' },
    centerY: {
      type: 'float',
      default: 0.0,
      min: -10.0,
      max: 10.0,
      step: 0.01,
      label: 'Center Y',
      knobPolarity: 'two-sided' }
  },
  parameterGroups: [
    {
      id: 'scale',
      label: 'Scale',
      parameters: ['scaleX', 'scaleY'],
      collapsible: false,
      defaultCollapsed: false
    },
    {
      id: 'center',
      label: 'Center',
      parameters: ['centerX', 'centerY'],
      collapsible: false,
      defaultCollapsed: false
    }
  ],
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        parameters: ['scaleX', 'scaleY', 'centerX', 'centerY'],
        parameterUI: { centerX: 'coords', centerY: 'coords' },
        layout: { columns: 2, coordsSpan: 2 }
      }
    ]
  },
  mainCode: `
    vec2 center = vec2($param.centerX, $param.centerY);
    $output.out = center + ($input.in - center) * vec2($param.scaleX, $param.scaleY);
  `
};
