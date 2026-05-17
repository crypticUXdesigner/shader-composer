import { describe, expect, it } from 'vitest';
import { nodeSystemSpecs } from '../shaders/nodes';
import type { NodeSpec } from '../types/nodeSpec';
import { NODE_SEARCH_TAGS } from './nodeSearchTags';
import {
  getNodeSearchTags,
  matchesNodePanelSearch,
  pickDefaultNodePanelSelectionIndex,
} from './nodePanelSearch';

function spec(
  id: string,
  displayName: string,
  category: string,
  extras: Partial<NodeSpec> = {}
): NodeSpec {
  return {
    id,
    displayName,
    category,
    inputs: [],
    outputs: [],
    parameters: {},
    mainCode: '',
    ...extras,
  } as NodeSpec;
}

describe('nodePanelSearch', () => {
  it('matches display name and category', () => {
    const s = spec('noise', 'Noise', 'Patterns');
    expect(matchesNodePanelSearch(s, 'noi')).toBe(true);
    expect(matchesNodePanelSearch(s, 'pattern')).toBe(true);
  });

  it('does not match description text', () => {
    const s = spec('julia-slab-sdf', 'Julia Slab SDF', 'SDF', {
      description: 'then combines with a slab',
    });
    expect(matchesNodePanelSearch(s, 'combine')).toBe(false);
  });

  it('pickDefaultNodePanelSelectionIndex prefers exact then prefix match', () => {
    const specs = [
      spec('noise', 'Noise', 'Patterns'),
      spec('blend', 'Blend', 'Blend'),
      spec('blur', 'Blur', 'Effects'),
    ];
    expect(pickDefaultNodePanelSelectionIndex(specs, 'blend')).toBe(1);
    expect(pickDefaultNodePanelSelectionIndex(specs, 'bl')).toBe(1);
    expect(pickDefaultNodePanelSelectionIndex(specs, 'no')).toBe(0);
    expect(pickDefaultNodePanelSelectionIndex(specs, 'xyz')).toBe(-1);
    expect(pickDefaultNodePanelSelectionIndex([spec('only', 'Math', 'Only')], 'x')).toBe(0);
  });

  it('matches curated search tags', () => {
    const s = spec('combine-vector', 'Combine Vector', 'Utilities');
    expect(matchesNodePanelSearch(s, 'combine')).toBe(true);
    expect(matchesNodePanelSearch(s, 'pack')).toBe(true);
  });

  it('matches spec.searchTags and merges with registry', () => {
    const s = spec('custom-node', 'Custom', 'Utilities', {
      searchTags: ['alias', 'combine'],
    });
    expect(getNodeSearchTags(s)).toEqual(['alias', 'combine']);
    expect(matchesNodePanelSearch(s, 'alias')).toBe(true);
  });

  it('honeycomb description no longer matches comb', () => {
    const s = spec('hexagonal-grid', 'Hex Grid', 'Patterns', {
      description: 'Honeycomb / hexagonal tiling',
    });
    expect(matchesNodePanelSearch(s, 'comb')).toBe(false);
    expect(matchesNodePanelSearch(s, 'hex')).toBe(true);
  });

  it('every registered node has at least one search tag', () => {
    for (const nodeSpec of nodeSystemSpecs) {
      expect(NODE_SEARCH_TAGS[nodeSpec.id], nodeSpec.id).toBeDefined();
      expect(getNodeSearchTags(nodeSpec).length, nodeSpec.id).toBeGreaterThan(0);
    }
  });

  it('search tag registry has no orphan node ids', () => {
    const ids = new Set(nodeSystemSpecs.map((s) => s.id));
    for (const id of Object.keys(NODE_SEARCH_TAGS)) {
      expect(ids.has(id), `orphan tag entry: ${id}`).toBe(true);
    }
  });
});
