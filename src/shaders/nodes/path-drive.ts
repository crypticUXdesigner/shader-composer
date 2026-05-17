import type { NodeSpec } from '../../types/nodeSpec';

const motionFloat = (
  label: string,
  defaultValue: number,
  min: number,
  max: number,
  step: number,
) => ({
  type: 'float' as const,
  default: defaultValue,
  min,
  max,
  step,
  label,
  supportsAnimation: true,
  knobPolarity: 'two-sided' as const,
});

/**
 * Time-driven XY path for distortion centers and similar paired float ports.
 * Preset shapes + wander (slow) + jitter (fast); separate X/Y outputs.
 */
export const pathDriveNodeSpec: NodeSpec = {
  id: 'path-drive',
  category: 'Inputs',
  displayName: 'Path Drive',
  description:
    'Animated XY path presets (orbit with aspect, figure-8, drift, pulse, line) with slow wander, fast jitter, and optional global rotation around Center. Wire X and Y to center or paired float parameters.',
  icon: 'trig-wave',
  inputs: [],
  outputs: [
    { name: 'x', type: 'float', label: 'X' },
    { name: 'y', type: 'float', label: 'Y' },
  ],
  parameters: {
    pathPreset: {
      type: 'int',
      default: 0,
      min: 0,
      max: 4,
      step: 1,
      label: 'Path',
    },
    size: motionFloat('Size', 0.25, 0.0, 2.0, 0.01),
    speed: motionFloat('Speed', 0.5, -5.0, 5.0, 0.01),
    centerX: motionFloat('Center X', 0.0, -2.0, 2.0, 0.01),
    centerY: motionFloat('Center Y', 0.0, -2.0, 2.0, 0.01),
    wander: {
      type: 'float',
      default: 0.12,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Wander',
      supportsAnimation: true,
    },
    jitter: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Jitter',
      supportsAnimation: true,
    },
    aspect: {
      type: 'float',
      default: 1.0,
      min: 0.2,
      max: 4.0,
      step: 0.01,
      label: 'Aspect',
      supportsAnimation: true,
    },
    phase: {
      type: 'float',
      default: 0.0,
      min: -180.0,
      max: 180.0,
      step: 1.0,
      label: 'Phase',
      supportsAnimation: true,
      knobPolarity: 'two-sided',
    },
    lineAngle: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 360.0,
      step: 1.0,
      label: 'Angle',
      supportsAnimation: true,
    },
    pulseDepth: {
      type: 'float',
      default: 0.55,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Pulse',
      supportsAnimation: true,
    },
    rotate: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 360.0,
      step: 1.0,
      label: 'Rotate',
      supportsAnimation: true,
    },
    rotationSpeed: motionFloat('Spin', 0.0, -5.0, 5.0, 0.01),
    rotationPhase: {
      type: 'float',
      default: 0.0,
      min: -360.0,
      max: 360.0,
      step: 1.0,
      label: 'Phase',
      supportsAnimation: true,
      knobPolarity: 'two-sided',
    },
  },
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        parameters: [
          'pathPreset',
          'centerX',
          'centerY',
          'size',
          'speed',
          'phase',
          'aspect',
          'pulseDepth',
          'wander',
          'jitter',
          'lineAngle',
        ],
        parameterUI: {
          pathPreset: 'enum',
          centerX: 'coords',
          centerY: 'coords',
        },
        layout: {
          columns: 3,
          coordsSpan: 2,
          coordsOrigin: { centerX: 'center' },
        },
        parameterVisibleWhen: {
          aspect: { parameter: 'pathPreset', equals: [0, 1] },
          pulseDepth: { parameter: 'pathPreset', equals: 3 },
          lineAngle: { parameter: 'pathPreset', equals: 4 },
        },
      },
      {
        type: 'grid',
        label: 'Rotation',
        parameters: ['rotate', 'rotationSpeed', 'rotationPhase'],
        layout: { columns: 3 },
      },
    ],
  },
  functions: `
void pd_pathCore(
  int preset,
  float t,
  float size,
  float aspect,
  float pulseDepth,
  out float px,
  out float py
) {
  px = 0.0;
  py = 0.0;
  if (preset == 0) {
    px = size * cos(t);
    py = size * aspect * sin(t);
  } else if (preset == 1) {
    px = size * cos(t);
    py = size * aspect * sin(2.0 * t) * 0.5;
  } else if (preset == 2) {
    px = size * (0.62 * sin(t * 0.71) + 0.34 * sin(t * 1.11 + 1.17) + 0.19 * sin(t * 1.89 + 2.61));
    py = size * (0.58 * sin(t * 0.79 + 0.83) + 0.36 * sin(t * 1.03 + 2.07) + 0.21 * sin(t * 1.67 + 0.49));
  } else if (preset == 3) {
    float breathe = 1.0 - pulseDepth + pulseDepth * (0.5 + 0.5 * sin(t));
    float r = size * breathe;
    px = r * cos(t);
    py = r * sin(t);
  } else {
    // Horizontal segment; lineAngle is applied in mainCode rotation (around Center)
    // cos(t): phase 0 sits on the path (like Orbit), not at the pivot where rotation is invisible
    float along = cos(t);
    px = size * along;
    py = 0.0;
  }
}

void pd_wanderJitter(
  float t,
  float size,
  float wanderAmt,
  float jitterAmt,
  out float wx,
  out float wy,
  out float jx,
  out float jy
) {
  float pdTauJ = 6.283185307179586;
  wx = wanderAmt * size * 0.36 * (sin(t * 0.31 + 1.07) + 0.48 * sin(t * 0.17 + 2.31));
  wy = wanderAmt * size * 0.36 * (sin(t * 0.27 + 0.71) + 0.48 * sin(t * 0.19 + 3.12));
  float jf = t * 47.3 + sin(t * 13.7) * pdTauJ;
  float jg = t * 53.1 + sin(t * 11.2) * pdTauJ + 1.47;
  jx = jitterAmt * size * 0.14 * sin(jf);
  jy = jitterAmt * size * 0.14 * sin(jg);
}
`,
  mainCode: `
    float pdTau = 6.283185307179586;
    float pdT = $time * $param.speed * pdTau + radians($param.phase);
    float pdPx = 0.0;
    float pdPy = 0.0;
    pd_pathCore(
      $param.pathPreset,
      pdT,
      $param.size,
      $param.aspect,
      $param.pulseDepth,
      pdPx,
      pdPy
    );
    float pdWx = 0.0;
    float pdWy = 0.0;
    float pdJx = 0.0;
    float pdJy = 0.0;
    pd_wanderJitter(pdT, $param.size, $param.wander, $param.jitter, pdWx, pdWy, pdJx, pdJy);
    float pdOx = pdPx + pdWx + pdJx;
    float pdOy = pdPy + pdWy + pdJy;
    float pdLineRot =
      ($param.pathPreset == 4) ? radians($param.lineAngle) : 0.0;
    float pdTheta =
      radians($param.rotate)
      + $time * $param.rotationSpeed * pdTau
      + radians($param.rotationPhase)
      + pdLineRot;
    float pdCos = cos(pdTheta);
    float pdSin = sin(pdTheta);
    // Rotate offset around Center (all presets); same pivot as Transform 2D.
    vec2 pdCenter = vec2($param.centerX, $param.centerY);
    vec2 pdRot = vec2(
      pdCos * pdOx - pdSin * pdOy,
      pdSin * pdOx + pdCos * pdOy
    );
    $output.x = pdCenter.x + pdRot.x;
    $output.y = pdCenter.y + pdRot.y;
  `,
};
