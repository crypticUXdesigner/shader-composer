import { describe, it, expect } from 'vitest';
import { buildArrangementSnapshot } from './buildArrangementSnapshot';
import type { RawArrangementEntities } from './rawEntities';
import spikeFixture from './__fixtures__/spike-arrangement-raw.json';
import type { NodeGraph } from '../../data-model/types';
import { getArrangementNotesBakeCache } from './arrangementNotesBakeCache';
import { refreshArrangementNotesBakeCacheFromGraph } from './refreshArrangementNotesBakeCache';

const snapshot = buildArrangementSnapshot(spikeFixture as RawArrangementEntities);

const graph: NodeGraph = {
  id: 'g',
  name: 't',
  version: '2.0',
  nodes: [
    {
      id: 'n-notes',
      type: 'arrangement-notes',
      position: { x: 0, y: 0 },
      parameters: {},
    },
  ],
  connections: [],
};

describe('refreshArrangementNotesBakeCacheFromGraph', () => {
  it('populates main-thread cache after compile (worker cannot share module state)', () => {
    refreshArrangementNotesBakeCacheFromGraph(graph, snapshot);
    expect(getArrangementNotesBakeCache('n-notes')).toHaveLength(3);
  });
});
