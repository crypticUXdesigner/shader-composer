import type { NodeSpec } from '../../types';

/**
 * Reaction-diffusion (Gray-Scott style) pattern node.
 * Single-pass, 2 explicit steps from a noise seed for organic blob/cell patterns.
 * Parameter groups: Reaction (feed/kill), Diffusion, Simulation (scale, steps, time), Output.
 */
export const reactionDiffusionNodeSpec: NodeSpec = {
  id: 'reaction-diffusion',
  category: 'Patterns',
  displayName: 'Reaction-Diffusion',
  description:
    'Gray-Scott-style reaction-diffusion for organic blob and cell patterns. Uses 1–2 simulation steps per pixel; output float 0–1 for color map.',
  icon: 'grain',
  inputs: [
    {
      name: 'in',
      type: 'vec2'
    }
  ],
  outputs: [
    {
      name: 'out',
      type: 'float'
    }
  ],
  parameters: {
    feedRate: {
      type: 'float',
      default: 0.055,
      min: 0.0,
      max: 0.1,
      step: 0.001,
      label: 'Feed'
    },
    killRate: {
      type: 'float',
      default: 0.062,
      min: 0.0,
      max: 0.1,
      step: 0.001,
      label: 'Kill'
    },
    diffusionA: {
      type: 'float',
      default: 1.0,
      min: 0.1,
      max: 2.0,
      step: 0.01,
      label: 'Diff. A'
    },
    diffusionB: {
      type: 'float',
      default: 0.5,
      min: 0.01,
      max: 1.0,
      step: 0.01,
      label: 'Diff. B'
    },
    scale: {
      type: 'float',
      default: 80.0,
      min: 10.0,
      max: 200.0,
      step: 1.0,
      label: 'Scale'
    },
    steps: {
      type: 'int',
      default: 2,
      min: 1,
      max: 2,
      step: 1,
      label: 'Steps'
    },
    timeSpeed: {
      type: 'float',
      default: 0.3,
      min: 0.0,
      max: 2.0,
      step: 0.01,
      label: 'Time Speed'
    },
    intensity: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 2.0,
      step: 0.01,
      label: 'Intensity'
    }
  },
  parameterGroups: [
    {
      id: 'reaction-diffusion-reaction',
      label: 'Reaction',
      parameters: ['feedRate', 'killRate'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'reaction-diffusion-diffusion',
      label: 'Diffusion',
      parameters: ['diffusionA', 'diffusionB'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'reaction-diffusion-simulation',
      label: 'Simulation',
      parameters: ['scale', 'steps', 'timeSpeed'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'reaction-diffusion-output',
      label: 'Output',
      parameters: ['intensity'],
      collapsible: true,
      defaultCollapsed: false
    }
  ],
  functions: `
// Hash for seeding concentrations (0..1)
float rdHash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

// Seed U (prey) and V (activator) from position + time
void rdSeed(vec2 p, float t, out float U, out float V) {
  float h1 = rdHash21(p);
  float h2 = rdHash21(p + vec2(17.3, 31.7));
  float h3 = rdHash21(p + t);
  U = 0.85 + 0.15 * h1;
  V = 0.1 + 0.25 * h2 * (0.9 + 0.1 * sin(t + h3 * 6.28));
}

// 5-point Laplacian stencil: (E+W+N+S - 4*C) / dx2
float rdLap(float c, float e, float w, float n, float s, float dx2) {
  return (e + w + n + s - 4.0 * c) / dx2;
}

// Gray-Scott one step: dU = Du*lapU - U*V*V + F*(1-U), dV = Dv*lapV + U*V*V - (F+K)*V
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
  float t = $time * $param.timeSpeed;
  float F = $param.feedRate;
  float K = $param.killRate;
  float Du = $param.diffusionA * 0.01;
  float Dv = $param.diffusionB * 0.01;
  float dt = 0.8;
  float dx = 1.0;
  float dx2 = dx * dx;

  // Stencil offsets in simulation space
  vec2 oE = vec2(dx, 0.0);
  vec2 oW = vec2(-dx, 0.0);
  vec2 oN = vec2(0.0, dx);
  vec2 oS = vec2(0.0, -dx);

  float U0, V0, Uc, Vc;
  rdSeed(uv, t, Uc, Vc);
  float Ue, Ve, Uw, Vw, Un, Vn, Us, Vs;
  rdSeed(uv + oE, t, Ue, Ve);
  rdSeed(uv + oW, t, Uw, Vw);
  rdSeed(uv + oN, t, Un, Vn);
  rdSeed(uv + oS, t, Us, Vs);

  float lapU = rdLap(Uc, Ue, Uw, Un, Us, dx2);
  float lapV = rdLap(Vc, Ve, Vw, Vn, Vs, dx2);
  float U1, V1;
  rdStep(Uc, Vc, lapU, lapV, F, K, Du, Dv, dt, U1, V1);

  float outVal = V1;
  if ($param.steps >= 2) {
    float U1e, V1e, U1w, V1w, U1n, V1n, U1s, V1s;
    vec2 uvE = uv + oE, uvW = uv + oW, uvN = uv + oN, uvS = uv + oS;
    float U0ee, V0ee, U0we, V0we, U0nw, V0nw, U0sw, V0sw, U0nn, V0nn, U0sn, V0sn, U0ne, V0ne, U0se, V0se;
    rdSeed(uvE + oE, t, U0ee, V0ee);
    rdSeed(uvW + oE, t, U0we, V0we);
    rdSeed(uvN + oW, t, U0nw, V0nw);
    rdSeed(uvS + oW, t, U0sw, V0sw);
    rdSeed(uvN + oN, t, U0nn, V0nn);
    rdSeed(uvS + oN, t, U0sn, V0sn);
    rdSeed(uvN + oE, t, U0ne, V0ne);
    rdSeed(uvS + oE, t, U0se, V0se);
    float lapUe = rdLap(Ue, U0ee, Uc, U0ne, U0se, dx2);
    float lapVe = rdLap(Ve, V0ee, Vc, V0ne, V0se, dx2);
    float lapUw = rdLap(Uw, Uc, U0we, U0nw, U0sw, dx2);
    float lapVw = rdLap(Vw, Vc, V0we, V0nw, V0sw, dx2);
    float lapUn = rdLap(Un, U0ne, U0nw, U0nn, Uc, dx2);
    float lapVn = rdLap(Vn, V0ne, V0nw, V0nn, Vc, dx2);
    float lapUs = rdLap(Us, U0se, U0sw, U0sn, Uc, dx2);
    float lapVs = rdLap(Vs, V0se, V0sw, V0sn, Vc, dx2);
    rdStep(Ue, Ve, lapUe, lapVe, F, K, Du, Dv, dt, U1e, V1e);
    rdStep(Uw, Vw, lapUw, lapVw, F, K, Du, Dv, dt, U1w, V1w);
    rdStep(Un, Vn, lapUn, lapVn, F, K, Du, Dv, dt, U1n, V1n);
    rdStep(Us, Vs, lapUs, lapVs, F, K, Du, Dv, dt, U1s, V1s);
    float lapU1 = rdLap(U1, U1e, U1w, U1n, U1s, dx2);
    float lapV1 = rdLap(V1, V1e, V1w, V1n, V1s, dx2);
    float U2, V2;
    rdStep(U1, V1, lapU1, lapV1, F, K, Du, Dv, dt, U2, V2);
    outVal = V2;
  }

  $output.out += clamp(outVal * $param.intensity, 0.0, 1.0);
`
};
