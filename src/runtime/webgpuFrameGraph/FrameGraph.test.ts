import { describe, expect, it } from 'vitest';
import { FrameGraph } from './FrameGraph';
import { swapPingPong } from './pingPong';
import { ResourcePool } from './ResourcePool';

describe('FrameGraph', () => {
  it('executes passes in dependency order (writer before reader)', () => {
    const order: string[] = [];
    const fg = new FrameGraph();

    fg.addPass({
      id: 'A',
      kind: 'render',
      writes: ['tex0'],
      execute: () => order.push('A'),
    });
    fg.addPass({
      id: 'B',
      kind: 'render',
      reads: ['tex0'],
      execute: () => order.push('B'),
    });

    fg.execute();
    expect(order).toEqual(['A', 'B']);
  });

  it('rejects multiple writers for the same resource id (MVP constraint)', () => {
    const fg = new FrameGraph();
    fg.addPass({ id: 'A', kind: 'render', writes: ['tex0'], execute: () => {} });
    fg.addPass({ id: 'B', kind: 'render', writes: ['tex0'], execute: () => {} });
    expect(() => fg.compile()).toThrow(/written by multiple passes/i);
  });
});

describe('ping-pong', () => {
  it('swaps read/write', () => {
    const p = { read: 'r0', write: 'w0' };
    const s = swapPingPong(p);
    expect(s).toEqual({ read: 'w0', write: 'r0' });
  });
});

describe('ResourcePool', () => {
  it('reuses released resources by key', () => {
    let created = 0;
    const pool = new ResourcePool<{ id: number }>({
      create: () => ({ id: created++ }),
      destroy: () => {},
    });
    pool.beginFrame(1);
    const a = pool.acquire('k');
    pool.release(a);
    pool.beginFrame(2);
    const b = pool.acquire('k');
    expect(b).toBe(a);
  });
});

