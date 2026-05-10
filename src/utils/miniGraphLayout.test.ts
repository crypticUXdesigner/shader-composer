import { describe, expect, it } from 'vitest';
import { computeMiniGraphLayout } from './miniGraphLayout';
import type { SetupExampleGraph } from './ContextualHelpManager';

const M = {
  nodeWidth: 72,
  nodeHeight: 60,
  gapX: 24,
  gapY: 24,
  padding: 0,
};

describe('computeMiniGraphLayout', () => {
  it('lays out a simple chain in layers left to right', () => {
    const graph: SetupExampleGraph = {
      nodes: [
        { id: 'a', type: 'uv-coordinates' },
        { id: 'b', type: 'noise' },
        { id: 'c', type: 'final-output' },
      ],
      connections: [
        { from: 'a', fromPort: 'out', to: 'b', toPort: 'in' },
        { from: 'b', fromPort: 'out', to: 'c', toPort: 'in' },
      ],
    };
    const r = computeMiniGraphLayout(graph, M);
    expect(r.mode).toBe('layered');
    expect(r.positions.get('a')!.x).toBeLessThan(r.positions.get('b')!.x);
    expect(r.positions.get('b')!.x).toBeLessThan(r.positions.get('c')!.x);
    expect(r.positions.get('a')!.y).toBe(r.positions.get('b')!.y);
    expect(r.positions.get('b')!.y).toBe(r.positions.get('c')!.y);
  });

  it('places merge (diamond) with two nodes in the middle column', () => {
    const graph: SetupExampleGraph = {
      nodes: [
        { id: 'a', type: 'uv-coordinates' },
        { id: 'b', type: 'noise' },
        { id: 'c', type: 'noise' },
        { id: 'd', type: 'mix' },
      ],
      connections: [
        { from: 'a', fromPort: 'out', to: 'b', toPort: 'in' },
        { from: 'a', fromPort: 'out', to: 'c', toPort: 'in' },
        { from: 'b', fromPort: 'out', to: 'd', toPort: 'in' },
        { from: 'c', fromPort: 'out', to: 'd', toPort: 'in' },
      ],
    };
    const r = computeMiniGraphLayout(graph, M);
    expect(r.mode).toBe('layered');
    const xa = r.positions.get('a')!.x;
    const xb = r.positions.get('b')!.x;
    const xc = r.positions.get('c')!.x;
    const xd = r.positions.get('d')!.x;
    expect(xa).toBeLessThan(xb);
    expect(xb).toBe(xc);
    expect(Math.min(xb, xc)).toBeLessThan(xd);
    expect(r.positions.get('b')!.y).not.toBe(r.positions.get('c')!.y);
  });

  it('falls back to linear order when the graph has a cycle', () => {
    const graph: SetupExampleGraph = {
      nodes: [
        { id: 'a', type: 'uv-coordinates' },
        { id: 'b', type: 'noise' },
      ],
      connections: [
        { from: 'a', fromPort: 'out', to: 'b', toPort: 'in' },
        { from: 'b', fromPort: 'out', to: 'a', toPort: 'in' },
      ],
    };
    const r = computeMiniGraphLayout(graph, M);
    expect(r.mode).toBe('linear-fallback');
    expect(r.positions.get('a')!.x).toBeLessThan(r.positions.get('b')!.x);
    expect(r.positions.get('a')!.y).toBe(r.positions.get('b')!.y);
  });

  it('stacks disconnected nodes in one column when there are no edges', () => {
    const graph: SetupExampleGraph = {
      nodes: [
        { id: 'x', type: 'constant-float' },
        { id: 'y', type: 'constant-float' },
      ],
      connections: [],
    };
    const r = computeMiniGraphLayout(graph, M);
    expect(r.mode).toBe('layered');
    expect(r.positions.get('x')!.x).toBe(r.positions.get('y')!.x);
    expect(r.positions.get('x')!.y).toBeLessThan(r.positions.get('y')!.y);
  });
});
