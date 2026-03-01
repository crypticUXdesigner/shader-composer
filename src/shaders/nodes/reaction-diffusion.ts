import type { NodeSpec } from '../../types/nodeSpec';

/**
 * Reaction-diffusion (Gray-Scott style) pattern node.
 * Single-pass, spot-based seed and 1–5 steps for cell/spot patterns.
 * Note: True R-D (Turing patterns) needs many iterations (e.g. ping-pong buffers); this is an approximation.
 */
export const reactionDiffusionNodeSpec: NodeSpec = {
  id: 'reaction-diffusion',
  category: 'Patterns',
  displayName: 'Reaction-Diff',
  description:
    'Gray-Scott-inspired cell/spot pattern. Spot-based seed and 1–5 simulation steps per pixel (single-pass). Feed/kill and Diff A/B use wider ranges for exploration. Time speed 0–5 scales animation linearly. Output float 0–1 for color map.',
  icon: 'cell',
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
      type: 'float',
      label: 'Color'
    }
  ],
  parameters: {
    feedRate: {
      type: 'float',
      default: 0.055,
      min: 0.01,
      max: 0.15,
      step: 0.001,
      label: 'Feed'
    },
    killRate: {
      type: 'float',
      default: 0.062,
      min: 0.01,
      max: 0.15,
      step: 0.001,
      label: 'Kill'
    },
    diffusionA: {
      type: 'float',
      default: 1.0,
      min: 0.1,
      max: 4.0,
      step: 0.05,
      label: 'Diff. A'
    },
    diffusionB: {
      type: 'float',
      default: 0.5,
      min: 0.05,
      max: 1.5,
      step: 0.01,
      label: 'Diff. B'
    },
    scale: {
      type: 'float',
      default: 80.0,
      min: 10.0,
      max: 200.0,
      step: 0.1,
      label: 'Scale'
    },
    steps: {
      type: 'int',
      default: 3,
      min: 1,
      max: 5,
      step: 1,
      label: 'Steps'
    },
    timeSpeed: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 5.0,
      step: 0.05,
      label: 'Time Speed'
    },
    timeOffset: {
      type: 'float',
      default: 0.0,
      min: -100.0,
      max: 100.0,
      step: 0.05,
      label: 'Time Offset'
    },
    intensity: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 2.0,
      step: 0.01,
      label: 'Intensity'
    },
    grainAmount: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Grain'
    }
  },
  parameterGroups: [
    {
      id: 'reaction-diffusion-reaction-diffusion',
      label: 'Reaction & Diffusion',
      parameters: ['feedRate', 'killRate', 'diffusionA', 'diffusionB'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'reaction-diffusion-simulation',
      label: 'Simulation',
      parameters: ['scale', 'intensity', 'steps'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'reaction-diffusion-animation',
      label: 'Animation',
      parameters: ['timeSpeed', 'timeOffset', 'grainAmount'],
      collapsible: true,
      defaultCollapsed: true
    }
  ],
  parameterLayout: {
    minColumns: 2,
    elements: [
      {
        type: 'grid',
        parameters: ['feedRate', 'killRate', 'diffusionA', 'diffusionB'],
        layout: { columns: 2 }
      },
      {
        type: 'grid',
        label: 'Simulation',
        parameters: ['scale', 'intensity', 'steps'],
        layout: { columns: 2, parameterSpan: { steps: 2 } }
      },
      {
        type: 'grid',
        label: 'Animation',
        parameters: ['timeSpeed', 'timeOffset', 'grainAmount'],
        layout: { columns: 2, parameterSpan: { grainAmount: 2 } }
      }
    ]
  },
  functions: `
// Hash for seeding (0..1)
float rdHash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}
vec2 rdHash22(vec2 p) {
  return vec2(rdHash21(p), rdHash21(p + vec2(17.3, 31.7)));
}

// Spot-based seed: grid of cells with activator blobs. t drives smooth motion so timeSpeed scales linearly.
void rdSeed(vec2 p, float t, float grain, out float U, out float V) {
  float cellSize = 2.5;
  vec2 cell = floor(p / cellSize);
  vec2 cellCenter = (cell + 0.5) * cellSize;
  float phase = rdHash21(cell) * 6.283185;
  float angle = t;
  vec2 jitter = vec2(sin(angle + phase), cos(angle * 1.1 + phase)) * (cellSize * 0.35);
  cellCenter += jitter;
  float d = length(p - cellCenter);
  float spot = 1.0 - smoothstep(0.15, 0.55, d);
  V = clamp(0.08 + 0.85 * spot + grain * (rdHash21(p + t) - 0.5), 0.0, 1.0);
  U = clamp(0.92 - 0.18 * spot + 0.06 * (rdHash21(p + 13.7) - 0.5), 0.0, 1.0);
}

// 5-point Laplacian stencil: (E+W+N+S - 4*C) / dx2
float rdLap(float c, float e, float w, float n, float s, float dx2) {
  return (e + w + n + s - 4.0 * c) / dx2;
}

// Gray-Scott one step
void rdStep(float U, float V, float lapU, float lapV, float F, float K, float Du, float Dv, float dt,
            out float Unew, out float Vnew) {
  float r = U * V * V;
  Unew = U + dt * (Du * lapU - r + F * (1.0 - U));
  Vnew = V + dt * (Dv * lapV + r - (F + K) * V);
  Unew = clamp(Unew, 0.0, 1.0);
  Vnew = clamp(Vnew, 0.0, 1.0);
}
`,
  mainCode: `
  vec2 uv = $input.in * $param.scale;
  float t = ($time + $param.timeOffset) * $param.timeSpeed;
  float grain = $param.grainAmount;
  float F = $param.feedRate;
  float K = $param.killRate;
  float Du = $param.diffusionA * 0.01;
  float Dv = $param.diffusionB * 0.01;
  float dt = 1.0;
  float dx = 1.0;
  float dx2 = dx * dx;

  vec2 oE = vec2(dx, 0.0);
  vec2 oW = vec2(-dx, 0.0);
  vec2 oN = vec2(0.0, dx);
  vec2 oS = vec2(0.0, -dx);

  float Uc, Vc, Ue, Ve, Uw, Vw, Un, Vn, Us, Vs;
  rdSeed(uv, t, grain, Uc, Vc);
  rdSeed(uv + oE, t, grain, Ue, Ve);
  rdSeed(uv + oW, t, grain, Uw, Vw);
  rdSeed(uv + oN, t, grain, Un, Vn);
  rdSeed(uv + oS, t, grain, Us, Vs);

  float lapU = rdLap(Uc, Ue, Uw, Un, Us, dx2);
  float lapV = rdLap(Vc, Ve, Vw, Vn, Vs, dx2);
  float U1, V1;
  rdStep(Uc, Vc, lapU, lapV, F, K, Du, Dv, dt, U1, V1);

  float outVal = V1;
  if ($param.steps >= 2) {
    vec2 uvE = uv + oE, uvW = uv + oW, uvN = uv + oN, uvS = uv + oS;
    float U0ee, V0ee, U0we, V0we, U0nw, V0nw, U0sw, V0sw, U0nn, V0nn, U0sn, V0sn, U0ne, V0ne, U0se, V0se;
    rdSeed(uvE + oE, t, grain, U0ee, V0ee);
    rdSeed(uvW + oE, t, grain, U0we, V0we);
    rdSeed(uvN + oW, t, grain, U0nw, V0nw);
    rdSeed(uvS + oW, t, grain, U0sw, V0sw);
    rdSeed(uvN + oN, t, grain, U0nn, V0nn);
    rdSeed(uvS + oN, t, grain, U0sn, V0sn);
    rdSeed(uvN + oE, t, grain, U0ne, V0ne);
    rdSeed(uvS + oE, t, grain, U0se, V0se);
    float lapUe = rdLap(Ue, U0ee, Uc, U0ne, U0se, dx2);
    float lapVe = rdLap(Ve, V0ee, Vc, V0ne, V0se, dx2);
    float lapUw = rdLap(Uw, Uc, U0we, U0nw, U0sw, dx2);
    float lapVw = rdLap(Vw, Vc, V0we, V0nw, V0sw, dx2);
    float lapUn = rdLap(Un, U0ne, U0nw, U0nn, Uc, dx2);
    float lapVn = rdLap(Vn, V0ne, V0nw, V0nn, Vc, dx2);
    float lapUs = rdLap(Us, U0se, U0sw, U0sn, Uc, dx2);
    float lapVs = rdLap(Vs, V0se, V0sw, V0sn, Vc, dx2);
    float U1e, V1e, U1w, V1w, U1n, V1n, U1s, V1s;
    rdStep(Ue, Ve, lapUe, lapVe, F, K, Du, Dv, dt, U1e, V1e);
    rdStep(Uw, Vw, lapUw, lapVw, F, K, Du, Dv, dt, U1w, V1w);
    rdStep(Un, Vn, lapUn, lapVn, F, K, Du, Dv, dt, U1n, V1n);
    rdStep(Us, Vs, lapUs, lapVs, F, K, Du, Dv, dt, U1s, V1s);
    float lapU1 = rdLap(U1, U1e, U1w, U1n, U1s, dx2);
    float lapV1 = rdLap(V1, V1e, V1w, V1n, V1s, dx2);
    float U2, V2;
    rdStep(U1, V1, lapU1, lapV1, F, K, Du, Dv, dt, U2, V2);
    outVal = V2;

    if ($param.steps >= 3) {
      float U3e, V3e, U3w, V3w, U3n, V3n, U3s, V3s;
      rdSeed(uv + 3.0*oE, t, grain, U3e, V3e);
      rdSeed(uv + 3.0*oW, t, grain, U3w, V3w);
      rdSeed(uv + 3.0*oN, t, grain, U3n, V3n);
      rdSeed(uv + 3.0*oS, t, grain, U3s, V3s);
      float U0ww, V0ww, U0wwn, V0wwn, U0wws, V0wws;
      float U0ss, V0ss, U0sse, V0sse, U0ssw, V0ssw;
      float U0nnw, V0nnw, U0en2, V0en2, U0e2n, V0e2n, U0es2, V0es2, U0e2s, V0e2s;
      rdSeed(uvW + oW, t, grain, U0ww, V0ww);
      rdSeed(uvW + oW + oN, t, grain, U0wwn, V0wwn);
      rdSeed(uvW + oW + oS, t, grain, U0wws, V0wws);
      rdSeed(uvS + oS, t, grain, U0ss, V0ss);
      rdSeed(uvS + oS + oE, t, grain, U0sse, V0sse);
      rdSeed(uvS + oS + oW, t, grain, U0ssw, V0ssw);
      rdSeed(uvN + oN + oW, t, grain, U0nnw, V0nnw);
      rdSeed(uvN + oN + oE, t, grain, U0en2, V0en2);
      rdSeed(uvE + oE + oN, t, grain, U0e2n, V0e2n);
      rdSeed(uvS + oS + oE, t, grain, U0es2, V0es2);
      rdSeed(uvE + oE + oS, t, grain, U0e2s, V0e2s);
      float lapUee = rdLap(U0ee, U3e, Ue, U0ne, U0se, dx2);
      float lapVee = rdLap(V0ee, V3e, Ve, V0ne, V0se, dx2);
      float U1ee, V1ee, U1nn, V1nn, U1ss, V1ss, U1we, V1we;
      rdStep(U0ee, V0ee, lapUee, lapVee, F, K, Du, Dv, dt, U1ee, V1ee);
      float lapUww = rdLap(U0ww, Uw, U3w, U0wwn, U0wws, dx2);
      float lapVww = rdLap(V0ww, Vw, V3w, V0wwn, V0wws, dx2);
      rdStep(U0ww, V0ww, lapUww, lapVww, F, K, Du, Dv, dt, U1we, V1we);
      float lapUnn = rdLap(U0nn, U0en2, U0nnw, U3n, Un, dx2);
      float lapVnn = rdLap(V0nn, V0en2, V0nnw, V3n, Vn, dx2);
      rdStep(U0nn, V0nn, lapUnn, lapVnn, F, K, Du, Dv, dt, U1nn, V1nn);
      float lapUss = rdLap(U0ss, U0sse, U0ssw, U3s, Us, dx2);
      float lapVss = rdLap(V0ss, V0sse, V0ssw, V3s, Vs, dx2);
      rdStep(U0ss, V0ss, lapUss, lapVss, F, K, Du, Dv, dt, U1ss, V1ss);
      float lapUne = rdLap(U0ne, U0en2, Ue, U0e2n, Un, dx2);
      float lapVne = rdLap(V0ne, V0en2, Ve, V0e2n, Vn, dx2);
      float U1ne, V1ne, U1se, V1se, U1nw, V1nw, U1sw, V1sw;
      rdStep(U0ne, V0ne, lapUne, lapVne, F, K, Du, Dv, dt, U1ne, V1ne);
      float lapUse = rdLap(U0se, U0es2, Ue, U0e2s, Us, dx2);
      float lapVse = rdLap(V0se, V0es2, Ve, V0e2s, Vs, dx2);
      rdStep(U0se, V0se, lapUse, lapVse, F, K, Du, Dv, dt, U1se, V1se);
      float lapUnw = rdLap(U0nw, Uc, U0wwn, U0nnw, Uw, dx2);
      float lapVnw = rdLap(V0nw, Vc, V0wwn, V0nnw, Vw, dx2);
      rdStep(U0nw, V0nw, lapUnw, lapVnw, F, K, Du, Dv, dt, U1nw, V1nw);
      float lapUsw = rdLap(U0sw, U0ssw, Uw, Us, U0sw, dx2);
      float lapVsw = rdLap(V0sw, V0ssw, Vw, Vs, V0sw, dx2);
      rdStep(U0sw, V0sw, lapUsw, lapVsw, F, K, Du, Dv, dt, U1sw, V1sw);
      float lapU2 = rdLap(U2, U1ee, U1we, U1nn, U1ss, dx2);
      float lapV2 = rdLap(V2, V1ee, V1we, V1nn, V1ss, dx2);
      float U3, V3;
      rdStep(U2, V2, lapU2, lapV2, F, K, Du, Dv, dt, U3, V3);
      outVal = V3;

      if ($param.steps >= 4) {
        float U2ee, V2ee, U2we, V2we, U2nn, V2nn, U2ss, V2ss;
        rdStep(U1ee, V1ee, lapUee, lapVee, F, K, Du, Dv, dt, U2ee, V2ee);
        rdStep(U1we, V1we, lapUww, lapVww, F, K, Du, Dv, dt, U2we, V2we);
        rdStep(U1nn, V1nn, lapUnn, lapVnn, F, K, Du, Dv, dt, U2nn, V2nn);
        rdStep(U1ss, V1ss, lapUss, lapVss, F, K, Du, Dv, dt, U2ss, V2ss);
        float U2ne, V2ne, U2se, V2se, U2nw, V2nw, U2sw, V2sw;
        rdStep(U1ne, V1ne, lapUne, lapVne, F, K, Du, Dv, dt, U2ne, V2ne);
        rdStep(U1se, V1se, lapUse, lapVse, F, K, Du, Dv, dt, U2se, V2se);
        rdStep(U1nw, V1nw, lapUnw, lapVnw, F, K, Du, Dv, dt, U2nw, V2nw);
        rdStep(U1sw, V1sw, lapUsw, lapVsw, F, K, Du, Dv, dt, U2sw, V2sw);
        float lapU1e = rdLap(U1e, U1ee, U1, U1ne, U1se, dx2);
        float lapV1e = rdLap(V1e, V1ee, V1, V1ne, V1se, dx2);
        float U2e, V2e, U2w, V2w, U2n, V2n, U2s, V2s;
        rdStep(U1e, V1e, lapU1e, lapV1e, F, K, Du, Dv, dt, U2e, V2e);
        float lapU1w = rdLap(U1w, U1, U1we, U1nw, U1sw, dx2);
        float lapV1w = rdLap(V1w, V1, V1we, V1nw, V1sw, dx2);
        rdStep(U1w, V1w, lapU1w, lapV1w, F, K, Du, Dv, dt, U2w, V2w);
        float lapU1n = rdLap(U1n, U1ne, U1nw, U1nn, U1, dx2);
        float lapV1n = rdLap(V1n, V1ne, V1nw, V1nn, V1, dx2);
        rdStep(U1n, V1n, lapU1n, lapV1n, F, K, Du, Dv, dt, U2n, V2n);
        float lapU1s = rdLap(U1s, U1se, U1sw, U1, U1ss, dx2);
        float lapV1s = rdLap(V1s, V1se, V1sw, V1, V1ss, dx2);
        rdStep(U1s, V1s, lapU1s, lapV1s, F, K, Du, Dv, dt, U2s, V2s);
        float lapU2e = rdLap(U2e, U2ee, U2, U2ne, U2se, dx2);
        float lapV2e = rdLap(V2e, V2ee, V2, V2ne, V2se, dx2);
        float U3e, V3e, U3w, V3w, U3n, V3n, U3s, V3s;
        rdStep(U2e, V2e, lapU2e, lapV2e, F, K, Du, Dv, dt, U3e, V3e);
        float lapU2w = rdLap(U2w, U2, U2we, U2nw, U2sw, dx2);
        float lapV2w = rdLap(V2w, V2, V2we, V2nw, V2sw, dx2);
        rdStep(U2w, V2w, lapU2w, lapV2w, F, K, Du, Dv, dt, U3w, V3w);
        float lapU2n = rdLap(U2n, U2ne, U2nw, U2nn, U2, dx2);
        float lapV2n = rdLap(V2n, V2ne, V2nw, V2nn, V2, dx2);
        rdStep(U2n, V2n, lapU2n, lapV2n, F, K, Du, Dv, dt, U3n, V3n);
        float lapU2s = rdLap(U2s, U2se, U2sw, U2, U2ss, dx2);
        float lapV2s = rdLap(V2s, V2se, V2sw, V2, V2ss, dx2);
        rdStep(U2s, V2s, lapU2s, lapV2s, F, K, Du, Dv, dt, U3s, V3s);
        float lapU3 = rdLap(U3, U3e, U3w, U3n, U3s, dx2);
        float lapV3 = rdLap(V3, V3e, V3w, V3n, V3s, dx2);
        float U4, V4;
        rdStep(U3, V3, lapU3, lapV3, F, K, Du, Dv, dt, U4, V4);
        outVal = V4;

        if ($param.steps >= 5) {
          float lapU4 = rdLap(U4, U3e, U3w, U3n, U3s, dx2);
          float lapV4 = rdLap(V4, V3e, V3w, V3n, V3s, dx2);
          float U5, V5;
          rdStep(U4, V4, lapU4, lapV4, F, K, Du, Dv, dt, U5, V5);
          outVal = V5;
        }
      }
    }
  }

  $output.out += clamp(outVal * $param.intensity, 0.0, 1.0);
`
};
