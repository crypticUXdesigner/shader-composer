import type { NodeSpec } from '../../types/nodeSpec';
import { BLEND_MODE_PHOTOSHOP_FLOAT_GLSL } from './blendNodeCode';

/**
 * Unified blend node: resolves float / vec2 / vec3 / vec4 from connections (see effectiveNodeSpecs).
 * vec4 supports Alpha: Lerp (legacy Blend Color) vs Blend (mode on alpha).
 */
export const blendNodeSpec: NodeSpec = {
  id: 'blend',
  category: 'Blend',
  displayName: 'Blend',
  description:
    'Blends two values with Photoshop-style modes. Port type follows wires (float, vec2, vec3, or vec4). For vec4, Alpha chooses lerp vs per-channel blend on alpha.',
  inputs: [
    { name: 'base', type: 'any', label: 'Background' },
    { name: 'blend', type: 'any', label: 'Blend' }
  ],
  outputs: [{ name: 'out', type: 'any', label: 'Result' }],
  parameters: {
    mode: {
      type: 'int',
      default: 0,
      min: 0,
      max: 11,
      label: 'Mode'
    },
    opacity: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Opacity'
    },
    alphaMode: {
      type: 'int',
      default: 0,
      min: 0,
      max: 1,
      step: 1,
      label: 'Alpha'
    }
  },
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        parameters: ['mode', 'opacity'],
        layout: { columns: 2 }
      },
      {
        type: 'grid',
        parameters: ['alphaMode'],
        parameterUI: { alphaMode: 'enum' },
        layout: { columns: 1 }
      }
    ]
  },
  functions: BLEND_MODE_PHOTOSHOP_FLOAT_GLSL,
  mainCode: `
    float blended = applyBlendMode($input.base, $input.blend, $param.mode);
    $output.out = mix($input.base, blended, $param.opacity);
  `
};
