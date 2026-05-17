import { describe, expect, it } from 'vitest';
import type { NodeSpec } from '../types/nodeSpec';
import {
  compareNodeSpecsForPanel,
  flattenGroupedNodeSpecs,
  groupNodeSpecsByPanelCategory,
  NODE_PANEL_CATEGORY_ORDER,
  sortNodePanelCategories,
} from './nodePanelCategoryOrder';

function spec(id: string, category: string, displayName = id): NodeSpec {
  return {
    id,
    displayName,
    category,
    inputs: [],
    outputs: [],
  } as NodeSpec;
}

describe('nodePanelCategoryOrder', () => {
  it('sortNodePanelCategories follows NODE_PANEL_CATEGORY_ORDER', () => {
    const shuffled = ['Math', 'Distort', 'Output', 'Patterns'];
    expect(sortNodePanelCategories(shuffled)).toEqual(['Distort', 'Patterns', 'Output', 'Math']);
  });

  it('unknown categories sort after known ones alphabetically', () => {
    expect(sortNodePanelCategories(['ZZZ', 'Distort', 'AAA'])).toEqual(['Distort', 'AAA', 'ZZZ']);
  });

  it('compareNodeSpecsForPanel orders by panel category then name', () => {
    const a = spec('a', 'Math', 'Add');
    const b = spec('b', 'Distort', 'Warp');
    expect(compareNodeSpecsForPanel(a, b)).toBeGreaterThan(0);
    expect(compareNodeSpecsForPanel(b, a)).toBeLessThan(0);
  });

  it('groupNodeSpecsByPanelCategory preserves panel section order', () => {
    const grouped = groupNodeSpecsByPanelCategory([
      spec('m', 'Math'),
      spec('d', 'Distort'),
      spec('p', 'Patterns'),
    ]);
    expect(grouped.map((g) => g.category)).toEqual(['Distort', 'Patterns', 'Math']);
  });

  it('flattenGroupedNodeSpecs matches on-screen row order', () => {
    const grouped = groupNodeSpecsByPanelCategory([
      spec('blend', 'Blend', 'Blend'),
      spec('grad', 'Patterns', 'Gradient'),
    ]);
    expect(flattenGroupedNodeSpecs(grouped).map((s) => s.id)).toEqual(['grad', 'blend']);
  });

  it('NODE_PANEL_CATEGORY_ORDER matches user-goals browse order', () => {
    expect(NODE_PANEL_CATEGORY_ORDER).toEqual([
      'Distort',
      'Patterns',
      'Shapes',
      'SDF',
      'Blend',
      'Mask',
      'Effects',
      'Audio',
      'Inputs',
      'Output',
      'Math',
      'Utilities',
    ]);
  });
});
