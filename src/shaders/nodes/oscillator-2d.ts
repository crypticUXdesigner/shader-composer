import type { KnobPolarity, NodeSpec } from '../../types/nodeSpec';

const oscFloatParam = (
  label: string,
  defaultValue: number,
  min: number,
  max: number,
  step: number,
  extras?: { supportsAnimation?: boolean; knobPolarity?: KnobPolarity; knobCenter?: number }
) => ({
  type: 'float' as const,
  default: defaultValue,
  min,
  max,
  step,
  label,
  ...extras,
});

const oscLayerOnParam = (label: string = 'On') => ({
  type: 'int' as const,
  default: 1,
  min: 0,
  max: 1,
  label,
});

/**
 * Stacks three sine waves per axis, rotates (optional wobble), then offsets.
 * Outputs X and Y in the same distortion space as UV / typical center sliders (p-style).
 *
 * Per-axis merge mode (`layerCombine`) and per-layer On toggles apply before rotation/offset.
 * Product mode: disabled layers contribute multiplicative identity 1 (not 0); if all layers on an
 * axis are off, that axis raw value is 0. Max mode: tie-break by first layer (X1/Y1, then 2, then 3).
 */

export const oscillator2dNodeSpec: NodeSpec = {
  id: 'oscillator-2d',
  category: 'Inputs',
  displayName: 'Oscillator 2D',
  description:
    'Time-driven XY motion: three partial waves per axis with configurable merge (sum / normalized / product / max |·|), optional rotation and wobble, then offset. Wire X/Y to paired float ports (e.g. Vortex center).',
  icon: 'trig-wave',
  inputs: [],
  outputs: [
    { name: 'x', type: 'float', label: 'X' },
    { name: 'y', type: 'float', label: 'Y' },
  ],
  parameters: {
    globalSpeed: oscFloatParam('Global speed', 1.0, -10.0, 10.0, 0.001, {
      supportsAnimation: true,
      knobPolarity: 'two-sided',
    }),
    globalOffset: oscFloatParam('Global offset', 0.0, -100.0, 100.0, 0.01, {
      supportsAnimation: true,
      knobPolarity: 'two-sided',
    }),

    layerCombine: {
      type: 'int',
      default: 0,
      min: 0,
      max: 3,
      label: 'Layer mix',
    },

    x1On: oscLayerOnParam(),
    x1Amp: oscFloatParam('Amp', 0.0, -5.0, 5.0, 0.001, { supportsAnimation: true, knobPolarity: 'two-sided' }),
    x1Freq: oscFloatParam('Freq', 1.0, -20.0, 20.0, 0.001, { supportsAnimation: true, knobPolarity: 'two-sided' }),
    x1Phase: oscFloatParam('Phase', 0.0, -60.0, 60.0, 0.001, { supportsAnimation: true, knobPolarity: 'two-sided' }),
    x2On: oscLayerOnParam(),
    x2Amp: oscFloatParam('Amp', 0.0, -5.0, 5.0, 0.001, { supportsAnimation: true, knobPolarity: 'two-sided' }),
    x2Freq: oscFloatParam('Freq', 1.07, -20.0, 20.0, 0.001, { supportsAnimation: true, knobPolarity: 'two-sided' }),
    x2Phase: oscFloatParam('Phase', 2.31, -60.0, 60.0, 0.001, { supportsAnimation: true, knobPolarity: 'two-sided' }),
    x3On: oscLayerOnParam(),
    x3Amp: oscFloatParam('Amp', 0.0, -5.0, 5.0, 0.001, { supportsAnimation: true, knobPolarity: 'two-sided' }),
    x3Freq: oscFloatParam('Freq', 1.03, -20.0, 20.0, 0.001, { supportsAnimation: true, knobPolarity: 'two-sided' }),
    x3Phase: oscFloatParam('Phase', 4.12, -60.0, 60.0, 0.001, { supportsAnimation: true, knobPolarity: 'two-sided' }),

    y1On: oscLayerOnParam(),
    y1Amp: oscFloatParam('Amp', 0.0, -5.0, 5.0, 0.001, { supportsAnimation: true, knobPolarity: 'two-sided' }),
    y1Freq: oscFloatParam('Freq', 1.0, -20.0, 20.0, 0.001, { supportsAnimation: true, knobPolarity: 'two-sided' }),
    y1Phase: oscFloatParam('Phase', 0.0, -60.0, 60.0, 0.001, { supportsAnimation: true, knobPolarity: 'two-sided' }),
    y2On: oscLayerOnParam(),
    y2Amp: oscFloatParam('Amp', 0.0, -5.0, 5.0, 0.001, { supportsAnimation: true, knobPolarity: 'two-sided' }),
    y2Freq: oscFloatParam('Freq', 0.91, -20.0, 20.0, 0.001, { supportsAnimation: true, knobPolarity: 'two-sided' }),
    y2Phase: oscFloatParam('Phase', 1.77, -60.0, 60.0, 0.001, { supportsAnimation: true, knobPolarity: 'two-sided' }),
    y3On: oscLayerOnParam(),
    y3Amp: oscFloatParam('Amp', 0.0, -5.0, 5.0, 0.001, { supportsAnimation: true, knobPolarity: 'two-sided' }),
    y3Freq: oscFloatParam('Freq', 1.13, -20.0, 20.0, 0.001, { supportsAnimation: true, knobPolarity: 'two-sided' }),
    y3Phase: oscFloatParam('Phase', 3.41, -60.0, 60.0, 0.001, { supportsAnimation: true, knobPolarity: 'two-sided' }),

    rotationSpeed: oscFloatParam('Speed', 0.0, -10.0, 10.0, 0.001, { supportsAnimation: true, knobPolarity: 'two-sided' }),
    rotationPhase: oscFloatParam('Phase', 0.0, -60.0, 60.0, 0.001, { supportsAnimation: true, knobPolarity: 'two-sided' }),
    rotWobbleAmp: oscFloatParam('Wobble', 0.0, -6.283, 6.283, 0.001, { supportsAnimation: true, knobPolarity: 'two-sided' }),
    rotWobbleFreq: oscFloatParam('Wob freq', 0.0, -20.0, 20.0, 0.001, { supportsAnimation: true, knobPolarity: 'two-sided' }),
    rotWobblePhase: oscFloatParam('Wob phase', 0.0, -60.0, 60.0, 0.001, { supportsAnimation: true, knobPolarity: 'two-sided' }),

    offsetX: oscFloatParam('X', 0.0, -5.0, 5.0, 0.01, { supportsAnimation: true, knobPolarity: 'two-sided' }),
    offsetY: oscFloatParam('Y', 0.0, -5.0, 5.0, 0.01, { supportsAnimation: true, knobPolarity: 'two-sided' }),
  },
  parameterGroups: [
    {
      id: 'osc2d-global',
      label: 'Global time',
      parameters: ['globalSpeed', 'globalOffset'],
      collapsible: true,
      defaultCollapsed: false,
    },
    {
      id: 'osc2d-mix',
      label: 'Mix',
      parameters: ['layerCombine'],
      collapsible: true,
      defaultCollapsed: false,
    },
    {
      id: 'osc2d-x1',
      label: 'X1',
      parameters: ['x1On', 'x1Amp', 'x1Freq', 'x1Phase'],
      collapsible: true,
      defaultCollapsed: false,
    },
    {
      id: 'osc2d-x2',
      label: 'X2',
      parameters: ['x2On', 'x2Amp', 'x2Freq', 'x2Phase'],
      collapsible: true,
      defaultCollapsed: false,
    },
    {
      id: 'osc2d-x3',
      label: 'X3',
      parameters: ['x3On', 'x3Amp', 'x3Freq', 'x3Phase'],
      collapsible: true,
      defaultCollapsed: false,
    },
    {
      id: 'osc2d-y1',
      label: 'Y1',
      parameters: ['y1On', 'y1Amp', 'y1Freq', 'y1Phase'],
      collapsible: true,
      defaultCollapsed: false,
    },
    {
      id: 'osc2d-y2',
      label: 'Y2',
      parameters: ['y2On', 'y2Amp', 'y2Freq', 'y2Phase'],
      collapsible: true,
      defaultCollapsed: false,
    },
    {
      id: 'osc2d-y3',
      label: 'Y3',
      parameters: ['y3On', 'y3Amp', 'y3Freq', 'y3Phase'],
      collapsible: true,
      defaultCollapsed: false,
    },
    {
      id: 'osc2d-rotate',
      label: 'Rotation',
      parameters: ['rotationSpeed', 'rotationPhase', 'rotWobbleAmp', 'rotWobbleFreq', 'rotWobblePhase'],
      collapsible: true,
      defaultCollapsed: true,
    },
    {
      id: 'osc2d-offset',
      label: 'Offset',
      parameters: ['offsetX', 'offsetY'],
      collapsible: true,
      defaultCollapsed: true,
    },
  ],
  parameterLayout: {
    minColumns: 3,
    elements: [
      {
        type: 'grid',
        label: 'Global time',
        parameters: ['globalSpeed', 'globalOffset'],
        layout: { columns: 2 },
      },
      {
        type: 'grid',
        label: 'Mix',
        parameters: ['layerCombine'],
        layout: { columns: 1 },
        parameterUI: { layerCombine: 'enum' },
      },
      {
        type: 'grid',
        label: 'X1',
        headerToggleParameter: 'x1On',
        parameters: ['x1Amp', 'x1Freq', 'x1Phase'],
        layout: { columns: 3 },
        parameterUI: { x1On: 'toggle' },
      },
      {
        type: 'grid',
        label: 'X2',
        headerToggleParameter: 'x2On',
        parameters: ['x2Amp', 'x2Freq', 'x2Phase'],
        layout: { columns: 3 },
        parameterUI: { x2On: 'toggle' },
      },
      {
        type: 'grid',
        label: 'X3',
        headerToggleParameter: 'x3On',
        parameters: ['x3Amp', 'x3Freq', 'x3Phase'],
        layout: { columns: 3 },
        parameterUI: { x3On: 'toggle' },
      },
      {
        type: 'grid',
        label: 'Y1',
        headerToggleParameter: 'y1On',
        parameters: ['y1Amp', 'y1Freq', 'y1Phase'],
        layout: { columns: 3 },
        parameterUI: { y1On: 'toggle' },
      },
      {
        type: 'grid',
        label: 'Y2',
        headerToggleParameter: 'y2On',
        parameters: ['y2Amp', 'y2Freq', 'y2Phase'],
        layout: { columns: 3 },
        parameterUI: { y2On: 'toggle' },
      },
      {
        type: 'grid',
        label: 'Y3',
        headerToggleParameter: 'y3On',
        parameters: ['y3Amp', 'y3Freq', 'y3Phase'],
        layout: { columns: 3 },
        parameterUI: { y3On: 'toggle' },
      },
      {
        type: 'grid',
        label: 'Rotation',
        parameters: ['rotationSpeed', 'rotationPhase', 'rotWobbleAmp', 'rotWobbleFreq', 'rotWobblePhase'],
        layout: { columns: 3 },
      },
      {
        type: 'grid',
        label: 'Offset',
        parameters: ['offsetX', 'offsetY'],
        layout: { columns: 2 },
      },
    ],
  },
  functions: `
    float osc2d_onf(int on) {
      return step(0.5, float(on));
    }

    float osc2d_combine_axis(int mode, int on1, float amp1, float s1, int on2, float amp2, float s2, int on3, float amp3, float s3) {
      float o1 = osc2d_onf(on1);
      float o2 = osc2d_onf(on2);
      float o3 = osc2d_onf(on3);
      float t1 = amp1 * s1;
      float t2 = amp2 * s2;
      float t3 = amp3 * s3;
      float c1 = mix(0.0, t1, o1);
      float c2 = mix(0.0, t2, o2);
      float c3 = mix(0.0, t3, o3);

      if (mode == 0) {
        return c1 + c2 + c3;
      }
      if (mode == 1) {
        float eps = 1e-6;
        float w = mix(0.0, abs(amp1), o1) + mix(0.0, abs(amp2), o2) + mix(0.0, abs(amp3), o3) + eps;
        return (c1 + c2 + c3) / max(w, eps);
      }
      if (mode == 2) {
        float p1 = mix(1.0, t1, o1);
        float p2 = mix(1.0, t2, o2);
        float p3 = mix(1.0, t3, o3);
        float prod = p1 * p2 * p3;
        float anyOn = max(max(o1, o2), o3);
        return mix(0.0, prod, step(0.25, anyOn));
      }
      float bestMag = -1.0;
      float bestVal = 0.0;
      if (o1 > 0.5) {
        float m = abs(t1);
        if (m > bestMag) { bestMag = m; bestVal = t1; }
      }
      if (o2 > 0.5) {
        float m = abs(t2);
        if (m > bestMag) { bestMag = m; bestVal = t2; }
      }
      if (o3 > 0.5) {
        float m = abs(t3);
        if (m > bestMag) { bestMag = m; bestVal = t3; }
      }
      return bestVal;
    }
  `,
  mainCode: `
    float osc2dTau = 6.283185307179586;
    float osc2dT = $time * $param.globalSpeed + $param.globalOffset;
    float osc2dSx1 = sin(osc2dT * osc2dTau * $param.x1Freq + $param.x1Phase);
    float osc2dSx2 = sin(osc2dT * osc2dTau * $param.x2Freq + $param.x2Phase);
    float osc2dSx3 = sin(osc2dT * osc2dTau * $param.x3Freq + $param.x3Phase);
    float osc2dSy1 = sin(osc2dT * osc2dTau * $param.y1Freq + $param.y1Phase);
    float osc2dSy2 = sin(osc2dT * osc2dTau * $param.y2Freq + $param.y2Phase);
    float osc2dSy3 = sin(osc2dT * osc2dTau * $param.y3Freq + $param.y3Phase);
    float osc2dRawX = osc2d_combine_axis($param.layerCombine, $param.x1On, $param.x1Amp, osc2dSx1, $param.x2On, $param.x2Amp, osc2dSx2, $param.x3On, $param.x3Amp, osc2dSx3);
    float osc2dRawY = osc2d_combine_axis($param.layerCombine, $param.y1On, $param.y1Amp, osc2dSy1, $param.y2On, $param.y2Amp, osc2dSy2, $param.y3On, $param.y3Amp, osc2dSy3);
    float osc2dTheta =
      osc2dT * osc2dTau * $param.rotationSpeed + $param.rotationPhase
      + $param.rotWobbleAmp * sin(osc2dT * osc2dTau * $param.rotWobbleFreq + $param.rotWobblePhase);
    float osc2dC = cos(osc2dTheta);
    float osc2dS = sin(osc2dTheta);
    float osc2dRx = osc2dC * osc2dRawX - osc2dS * osc2dRawY;
    float osc2dRy = osc2dS * osc2dRawX + osc2dC * osc2dRawY;
    $output.x = osc2dRx + $param.offsetX;
    $output.y = osc2dRy + $param.offsetY;
  `,
};
