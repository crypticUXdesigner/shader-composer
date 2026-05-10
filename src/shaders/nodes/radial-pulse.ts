import type { NodeSpec } from '../../types/nodeSpec';

/** Values below this treat the pulse as never spawned (shader outputs silence). Match default `pulseSpawnTimeline`. */
export const RADIAL_PULSE_SPAWN_SENTINEL = -1e10;

/** Concurrent expanding rings: each fired spawn writes the next uniform slot (preview round‑robin). */
export const RADIAL_PULSE_SPAWN_SLOT_COUNT = 8;

export function radialPulseSpawnTimelineParam(slotIndex: number): string {
  if (slotIndex === 0) return 'pulseSpawnTimeline';
  if (!Number.isInteger(slotIndex) || slotIndex < 1 || slotIndex >= RADIAL_PULSE_SPAWN_SLOT_COUNT) {
    throw new RangeError('radialPulseSpawnTimelineParam: slotIndex');
  }
  return `pulseSpawnTimeline${slotIndex}`;
}

export const radialPulseNodeSpec: NodeSpec = {
  id: 'radial-pulse',
  category: 'Patterns',
  displayName: 'Radial Pulse',
  description:
    'Expanding circular wavefront(s) from a center (distinct from repeating Rings). Preview loops new pulses while Drive has no audio signal; wiring virtual Drive hands spawning to thresholds instead.',
  icon: 'pulse',
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
    pulseCenterX: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.1,
      label: 'Center X',
      knobPolarity: 'two-sided'
    },
    pulseCenterY: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.1,
      label: 'Center Y',
      knobPolarity: 'two-sided'
    },
    pulseDistanceScale: {
      type: 'float',
      default: 1.0,
      min: 0.01,
      max: 10.0,
      step: 0.01,
      label: 'Distance scale'
    },
    pulseSpeed: {
      type: 'float',
      default: 0.45,
      min: 0.0,
      max: 10.0,
      step: 0.005,
      label: 'Outward speed',
      knobPolarity: 'one-sided'
    },
    pulseThickness: {
      type: 'float',
      default: 0.035,
      min: 0.0005,
      max: 2.0,
      step: 0.001,
      label: 'Thickness',
      knobPolarity: 'one-sided'
    },
    pulseFeather: {
      type: 'float',
      default: 0.35,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Feather',
      knobPolarity: 'one-sided'
    },
    pulseFalloff: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 12.0,
      step: 0.05,
      label: 'Falloff'
    },
    /** Preview-only pacing when virtual Drive is disconnected; `0` = no timed respawns from runtime. */
    pulseFreeRunInterval: {
      type: 'float',
      default: 2.0,
      min: 0.0,
      max: 60.0,
      step: 0.05,
      label: 'Loop interval',
      knobPolarity: 'one-sided'
    },
    pulseLevel: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 4.0,
      step: 0.01,
      label: 'Level',
      knobPolarity: 'one-sided'
    },
    /** Engine-driven spawn reference in the same clock as `$time`; default = inactive until runtime sets this. */
    pulseSpawnTimeline: {
      type: 'float',
      default: RADIAL_PULSE_SPAWN_SENTINEL,
      min: -1e11,
      max: 1e11,
      step: 0.01,
      label: 'Spawn time (internal)'
    },
    pulseSpawnTimeline1: {
      type: 'float',
      default: RADIAL_PULSE_SPAWN_SENTINEL,
      min: -1e11,
      max: 1e11,
      step: 0.01,
      label: 'Spawn time (internal) slot 1'
    },
    pulseSpawnTimeline2: {
      type: 'float',
      default: RADIAL_PULSE_SPAWN_SENTINEL,
      min: -1e11,
      max: 1e11,
      step: 0.01,
      label: 'Spawn time (internal) slot 2'
    },
    pulseSpawnTimeline3: {
      type: 'float',
      default: RADIAL_PULSE_SPAWN_SENTINEL,
      min: -1e11,
      max: 1e11,
      step: 0.01,
      label: 'Spawn time (internal) slot 3'
    },
    pulseSpawnTimeline4: {
      type: 'float',
      default: RADIAL_PULSE_SPAWN_SENTINEL,
      min: -1e11,
      max: 1e11,
      step: 0.01,
      label: 'Spawn time (internal) slot 4'
    },
    pulseSpawnTimeline5: {
      type: 'float',
      default: RADIAL_PULSE_SPAWN_SENTINEL,
      min: -1e11,
      max: 1e11,
      step: 0.01,
      label: 'Spawn time (internal) slot 5'
    },
    pulseSpawnTimeline6: {
      type: 'float',
      default: RADIAL_PULSE_SPAWN_SENTINEL,
      min: -1e11,
      max: 1e11,
      step: 0.01,
      label: 'Spawn time (internal) slot 6'
    },
    pulseSpawnTimeline7: {
      type: 'float',
      default: RADIAL_PULSE_SPAWN_SENTINEL,
      min: -1e11,
      max: 1e11,
      step: 0.01,
      label: 'Spawn time (internal) slot 7'
    },
    /** Drive audio signal for rising-edge spawning (threshold logic in TS; not read in shader). */
    pulseDrive: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 1.0,
      step: 0.005,
      label: 'Drive (audio)',
      supportsAudio: true,
      knobPolarity: 'one-sided'
    },
    pulseRiseThreshold: {
      type: 'float',
      default: 0.55,
      min: 0.0,
      max: 1.0,
      step: 0.005,
      label: 'Rise threshold'
    },
    pulseFallThreshold: {
      type: 'float',
      default: 0.35,
      min: 0.0,
      max: 1.0,
      step: 0.005,
      label: 'Fall threshold'
    }
  },
  parameterGroups: [
    {
      id: 'pulse-center',
      label: 'Center',
      parameters: ['pulseCenterX', 'pulseCenterY'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'pulse-wave',
      label: 'Wavefront',
      parameters: ['pulseDistanceScale', 'pulseSpeed', 'pulseThickness', 'pulseFeather', 'pulseFalloff', 'pulseFreeRunInterval'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'pulse-trigger',
      label: 'Spawn (audio)',
      parameters: ['pulseDrive', 'pulseRiseThreshold', 'pulseFallThreshold'],
      collapsible: true,
      defaultCollapsed: true
    },
    {
      id: 'pulse-out',
      label: 'Output',
      parameters: ['pulseLevel'],
      collapsible: true,
      defaultCollapsed: true
    }
  ],
  parameterLayout: {
    parametersWithoutPorts: [
      'pulseSpawnTimeline',
      'pulseSpawnTimeline1',
      'pulseSpawnTimeline2',
      'pulseSpawnTimeline3',
      'pulseSpawnTimeline4',
      'pulseSpawnTimeline5',
      'pulseSpawnTimeline6',
      'pulseSpawnTimeline7'
    ],
    elements: [
      {
        type: 'grid',
        label: 'Center',
        parameters: ['pulseCenterX', 'pulseCenterY'],
        parameterUI: { pulseCenterX: 'coords', pulseCenterY: 'coords' },
        layout: { columns: 2, coordsSpan: 2 }
      },
      {
        type: 'grid',
        label: 'Wavefront',
        parameters: ['pulseDistanceScale', 'pulseSpeed', 'pulseThickness', 'pulseFeather', 'pulseFalloff', 'pulseFreeRunInterval'],
        layout: { columns: 2 }
      },
      {
        type: 'grid',
        label: 'Spawn (audio)',
        parameters: ['pulseDrive', 'pulseRiseThreshold', 'pulseFallThreshold']
      },
      {
        type: 'grid',
        label: 'Output',
        parameters: ['pulseLevel']
      }
    ]
  },
  functions: `
float radialPulseWave(vec2 p, vec2 center, float distScale, float falloff,
    float thickness, float feather, float speed, float spawnTimeline, float time) {
  /* Default graph sentinel (~-1e10): no spawned pulse until runtime sets spawnTimeline. */
  if (spawnTimeline < -9e9) {
    return 0.0;
  }

  float distRaw = length(p - center);
  float distScaled = distRaw * max(distScale, 0.0);
  float envInput = max(distRaw, 0.0);
  float envelope = exp(-envInput * max(falloff, 0.0));

  float tRel = max(0.0, time - spawnTimeline);
  float waveR = max(0.0, speed) * tRel;

  float dBand = abs(distScaled - waveR);
  float halfW = max(0.00025, thickness);
  float featMax = max(1e-4, halfW * 0.995);
  float feat = clamp(feather * halfW * 1.35, 0.0, featMax);
  float edgeT = clamp((dBand - halfW) / max(feat, 1e-6), 0.0, 1.0);
  const float FEATHER_GAMMA = 0.55;
  float line = 1.0 - pow(edgeT, FEATHER_GAMMA);
  return clamp(line * envelope, 0.0, 1.0);
}
`,
  mainCode: `
  vec2 pulseCenterRp = vec2($param.pulseCenterX, $param.pulseCenterY);
  float pulseRpSum = radialPulseWave(
    $input.in,
    pulseCenterRp,
    $param.pulseDistanceScale,
    $param.pulseFalloff,
    $param.pulseThickness,
    $param.pulseFeather,
    $param.pulseSpeed,
    $param.pulseSpawnTimeline,
    $time
  ) + radialPulseWave(
    $input.in,
    pulseCenterRp,
    $param.pulseDistanceScale,
    $param.pulseFalloff,
    $param.pulseThickness,
    $param.pulseFeather,
    $param.pulseSpeed,
    $param.pulseSpawnTimeline1,
    $time
  ) + radialPulseWave(
    $input.in,
    pulseCenterRp,
    $param.pulseDistanceScale,
    $param.pulseFalloff,
    $param.pulseThickness,
    $param.pulseFeather,
    $param.pulseSpeed,
    $param.pulseSpawnTimeline2,
    $time
  ) + radialPulseWave(
    $input.in,
    pulseCenterRp,
    $param.pulseDistanceScale,
    $param.pulseFalloff,
    $param.pulseThickness,
    $param.pulseFeather,
    $param.pulseSpeed,
    $param.pulseSpawnTimeline3,
    $time
  ) + radialPulseWave(
    $input.in,
    pulseCenterRp,
    $param.pulseDistanceScale,
    $param.pulseFalloff,
    $param.pulseThickness,
    $param.pulseFeather,
    $param.pulseSpeed,
    $param.pulseSpawnTimeline4,
    $time
  ) + radialPulseWave(
    $input.in,
    pulseCenterRp,
    $param.pulseDistanceScale,
    $param.pulseFalloff,
    $param.pulseThickness,
    $param.pulseFeather,
    $param.pulseSpeed,
    $param.pulseSpawnTimeline5,
    $time
  ) + radialPulseWave(
    $input.in,
    pulseCenterRp,
    $param.pulseDistanceScale,
    $param.pulseFalloff,
    $param.pulseThickness,
    $param.pulseFeather,
    $param.pulseSpeed,
    $param.pulseSpawnTimeline6,
    $time
  ) + radialPulseWave(
    $input.in,
    pulseCenterRp,
    $param.pulseDistanceScale,
    $param.pulseFalloff,
    $param.pulseThickness,
    $param.pulseFeather,
    $param.pulseSpeed,
    $param.pulseSpawnTimeline7,
    $time
  );
  $output.out += pulseRpSum * $param.pulseLevel;
`
};
