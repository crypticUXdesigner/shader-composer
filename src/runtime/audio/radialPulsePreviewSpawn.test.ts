import { describe, expect, it, vi } from 'vitest';
import type { AudioSetup } from '../../data-model/audioSetupTypes';
import type { AnalyzerNodeState } from './FrequencyAnalyzer';
import { applyRadialPulseSpawnUniforms } from './radialPulsePreviewSpawn';

describe('applyRadialPulseSpawnUniforms', () => {
  it('fires Schmitt crossing rise and pushes spawn slot uniforms in round‑robin order', () => {
    const remapperId = 'remap-fixture';
    const virtualId = `audio-signal:remap-${remapperId}`;
    const pulseNodeId = 'n-pulse';
    const graph = {
      id: 'g',
      name: 't',
      version: '2.0',
      nodes: [
        {
          id: pulseNodeId,
          type: 'radial-pulse',
          position: { x: 0, y: 0 },
          parameters: {
            pulseRiseThreshold: 0.55,
            pulseFallThreshold: 0.35,
          },
          parameterInputModes: {},
        },
      ],
      connections: [
        {
          id: 'w1',
          sourceNodeId: virtualId,
          sourcePort: 'out',
          targetNodeId: pulseNodeId,
          targetParameter: 'pulseDrive',
        },
      ],
    };
    const audioSetup: AudioSetup = {
      files: [],
      bands: [{ id: 'b1', name: 'B1', sourceFileId: 'f1', frequencyBands: [[20, 20000]], smoothingHalfLifeSeconds: 1 / 120 }],
      remappers: [
        {
          id: remapperId,
          name: 'R1',
          bandId: 'b1',
          inMin: 0,
          inMax: 1,
          outMin: 0,
          outMax: 1,
        },
      ],
    };

    const spawns: { param: string; v: number }[] = [];
    const shaderInstance = {
      setParameter: vi.fn((nodeId: string, param: string, v: number) => {
        if (nodeId === pulseNodeId && param.startsWith('pulseSpawnTimeline')) {
          spawns.push({ param, v });
        }
      }),
    };

    applyRadialPulseSpawnUniforms({
      graph,
      shaderInstance: shaderInstance as import('../types').PreviewProgramInstance,
      shaderTime: 12.34,
      audioSetup,
      getAnalyzerNodeState: () =>
        ({ smoothedBandValues: [0.2] }) as AnalyzerNodeState,
    });

    applyRadialPulseSpawnUniforms({
      graph,
      shaderInstance: shaderInstance as import('../types').PreviewProgramInstance,
      shaderTime: 12.34,
      audioSetup,
      getAnalyzerNodeState: () =>
        ({ smoothedBandValues: [0.72] }) as AnalyzerNodeState,
    });

    applyRadialPulseSpawnUniforms({
      graph,
      shaderInstance: shaderInstance as import('../types').PreviewProgramInstance,
      shaderTime: 12.45,
      audioSetup,
      getAnalyzerNodeState: () =>
        ({ smoothedBandValues: [0.2] }) as AnalyzerNodeState,
    });

    applyRadialPulseSpawnUniforms({
      graph,
      shaderInstance: shaderInstance as import('../types').PreviewProgramInstance,
      shaderTime: 12.56,
      audioSetup,
      getAnalyzerNodeState: () =>
        ({ smoothedBandValues: [0.72] }) as AnalyzerNodeState,
    });

    expect(spawns).toEqual([
      { param: 'pulseSpawnTimeline', v: 12.34 },
      { param: 'pulseSpawnTimeline1', v: 12.56 }
    ]);
    expect(shaderInstance.setParameter).toHaveBeenCalled();
  });

  it('fires loop-interval spawn when Drive has no virtual connection and spawn slots are unset', () => {
    const pulseNodeId = 'n-looped';
    const graph = {
      id: 'g',
      name: 't',
      version: '2.0',
      nodes: [
        {
          id: pulseNodeId,
          type: 'radial-pulse',
          position: { x: 0, y: 0 },
          parameters: {
            pulseFreeRunInterval: 2.0,
          },
          parameterInputModes: {},
        },
      ],
      connections: [],
    };

    const spawns: { param: string; v: number }[] = [];
    const shaderInstance = {
      setParameter: vi.fn((nodeId: string, param: string, v: number) => {
        if (nodeId === pulseNodeId && param.startsWith('pulseSpawnTimeline')) {
          spawns.push({ param, v });
        }
      }),
    };

    applyRadialPulseSpawnUniforms({
      graph,
      shaderInstance: shaderInstance as import('../types').PreviewProgramInstance,
      shaderTime: 100.0,
      audioSetup: null,
      getAnalyzerNodeState: () => undefined,
    });

    applyRadialPulseSpawnUniforms({
      graph,
      shaderInstance: shaderInstance as import('../types').PreviewProgramInstance,
      shaderTime: 101.9,
      audioSetup: null,
      getAnalyzerNodeState: () => undefined,
    });

    applyRadialPulseSpawnUniforms({
      graph,
      shaderInstance: shaderInstance as import('../types').PreviewProgramInstance,
      shaderTime: 102.1,
      audioSetup: null,
      getAnalyzerNodeState: () => undefined,
    });

    expect(spawns).toEqual([
      { param: 'pulseSpawnTimeline', v: 100.0 },
      { param: 'pulseSpawnTimeline1', v: 102.1 },
    ]);
  });

  it('does not loop spawns when interval is zero or spawn slots are authored', () => {
    const pulseId = 'n-off';
    const graphBase = {
      id: 'g',
      name: 't',
      version: '2.0',
      connections: [],
      nodes: [
        {
          id: pulseId,
          type: 'radial-pulse',
          position: { x: 0, y: 0 },
          parameters: {} as Record<string, number>,
          parameterInputModes: {},
        },
      ],
    };

    let spawns = 0;
    const makeInstance = () => ({
      setParameter: vi.fn((nodeId: string, param: string) => {
        if (nodeId === pulseId && param.startsWith('pulseSpawnTimeline')) spawns += 1;
      }),
    });

    graphBase.nodes[0].parameters = { pulseFreeRunInterval: 0 };
    spawns = 0;
    applyRadialPulseSpawnUniforms({
      graph: graphBase,
      shaderInstance: makeInstance() as import('../types').PreviewProgramInstance,
      shaderTime: 10,
      audioSetup: null,
      getAnalyzerNodeState: () => undefined,
    });
    expect(spawns).toBe(0);

    graphBase.nodes[0].parameters = {
      pulseFreeRunInterval: 2,
      pulseSpawnTimeline: 5.25,
    };
    spawns = 0;
    applyRadialPulseSpawnUniforms({
      graph: graphBase,
      shaderInstance: makeInstance() as import('../types').PreviewProgramInstance,
      shaderTime: 20,
      audioSetup: null,
      getAnalyzerNodeState: () => undefined,
    });
    expect(spawns).toBe(0);
  });
});
