import type { NodeSpec } from '../../types/nodeSpec';

export const ringsNodeSpec: NodeSpec = {
  id: 'rings',
  category: 'Patterns',
  displayName: 'Rings',
  description: 'Concentric rings or ripples; smooth bands or line mode with falloff',
  icon: 'rings',
  inputs: [
    {
      name: 'in',
      type: 'vec2',
      label: 'Position'
    }
  ],
  outputs: [
    {
      name: 'out',
      type: 'float',
      label: 'Value'
    }
  ],
  parameters: {
    ringCenterX: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.1,
      label: 'Center X',
      knobPolarity: 'two-sided'
    },
    ringCenterY: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.1,
      label: 'Center Y',
      knobPolarity: 'two-sided'
    },
    ringDistanceScale: {
      type: 'float',
      default: 1.0,
      min: 0.01,
      max: 10.0,
      step: 0.01,
      label: 'Distance scale'
    },
    ringSpacing: {
      type: 'float',
      default: 0.628318530718,
      min: 0.05,
      max: 12.0,
      step: 0.005,
      label: 'Ring spacing'
    },
    ringFalloff: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 10.0,
      step: 0.05,
      label: 'Falloff'
    },
    ringLineMode: {
      type: 'int',
      default: 0,
      min: 0,
      max: 1,
      step: 1,
      label: 'Pattern'
    },
    ringWidth: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Line thickness'
    },
    ringFeather: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Feather'
    },
    ringInvert: {
      type: 'int',
      default: 0,
      min: 0,
      max: 1,
      step: 1,
      label: 'Invert'
    },
    ringLevel: {
      type: 'float',
      default: 0.5,
      min: 0.0,
      max: 4.0,
      step: 0.01,
      label: 'Level'
    },
    ringTimeOffset: {
      type: 'float',
      default: 0.0,
      min: -100.0,
      max: 100.0,
      step: 0.001,
      label: 'Phase offset',
      knobPolarity: 'two-sided'
    },
    ringSpeed: {
      type: 'float',
      default: 2.0,
      min: -20.0,
      max: 20.0,
      step: 0.05,
      label: 'Speed',
      knobPolarity: 'two-sided'
    }
  },
  parameterGroups: [
    {
      id: 'rings-center',
      label: 'Center',
      parameters: ['ringCenterX', 'ringCenterY'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'rings-spacing',
      label: 'Radial spacing',
      parameters: ['ringDistanceScale', 'ringSpacing', 'ringFalloff'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'rings-lines',
      label: 'Line appearance',
      parameters: ['ringLineMode', 'ringWidth', 'ringFeather', 'ringInvert'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'rings-output',
      label: 'Output',
      parameters: ['ringLevel'],
      collapsible: true,
      defaultCollapsed: true
    },
    {
      id: 'rings-time',
      label: 'Animation',
      parameters: ['ringSpeed', 'ringTimeOffset'],
      collapsible: true,
      defaultCollapsed: true
    }
  ],
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        label: 'Center',
        parameters: ['ringCenterX', 'ringCenterY'],
        parameterUI: { ringCenterX: 'coords', ringCenterY: 'coords' },
        layout: { columns: 2, coordsSpan: 2 }
      },
      {
        type: 'grid',
        label: 'Radial spacing',
        parameters: ['ringDistanceScale', 'ringSpacing', 'ringFalloff']
      },
      {
        type: 'grid',
        label: 'Line appearance',
        parameters: ['ringLineMode', 'ringWidth', 'ringFeather', 'ringInvert'],
        parameterUI: { ringInvert: 'toggle' },
        layout: { columns: 2 }
      },
      {
        type: 'grid',
        label: 'Output',
        parameters: ['ringLevel']
      },
      {
        type: 'grid',
        label: 'Animation',
        parameters: ['ringSpeed', 'ringTimeOffset']
      }
    ]
  },
  functions: `
float rings(vec2 p, vec2 center, float ringSpacingParam) {
  float distRaw = length(p - center);
  float dist = distRaw * max($param.ringDistanceScale, 0.0);
  float distEnv = max(distRaw, 0.0);
  float t = $time;
  float phase = (t * $param.ringSpeed) + $param.ringTimeOffset;
  float envelope = exp(-distEnv * $param.ringFalloff);
  const float TAU = 6.28318530718;
  float spacing = max(0.0001, ringSpacingParam);
  float radialPhase = TAU * dist / spacing - phase;
  float base = sin(radialPhase) * 0.5 + 0.5;

  if ($param.ringLineMode == 0) {
    float v = base;
    if ($param.ringInvert != 0) v = 1.0 - v;
    return v * envelope;
  }

  // Lines: distance to nearest ring center in scaled radial units (constant line thickness vs spacing).
  float flow = dist / spacing - phase / TAU;
  float u = fract(flow);
  float dR = min(u, 1.0 - u) * spacing;
  const float LINE_HALF_SCALE = 0.25;
  float wn = clamp($param.ringWidth, 0.0, 1.0);
  float fn = clamp($param.ringFeather, 0.0, 1.0);
  float maxHalf = max(0.0002, 0.5 * spacing - 0.0001);
  float halfW = clamp(wn * LINE_HALF_SCALE, 0.00015, maxHalf);
  float featMax = max(0.0, maxHalf - halfW);
  // Feather uses most of the radial gap toward the next ring; gamma < 1 softens the tail.
  float feat = clamp(fn * featMax * 0.96, 0.0, featMax);
  float edgeMix = clamp((dR - halfW) / max(feat, 1e-6), 0.0, 1.0);
  const float FEATHER_GAMMA = 0.55;
  float line = 1.0 - pow(edgeMix, FEATHER_GAMMA);
  float v = line;
  if ($param.ringInvert != 0) v = 1.0 - v;
  return v * envelope;
}
`,
  mainCode: `
  vec2 ringCenter = vec2($param.ringCenterX, $param.ringCenterY);
  $output.out += rings($input.in, ringCenter, $param.ringSpacing) * $param.ringLevel;
`
};
