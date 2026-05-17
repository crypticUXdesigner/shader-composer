import { describe, it, expect, vi } from 'vitest';
import type { NodeGraph } from '../../data-model/types';
import { setArrangementNotesBakeCache } from '../../audiotool/arrangement/arrangementNotesBakeCache';
import { resolveArrangementNotesPreviewLoopBudget } from '../../audiotool/arrangement/arrangementNotesVisibleRange';
import { applyArrangementNotesLoopUniforms } from './arrangementNotesPreviewLoop';

describe('applyArrangementNotesLoopUniforms', () => {
  it('sets loop bounds from visible timeline window', () => {
    const notes = Array.from({ length: 200 }, (_, i) => ({
      startSeconds: i * 0.5,
      endSeconds: i * 0.5 + 0.4,
      pitch: 60,
      velocity: 1,
    }));
    setArrangementNotesBakeCache('n1', notes);

    const graph: NodeGraph = {
      id: 'g',
      name: 't',
      version: '2.0',
      nodes: [
        {
          id: 'n1',
          type: 'arrangement-notes',
          position: { x: 0, y: 0 },
          parameters: { windowSeconds: 32, timelineAnchor: 0 },
        },
      ],
      connections: [],
    };

    const setParameter = vi.fn();
    applyArrangementNotesLoopUniforms({
      graph,
      shaderInstance: { setParameter } as never,
      timelineTime: 50,
    });

    expect(setParameter).toHaveBeenCalledWith('n1', 'noteLoopStart', expect.any(Number));
    expect(setParameter).toHaveBeenCalledWith('n1', 'noteLoopEnd', expect.any(Number));
    const start = setParameter.mock.calls.find((c) => c[1] === 'noteLoopStart')?.[2] as number;
    const end = setParameter.mock.calls.find((c) => c[1] === 'noteLoopEnd')?.[2] as number;
    expect(end - start).toBeLessThan(120);
    expect(end - start).toBeGreaterThan(10);
  });

  it('caps loop bounds when all baked notes overlap the visible window', () => {
    const notes = Array.from({ length: 1400 }, (_, i) => ({
      startSeconds: 0,
      endSeconds: 100,
      pitch: 60 + (i % 12),
      velocity: 1,
    }));
    setArrangementNotesBakeCache('n1', notes);

    const graph: NodeGraph = {
      id: 'g',
      name: 't',
      version: '2.0',
      nodes: [
        {
          id: 'n1',
          type: 'arrangement-notes',
          position: { x: 0, y: 0 },
          parameters: { windowSeconds: 100, timelineAnchor: 0 },
        },
      ],
      connections: [],
    };

    const setParameter = vi.fn();
    applyArrangementNotesLoopUniforms({
      graph,
      shaderInstance: { setParameter } as never,
      timelineTime: 50,
    });

    const start = setParameter.mock.calls.find((c) => c[1] === 'noteLoopStart')?.[2] as number;
    const end = setParameter.mock.calls.find((c) => c[1] === 'noteLoopEnd')?.[2] as number;
    expect(end - start).toBe(resolveArrangementNotesPreviewLoopBudget(1400));
  });
});
