import type { NodeSpec } from '../../types/nodeSpec';

export const bokehNodeSpec: NodeSpec = {
  id: 'bokeh',
  category: 'Effects',
  displayName: 'Bokeh',
  description:
    'WebGPU: multipass iris-shaped blur when wired directly before Final Output; otherwise a single-pass WGSL stub (matches WebGL) so the node composes in-blend chains. WebGL: quick lens highlight with angular blades. Distinct from Bokeh Point (scene lights).',
  icon: 'aperture',
  inputs: [{ name: 'in', type: 'vec4', label: 'Color' }],
  outputs: [{ name: 'out', type: 'vec4', label: 'Color' }],
  parameters: {
    bokehThreshold: {
      type: 'float',
      default: 0.75,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Threshold',
    },
    bokehIntensity: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 5.0,
      step: 0.1,
      label: 'Intensity',
    },
    bokehRadius: {
      type: 'float',
      default: 8.0,
      min: 0.0,
      max: 40.0,
      step: 0.25,
      label: 'Radius',
    },
    bokehStrength: {
      type: 'float',
      default: 0.65,
      min: 0.0,
      max: 2.0,
      step: 0.01,
      label: 'Strength',
    },
    bokehBlades: {
      type: 'int',
      default: 6,
      min: 3,
      max: 12,
      step: 1,
      label: 'Blades',
    },
    bokehRotation: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 360.0,
      step: 1.0,
      label: 'Rotation',
    },
  },
  functions: `
float bokehBright(float v, float threshold, float intensity) {
  return max(0.0, v - threshold) * intensity;
}
`,
  mainCode: `
  vec4 inColor = $input.in;
  vec3 color = inColor.rgb;
  float lum = dot(color, vec3(0.2126, 0.7152, 0.0722));

  vec2 pc = ((gl_FragCoord.xy / $resolution.xy * 2.0 - 1.0) * vec2($resolution.x / $resolution.y, 1.0));
  float blades = float(max($param.bokehBlades, 3));
  float a = atan(pc.y, pc.x) + radians($param.bokehRotation);
  float irisMod = clamp(0.55 + 0.45 * abs(cos(blades * a)), 0.2, 1.4);

  float b = bokehBright(lum, $param.bokehThreshold, $param.bokehIntensity)
    * irisMod
    * clamp(1.05 + $param.bokehRadius * 0.012, 0.5, 1.8);
  float blended = lum + b * $param.bokehStrength;
  vec3 rgb = lum > 1e-4 ? clamp(color * (blended / lum), 0.0, 1.0) : vec3(blended);

  $output.out = vec4(rgb, inColor.a);
`,
};

