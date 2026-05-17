import type { NodeSpec } from '../../types/nodeSpec';
import { emitThreeStopGlslFunctions } from '../colorRamps/emitGlsl';

export const colorGradientNodeSpec: NodeSpec = {
  id: 'color-gradient',
  category: 'Blend',
  displayName: 'Color Gradient',
  description:
    '3-stop OKLCH gradient in space; Value controls how much color appears (0 stays black)',
  icon: 'color-wheel',
  inputs: [
    { name: 'value', type: 'float', label: 'Value' },
    { name: 'position', type: 'vec2', label: 'Position' },
  ],
  outputs: [{ name: 'out', type: 'vec3', label: 'Color' }],
  parameters: {
    gradientMode: {
      type: 'int',
      default: 0,
      min: 0,
      max: 1,
      step: 1,
      label: 'Mode',
    },
    centerX: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.01,
      label: 'Center X',
      knobPolarity: 'two-sided',
    },
    centerY: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.01,
      label: 'Center Y',
      knobPolarity: 'two-sided',
    },
    angle: {
      type: 'float',
      default: 90.0,
      min: -180.0,
      max: 180.0,
      step: 1.0,
      label: 'Angle',
      knobPolarity: 'two-sided',
    },
    linearScale: {
      type: 'float',
      default: 1.0,
      min: 0.1,
      max: 5.0,
      step: 0.1,
      label: 'Scale',
    },
    radius: {
      type: 'float',
      default: 0.7,
      min: 0.01,
      max: 2.0,
      step: 0.01,
      label: 'Radius',
    },
    falloff: {
      type: 'float',
      default: 0.25,
      min: 0.0,
      max: 5.0,
      step: 0.01,
      label: 'Falloff',
    },
    stop0L: { type: 'float', default: 0.15, min: 0.0, max: 1.0, step: 0.001, label: 'Stop 1 L' },
    stop0C: { type: 'float', default: 0.08, min: 0.0, max: 0.4, step: 0.001, label: 'Stop 1 C' },
    stop0H: { type: 'float', default: 260.0, min: 0.0, max: 360.0, step: 0.001, label: 'Stop 1 H' },
    stop1L: { type: 'float', default: 0.55, min: 0.0, max: 1.0, step: 0.001, label: 'Stop 2 L' },
    stop1C: { type: 'float', default: 0.12, min: 0.0, max: 0.4, step: 0.001, label: 'Stop 2 C' },
    stop1H: { type: 'float', default: 220.0, min: 0.0, max: 360.0, step: 0.001, label: 'Stop 2 H' },
    stop2L: { type: 'float', default: 0.92, min: 0.0, max: 1.0, step: 0.001, label: 'Stop 3 L' },
    stop2C: { type: 'float', default: 0.1, min: 0.0, max: 0.4, step: 0.001, label: 'Stop 3 C' },
    stop2H: { type: 'float', default: 50.0, min: 0.0, max: 360.0, step: 0.001, label: 'Stop 3 H' },
    stop0T: { type: 'float', default: 0.0, min: 0.0, max: 1.0, step: 0.01, label: 'Stop 1' },
    stop1T: { type: 'float', default: 0.5, min: 0.0, max: 1.0, step: 0.01, label: 'Stop 2' },
    stop2T: { type: 'float', default: 1.0, min: 0.0, max: 1.0, step: 0.01, label: 'Stop 3' },
    valueGain: { type: 'float', default: 1.0, min: 0.0, max: 4.0, step: 0.01, label: 'Gain' },
    valuePower: { type: 'float', default: 1.0, min: 0.2, max: 4.0, step: 0.01, label: 'Power' },
    valueSoftness: { type: 'float', default: 0.02, min: 0.0, max: 0.5, step: 0.01, label: 'Softness' },
    intensity: { type: 'float', default: 1.0, min: 0.0, max: 2.0, step: 0.01, label: 'Intensity' },
  },
  parameterLayout: {
    minColumns: 3,
    parametersWithoutPorts: [
      'gradientMode',
      'centerX',
      'centerY',
      'angle',
      'linearScale',
      'radius',
      'falloff',
      'stop0L',
      'stop0C',
      'stop0H',
      'stop1L',
      'stop1C',
      'stop1H',
      'stop2L',
      'stop2C',
      'stop2H',
      'stop0T',
      'stop1T',
      'stop2T',
      'valueGain',
      'valuePower',
      'valueSoftness',
      'intensity',
    ],
    elements: [
      {
        type: 'grid',
        parameters: ['gradientMode'],
        parameterUI: { gradientMode: 'enum' },
        layout: { columns: 1 },
      },
      { type: 'color-map-preview', mode: 'three-stop' },
      {
        type: 'grid',
        label: 'Radial',
        visibleWhen: { parameter: 'gradientMode', equals: 0 },
        parameters: ['centerX', 'centerY', 'radius', 'falloff'],
        parameterUI: { centerX: 'coords', centerY: 'coords' },
        layout: { columns: 3, coordsSpan: 2, parameterSpan: { falloff: 3 } },
      },
      {
        type: 'grid',
        label: 'Linear',
        visibleWhen: { parameter: 'gradientMode', equals: 1 },
        parameters: ['centerX', 'centerY', 'angle', 'linearScale'],
        parameterUI: { centerX: 'coords', centerY: 'coords' },
        layout: { columns: 3, coordsSpan: 2, parameterSpan: { linearScale: 3 } },
      },
      {
        type: 'color-picker-row',
        pickers: [
          ['stop0L', 'stop0C', 'stop0H'],
          ['stop1L', 'stop1C', 'stop1H'],
          ['stop2L', 'stop2C', 'stop2H'],
        ],
      },
      {
        type: 'grid',
        parameters: ['stop0T', 'stop1T', 'stop2T'],
        layout: { columns: 3 },
      },
      {
        type: 'grid',
        label: 'Response',
        parameters: ['valueGain', 'valuePower'],
        layout: { columns: 2 },
      },
      {
        type: 'grid',
        parameters: ['valueSoftness', 'intensity'],
        layout: { columns: 2 },
      },
    ],
  },
  functions: `
${emitThreeStopGlslFunctions()}

float cg_gradientRadial(vec2 p, vec2 center, float radius, float falloff) {
  float d = length(p - center);
  float edge0 = max(0.0, radius - falloff);
  float edge1 = radius;
  return 1.0 - smoothstep(edge0, edge1, d);
}

float cg_gradientLinear(vec2 p, float angleDeg, float scale) {
  float angleRad = angleDeg * 0.017453292519943295;
  vec2 dir = vec2(cos(angleRad), sin(angleRad));
  float t = dot(p, dir) * scale + 0.5;
  return clamp(t, 0.0, 1.0);
}
`,
  mainCode: `
    vec2 p = $input.position - vec2($param.centerX, $param.centerY);
    float tSpatial = 0.0;
    if ($param.gradientMode == 0) {
      tSpatial = cg_gradientRadial(p, vec2(0.0), $param.radius, $param.falloff);
    } else {
      tSpatial = cg_gradientLinear(p, $param.angle, $param.linearScale);
    }
    tSpatial = clamp(tSpatial, 0.0, 1.0);

    float t0 = clamp($param.stop0T, 0.0, 1.0);
    float t1 = clamp($param.stop1T, t0, 1.0);
    float t2 = clamp(max($param.stop2T, t1), t0, 1.0);
    vec3 ok0 = vec3($param.stop0L, $param.stop0C, $param.stop0H);
    vec3 ok1 = vec3($param.stop1L, $param.stop1C, $param.stop1H);
    vec3 ok2 = vec3($param.stop2L, $param.stop2C, $param.stop2H);
    vec3 gradRgb = cr_sample_three_stop_oklch(ok0, t0, ok1, t1, ok2, t2, tSpatial);

    float v = cr_apply_color_gradient_value(
      $input.value, $param.valueGain, $param.valuePower, $param.valueSoftness);
    $output.out = gradRgb * v * $param.intensity;
  `,
};
