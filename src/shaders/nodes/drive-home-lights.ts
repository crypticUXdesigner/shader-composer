import type { NodeSpec } from '../../types/nodeSpec';

/**
 * Drive home lights: compound bokeh lights (street, head, tail, environment).
 * Reference: Shadertoy "The Drive Home" (ltfXzj) — fixed loops over
 * StreetLights, HeadLights, TailLights, EnvironmentLights + sky term.
 */
export const driveHomeLightsNodeSpec: NodeSpec = {
  id: 'drive-home-lights',
  category: 'Shapes',
  displayName: 'Drive Home Lights',
  description:
    'Bokeh-style night drive lights: street lights, headlights, tail/brake lights, and environment lights in one node. Connect ro/rd from Look-at Camera and time. Reference: Shadertoy The Drive Home.',
  icon: 'car',
  inputs: [
    { name: 'ro', type: 'vec3', label: 'Ray origin' },
    { name: 'rd', type: 'vec3', label: 'Ray direction' },
    {
      name: 'time',
      type: 'float',
      label: 'Time',
      fallbackExpression: '$time'
    }
  ],
  outputs: [{ name: 'out', type: 'vec3', label: 'Color' }],
  parameters: {
    timeScale: {
      type: 'float',
      default: 0.03,
      min: 0.0,
      max: 0.2,
      step: 0.005,
      label: 'Time scale'
    },
    laneBias: {
      type: 'float',
      default: 0.5,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Lane bias'
    }
  },
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        parameters: ['timeScale', 'laneBias'],
        layout: { columns: 2 }
      }
    ]
  },
  functions: `
// Colors inlined (compiler only emits function bodies; top-level const would be dropped)
float dhl_N(float t) {
  return fract(sin(t * 10234.324) * 123423.23512);
}
vec3 dhl_N31(float p) {
  vec3 p3 = fract(vec3(p) * vec3(0.1031, 0.11369, 0.13787));
  p3 += dot(p3, p3.yzx + 19.19);
  return fract(vec3((p3.x + p3.y) * p3.z, (p3.x + p3.z) * p3.y, (p3.y + p3.z) * p3.x));
}
float dhl_DistLine(vec3 ro, vec3 rd, vec3 p) {
  return length(cross(p - ro, rd));
}
float dhl_Remap(float a, float b, float c, float d, float t) {
  return ((t - a) / (b - a)) * (d - c) + c;
}
float dhl_Bokeh(vec3 ro, vec3 rd, vec3 p, float size, float blur) {
  float d = dhl_DistLine(ro, rd, p);
  float m = smoothstep(size, size * (1.0 - blur), d);
  m *= mix(0.7, 1.0, smoothstep(0.8 * size, size, d));
  return m;
}

vec3 dhl_StreetLights(vec3 ro, vec3 rd, float i, float t) {
  float side = sign(rd.x);
  float offset = max(side, 0.0) * (1.0 / 16.0);
  float z = fract(i - t + offset);
  vec3 p = vec3(2.0 * side, 2.0, z * 60.0);
  float distFade = dhl_Remap(1.0, 0.7, 0.1, 1.5, 1.0 - pow(1.0 - z, 6.0));
  distFade *= (1.0 - z);
  float m = dhl_Bokeh(ro, rd, p, 0.05 * length(p - ro), 0.1) * distFade;
  return m * vec3(1.0, 0.7, 0.3);
}

vec3 dhl_HeadLights(vec3 ro, vec3 rd, float i, float t) {
  float z = fract(-t * 2.0 + i);
  vec3 p = vec3(-0.3, 0.1, z * 40.0);
  float d = length(p - ro);
  float size = mix(0.03, 0.05, smoothstep(0.02, 0.07, z)) * d;
  float blur = 0.1;
  float m = 0.0;
  m += dhl_Bokeh(ro, rd, p - vec3(0.08, 0.0, 0.0), size, blur);
  m += dhl_Bokeh(ro, rd, p + vec3(0.08, 0.0, 0.0), size, blur);
  m += dhl_Bokeh(ro, rd, p + vec3(0.1, 0.0, 0.0), size, blur);
  m += dhl_Bokeh(ro, rd, p - vec3(0.1, 0.0, 0.0), size, blur);
  float distFade = max(0.01, pow(1.0 - z, 9.0));
  blur = 0.8;
  size *= 2.5;
  float r = 0.0;
  r += dhl_Bokeh(ro, rd, p + vec3(-0.09, -0.2, 0.0), size, blur);
  r += dhl_Bokeh(ro, rd, p + vec3(0.09, -0.2, 0.0), size, blur);
  r *= distFade * distFade;
  return vec3(0.8, 0.8, 1.0) * (m + r) * distFade;
}

vec3 dhl_TailLights(vec3 ro, vec3 rd, float offset, float t, float laneBias) {
  t = t * 1.5 + offset;
  float id = floor(t) + offset;
  vec3 n = dhl_N31(id);
  float laneId = smoothstep(laneBias, laneBias + 0.01, n.y);
  float ft = fract(t);
  float z = 3.0 - ft * 3.0;
  laneId *= smoothstep(0.2, 1.5, z);
  float lane = mix(0.6, 0.3, laneId);
  vec3 p = vec3(lane, 0.1, z);
  float size = 0.05 * length(p - ro);
  float blur = 0.1;
  float m = dhl_Bokeh(ro, rd, p - vec3(0.08, 0.0, 0.0), size, blur) + dhl_Bokeh(ro, rd, p + vec3(0.08, 0.0, 0.0), size, blur);
  float bs = n.z * 3.0;
  float brake = smoothstep(bs, bs + 0.01, z) * smoothstep(bs + 0.01, bs, z - 0.5 * n.y);
  m += (dhl_Bokeh(ro, rd, p + vec3(0.1, 0.0, 0.0), size, blur) + dhl_Bokeh(ro, rd, p - vec3(0.1, 0.0, 0.0), size, blur)) * brake;
  float refSize = size * 2.5;
  m += dhl_Bokeh(ro, rd, p + vec3(-0.09, -0.2, 0.0), refSize, 0.8);
  m += dhl_Bokeh(ro, rd, p + vec3(0.09, -0.2, 0.0), refSize, 0.8);
  vec3 col = vec3(1.0, 0.1, 0.1) * m * ft;
  float b = dhl_Bokeh(ro, rd, p + vec3(0.12, 0.0, 0.0), size, blur);
  b += dhl_Bokeh(ro, rd, p + vec3(0.12, -0.2, 0.0), refSize, 0.8) * 0.2;
  vec3 blinker = vec3(1.0, 0.7, 0.2);
  blinker *= smoothstep(1.5, 1.4, z) * smoothstep(0.2, 0.3, z);
  blinker *= clamp(sin(t * 200.0) * 100.0, 0.0, 1.0);
  blinker *= laneId;
  col += blinker * b;
  return col;
}

vec3 dhl_EnvironmentLights(vec3 ro, vec3 rd, float i, float t) {
  float n = dhl_N(i + floor(t));
  float side = sign(rd.x);
  float offset = max(side, 0.0) * (1.0 / 16.0);
  float z = fract(i - t + offset + fract(n * 234.0));
  float n2 = fract(n * 100.0);
  vec3 p = vec3((3.0 + n) * side, n2 * n2 * n2 * 1.0, z * 60.0);
  float distFade = dhl_Remap(1.0, 0.7, 0.1, 1.5, 1.0 - pow(1.0 - z, 6.0));
  float m = dhl_Bokeh(ro, rd, p, 0.05 * length(p - ro), 0.1);
  m *= distFade * distFade * 0.5;
  m *= 1.0 - pow(sin(z * 6.2831853 * 20.0 * n) * 0.5 + 0.5, 20.0);
  vec3 randomCol = vec3(fract(n * -34.5), fract(n * 4572.0), fract(n * 1264.0));
  vec3 col = mix(vec3(1.0, 0.1, 0.1), vec3(1.0, 0.7, 0.3), fract(n * -65.42));
  col = mix(col, randomCol, n);
  return m * col * 0.2;
}
`,
  mainCode: `
  vec3 ro = $input.ro;
  vec3 rd = $input.rd;
  float t = $input.time * $param.timeScale;
  vec3 col = vec3(0.0);
  const float stp8 = 0.125;
  const float stp16 = 0.0625;
  for (float i = 0.0; i < 1.0; i += stp8) {
    col += dhl_StreetLights(ro, rd, i, t);
  }
  for (float i = 0.0; i < 1.0; i += stp8) {
    float n = dhl_N(i + floor(t));
    col += dhl_HeadLights(ro, rd, i + n * stp8 * 0.7, t);
  }
  for (float i = 0.0; i < 1.0; i += stp16) {
    col += dhl_EnvironmentLights(ro, rd, i, t);
  }
  col += dhl_TailLights(ro, rd, 0.0, t, $param.laneBias);
  col += dhl_TailLights(ro, rd, 0.5, t, $param.laneBias);
  col += clamp(rd.y, 0.0, 1.0) * vec3(0.6, 0.5, 0.9);
  $output.out = col;
`
};
