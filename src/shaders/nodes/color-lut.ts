import type { NodeSpec } from '../../types/nodeSpec';
import { COLOR_LUT_GLSL_SAMPLE_PLACEHOLDER } from '../colorRamps/emitGlsl';
import { getLutPresetCount } from '../colorRamps/lutPresets';

const presetMax = getLutPresetCount() - 1;

export const colorLutNodeSpec: NodeSpec = {
  id: 'color-lut',
  category: 'Blend',
  displayName: 'Color LUT',
  description:
    'Maps a scalar through a curated 1D color preset with reverse, gamma, contrast, and intensity controls',
  icon: 'color-palette',
  inputs: [{ name: 'in', type: 'float', label: 'Value' }],
  outputs: [{ name: 'out', type: 'vec3', label: 'Color' }],
  parameters: {
    preset: {
      type: 'int',
      default: 0,
      min: 0,
      max: presetMax,
      step: 1,
      label: 'Preset',
    },
    reverse: { type: 'int', default: 0, min: 0, max: 1, step: 1, label: 'Reverse' },
    gamma: { type: 'float', default: 1.0, min: 0.25, max: 3.0, step: 0.01, label: 'Gamma' },
    contrast: { type: 'float', default: 0.0, min: -1.0, max: 1.0, step: 0.01, label: 'Contrast' },
    intensity: { type: 'float', default: 1.0, min: 0.0, max: 2.0, step: 0.01, label: 'Intensity' },
  },
  parameterLayout: {
    minColumns: 3,
    parametersWithoutPorts: ['preset', 'reverse'],
    elements: [
      {
        type: 'grid',
        parameters: ['preset', 'reverse'],
        parameterUI: { preset: 'enum', reverse: 'toggle' },
        layout: { columns: 2 },
      },
      { type: 'color-map-preview', mode: 'lut' },
      {
        type: 'grid',
        parameters: ['gamma', 'contrast', 'intensity'],
        layout: { columns: 3 },
      },
    ],
  },
  // Per-node LUT table injected in FunctionGenerator from the selected preset (compile-time bake).
  functions: '/* color-lut LUT helpers injected at compile */',
  mainCode: `
    float t = clamp($input.in, 0.0, 1.0);
    float contrast = $param.contrast + 1.0;
    t = cr_apply_lut_t(t, float($param.reverse), $param.gamma, contrast);
    vec3 rgb = ${COLOR_LUT_GLSL_SAMPLE_PLACEHOLDER}(t);
    $output.out = cr_apply_intensity(rgb, $param.intensity);
  `,
};
