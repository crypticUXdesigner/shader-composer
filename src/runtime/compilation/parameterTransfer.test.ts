import { describe, it, expect, vi } from 'vitest';
import type { NodeGraph } from '../../data-model/types';
import type { PreviewProgramInstance } from '../types';
import { transferParameters, transferParametersFromGraph } from './parameterTransfer';
import {
  mvpAudioBlurPassPlanGraph,
  mvpAudioBokehPassPlanGraph,
  mvpAudioCrepuscularRaysPassPlanGraph,
  mvpAudioGlowBloomPassPlanGraph,
} from '../../validation/webgpuMvpFixtures';

function makeProgram(params: Map<string, number | [number, number, number, number]>): PreviewProgramInstance {
  return {
    setParameter: vi.fn(),
    setParameters: vi.fn(),
    setAudioUniform: vi.fn(),
    setTime: vi.fn(),
    setTimelineTime: vi.fn(),
    getTime: () => 0,
    getTimelineTime: () => 0,
    getParameters: () => new Map(params),
    destroy: vi.fn(),
  };
}

describe('transferParameters', () => {
  it('parses param keys with dots in node id using last segment as param name', () => {
    const graph: NodeGraph = {
      id: 'g',
      name: 't',
      version: '2.0',
      nodes: [{ id: 'node.with.dots', type: 'constant-float', position: { x: 0, y: 0 }, parameters: { value: 0 } }],
      connections: [],
    };

    const oldInstance = makeProgram(new Map([['node.with.dots.value', 3.14]]));
    const newInstance = makeProgram(new Map());

    transferParameters(graph, oldInstance, newInstance);

    expect(newInstance.setParameter).toHaveBeenCalledWith('node.with.dots', 'value', 3.14);
  });
});

describe('transferParametersFromGraph (MVP audio remap fixtures)', () => {
  it('applies graph scalar params for nodes wired to audio remap (blur pass-plan graph)', () => {
    const graph = mvpAudioBlurPassPlanGraph();
    const instance = makeProgram(new Map());

    transferParametersFromGraph(graph, instance);

    expect(instance.setParameter).toHaveBeenCalledWith('n-stetra-ab', 'iterations', 3);
    expect(instance.setParameter).toHaveBeenCalledWith('n-stetra-ab', 'scale', 2.0);
    expect(instance.setParameter).toHaveBeenCalledWith('n-blur-stab', 'blurAmount', 0.0);
    expect(instance.setParameter).toHaveBeenCalledWith('n-blur-stab', 'blurRadius', 6.0);
  });

  it('applies graph scalar params for nodes wired to audio remap (glow-bloom pass-plan graph)', () => {
    const graph = mvpAudioGlowBloomPassPlanGraph();
    const instance = makeProgram(new Map());

    transferParametersFromGraph(graph, instance);

    expect(instance.setParameter).toHaveBeenCalledWith('n-stetra-gb', 'iterations', 3);
    expect(instance.setParameter).toHaveBeenCalledWith('n-stetra-gb', 'scale', 2.0);
    expect(instance.setParameter).toHaveBeenCalledWith('n-glow-stgb', 'glowThreshold', 0.45);
    expect(instance.setParameter).toHaveBeenCalledWith('n-glow-stgb', 'glowIntensity', 1.4);
  });

  it('applies graph scalar params for nodes wired to audio remap (bokeh pass-plan graph)', () => {
    const graph = mvpAudioBokehPassPlanGraph();
    const instance = makeProgram(new Map());

    transferParametersFromGraph(graph, instance);

    expect(instance.setParameter).toHaveBeenCalledWith('n-stetra-bk', 'iterations', 3);
    expect(instance.setParameter).toHaveBeenCalledWith('n-stetra-bk', 'scale', 2.0);
    expect(instance.setParameter).toHaveBeenCalledWith('n-bokeh-stbk', 'bokehThreshold', 0.35);
    expect(instance.setParameter).toHaveBeenCalledWith('n-bokeh-stbk', 'bokehRadius', 14.0);
  });

  it('applies graph scalar params for nodes wired to audio remap (crepuscular-rays pass-plan graph)', () => {
    const graph = mvpAudioCrepuscularRaysPassPlanGraph();
    const instance = makeProgram(new Map());

    transferParametersFromGraph(graph, instance);

    expect(instance.setParameter).toHaveBeenCalledWith('n-stetra-cr', 'iterations', 3);
    expect(instance.setParameter).toHaveBeenCalledWith('n-stetra-cr', 'scale', 2.0);
    expect(instance.setParameter).toHaveBeenCalledWith('n-crep-stcr', 'intensity', 1.4);
    expect(instance.setParameter).toHaveBeenCalledWith('n-crep-stcr', 'rayCount', 16);
  });
});
