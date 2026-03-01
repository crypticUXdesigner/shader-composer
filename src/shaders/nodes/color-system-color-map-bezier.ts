import type { NodeSpec } from '../../types/nodeSpec';

/**
 * OKLCH Color Map (smooth/bezier interpolation)
 */

export const oklchColorMapBezierNodeSpec: NodeSpec = {
  id: 'oklch-color-map-bezier',
  category: 'Blend',
  displayName: 'Color Map Smooth',
  description: 'Converts float value to RGB color using OKLCH color space with cubic bezier curve interpolation',
  icon: 'ease-in-out-control-points',
  inputs: [
    { name: 'in', type: 'float', label: 'Value' },
    { name: 'startColor', type: 'vec3', fallbackParameter: 'startColorL,startColorC,startColorH', label: 'Start color' },
    { name: 'endColor', type: 'vec3', fallbackParameter: 'endColorL,endColorC,endColorH', label: 'End color' },
    { name: 'lCurve', type: 'vec4', fallbackParameter: 'lCurveX1,lCurveY1,lCurveX2,lCurveY2', label: 'L curve' },
    { name: 'cCurve', type: 'vec4', fallbackParameter: 'cCurveX1,cCurveY1,cCurveX2,cCurveY2', label: 'C curve' },
    { name: 'hCurve', type: 'vec4', fallbackParameter: 'hCurveX1,hCurveY1,hCurveX2,hCurveY2', label: 'H curve' }
  ],
  outputs: [
    { name: 'out', type: 'vec3', label: 'Color' }
  ],
  parameters: {
    stops: {
      type: 'int',
      default: 10,
      min: 2,
      max: 50,
      label: 'Stops'
    },
    startColorL: { type: 'float', default: 0.5, min: 0.0, max: 1.0, step: 0.01, label: 'Start Light' },
    startColorC: { type: 'float', default: 0.1, min: 0.0, max: 0.4, step: 0.01, label: 'Start Chroma' },
    startColorH: { type: 'float', default: 0.0, min: 0.0, max: 360.0, step: 1.0, label: 'Start Hue' },
    endColorL: { type: 'float', default: 0.9, min: 0.0, max: 1.0, step: 0.01, label: 'End Light' },
    endColorC: { type: 'float', default: 0.1, min: 0.0, max: 0.4, step: 0.01, label: 'End Chroma' },
    endColorH: { type: 'float', default: 180.0, min: 0.0, max: 360.0, step: 1.0, label: 'End Hue' },
    lCurveX1: { type: 'float', default: 0.0, min: 0.0, max: 1.0, step: 0.01 },
    lCurveY1: { type: 'float', default: 0.0, min: 0.0, max: 1.0, step: 0.01 },
    lCurveX2: { type: 'float', default: 1.0, min: 0.0, max: 1.0, step: 0.01 },
    lCurveY2: { type: 'float', default: 1.0, min: 0.0, max: 1.0, step: 0.01 },
    cCurveX1: { type: 'float', default: 0.0, min: 0.0, max: 1.0, step: 0.01 },
    cCurveY1: { type: 'float', default: 0.0, min: 0.0, max: 1.0, step: 0.01 },
    cCurveX2: { type: 'float', default: 1.0, min: 0.0, max: 1.0, step: 0.01 },
    cCurveY2: { type: 'float', default: 1.0, min: 0.0, max: 1.0, step: 0.01 },
    hCurveX1: { type: 'float', default: 0.0, min: 0.0, max: 1.0, step: 0.01 },
    hCurveY1: { type: 'float', default: 0.0, min: 0.0, max: 1.0, step: 0.01 },
    hCurveX2: { type: 'float', default: 1.0, min: 0.0, max: 1.0, step: 0.01 },
    hCurveY2: { type: 'float', default: 1.0, min: 0.0, max: 1.0, step: 0.01 },
    reverseHue: { type: 'int', default: 0, min: 0, max: 1, label: 'Reverse Hue' }
  },
  parameterLayout: {
    minColumns: 3,
    parametersWithoutPorts: [
      'lCurveX1', 'lCurveY1', 'lCurveX2', 'lCurveY2',
      'cCurveX1', 'cCurveY1', 'cCurveX2', 'cCurveY2',
      'hCurveX1', 'hCurveY1', 'hCurveX2', 'hCurveY2',
      'reverseHue'
    ],
    elements: [
      { type: 'color-map-preview', mode: 'smooth' },
      { type: 'grid', parameters: ['stops', 'reverseHue'], layout: { columns: 3, parameterSpan: { stops: 2 } } },
      { type: 'color-picker-row', label: 'Colors', pickers: [['startColorL', 'startColorC', 'startColorH'], ['endColorL', 'endColorC', 'endColorH']] },
      { type: 'grid', parameters: ['startColorL', 'startColorC', 'startColorH'], parameterUI: { startColorL: 'input', startColorC: 'input', startColorH: 'input' }, layout: { columns: 3 } },
      { type: 'grid', parameters: ['endColorL', 'endColorC', 'endColorH'], parameterUI: { endColorL: 'input', endColorC: 'input', endColorH: 'input' }, layout: { columns: 3 } },
      { type: 'bezier-editor-row', label: 'Curves', height: 200, editors: [['lCurveX1', 'lCurveY1', 'lCurveX2', 'lCurveY2'], ['cCurveX1', 'cCurveY1', 'cCurveX2', 'cCurveY2'], ['hCurveX1', 'hCurveY1', 'hCurveX2', 'hCurveY2']] }
    ]
  },
  functions: `
    vec3 oklchToRgb(vec3 oklch) {
      float l = oklch.x;
      float c = oklch.y;
      float h = oklch.z * 3.14159265359 / 180.0;
      float a = c * cos(h);
      float b = c * sin(h);
      float l_ = l + 0.3963377774 * a + 0.2158037573 * b;
      float m_ = l - 0.1055613458 * a - 0.0638541728 * b;
      float s_ = l - 0.0894841775 * a - 1.2914855480 * b;
      float l3 = l_ * l_ * l_;
      float m3 = m_ * m_ * m_;
      float s3 = s_ * s_ * s_;
      float r = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
      float g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
      float bl = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3;
      return clamp(vec3(r, g, bl), 0.0, 1.0);
    }
    float cubicBezier(float x, vec4 curve) {
      if (x <= 0.0) return 0.0;
      if (x >= 1.0) return 1.0;
      float t0 = 0.0;
      float t1 = 1.0;
      for (int i = 0; i < 10; i++) {
        float t = (t0 + t1) * 0.5;
        float u = 1.0 - t;
        float tt = t * t;
        float uu = u * u;
        float xt = 3.0 * uu * t * curve.x + 3.0 * u * tt * curve.z + tt * t;
        if (xt < x) t0 = t; else t1 = t;
      }
      float t = (t0 + t1) * 0.5;
      float u = 1.0 - t;
      float tt = t * t;
      float uu = u * u;
      return 3.0 * uu * t * curve.y + 3.0 * u * tt * curve.w + tt * t;
    }
  `,
  mainCode: `
    float value = clamp($input.in, 0.0, 1.0);
    float lT = cubicBezier(value, $input.lCurve);
    float cT = cubicBezier(value, $input.cCurve);
    float hT = cubicBezier(value, $input.hCurve);
    float l = mix($param.startColorL, $param.endColorL, lT);
    float c = mix($param.startColorC, $param.endColorC, cT);
    float startH = $param.startColorH;
    float endH = $param.endColorH;
    float adjustedEndH;
    if ($param.reverseHue > 0) {
      adjustedEndH = (endH > startH) ? endH - 360.0 : endH;
    } else {
      adjustedEndH = (endH < startH) ? endH + 360.0 : endH;
    }
    float h = mix(startH, adjustedEndH, hT);
    h = mod(h, 360.0);
    if (h < 0.0) h += 360.0;
    vec3 oklch = vec3(l, c, h);
    $output.out = oklchToRgb(oklch);
  `
};
