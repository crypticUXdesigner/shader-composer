import { describe, expect, it } from 'vitest';
import { migrateArrangementLanesParameters } from './arrangementLanesParametersMigration';
import type { NodeGraph } from './types';

function graphWithLanes(params: Record<string, unknown>): NodeGraph {
  return {
    id: 'g',
    name: 'test',
    version: '2.0',
    nodes: [
      {
        id: 'lanes-1',
        type: 'arrangement-lanes',
        position: { x: 0, y: 0 },
        parameters: params,
      },
    ],
    connections: [],
  };
}

describe('migrateArrangementLanesParameters', () => {
  it('coerces numeric trackFilterList to empty string', () => {
    const graph = graphWithLanes({ trackFilterMode: 0, trackFilterList: 0 });
    const migrated = migrateArrangementLanesParameters(graph);
    expect(migrated.nodes[0].parameters.trackFilterList).toBe('');
  });

  it('leaves valid string trackFilterList unchanged', () => {
    const graph = graphWithLanes({ trackFilterList: 'track-a,track-b' });
    const migrated = migrateArrangementLanesParameters(graph);
    expect(migrated.nodes[0].parameters.trackFilterList).toBe('track-a,track-b');
  });
});
