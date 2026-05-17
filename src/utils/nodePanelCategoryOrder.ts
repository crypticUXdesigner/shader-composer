import type { NodeSpec } from '../types/nodeSpec';

/** Browse order for node library sections — keep in sync with `docs/user-goals/03-node-panel.md`. */
export const NODE_PANEL_CATEGORY_ORDER: readonly string[] = [
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
] as const;

export function sortNodePanelCategories(categories: string[]): string[] {
  return [...categories].sort((a, b) => {
    const aIndex = NODE_PANEL_CATEGORY_ORDER.indexOf(a);
    const bIndex = NODE_PANEL_CATEGORY_ORDER.indexOf(b);
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    return a.localeCompare(b);
  });
}

export function compareNodeSpecsForPanel(a: NodeSpec, b: NodeSpec, query = ''): number {
  const q = query.toLowerCase().trim();
  if (q !== '') {
    const aExact = a.displayName.toLowerCase() === q;
    const bExact = b.displayName.toLowerCase() === q;
    if (aExact && !bExact) return -1;
    if (!aExact && bExact) return 1;
  }
  const aCat = NODE_PANEL_CATEGORY_ORDER.indexOf(a.category);
  const bCat = NODE_PANEL_CATEGORY_ORDER.indexOf(b.category);
  const aOrder = aCat === -1 ? Number.MAX_SAFE_INTEGER : aCat;
  const bOrder = bCat === -1 ? Number.MAX_SAFE_INTEGER : bCat;
  if (aOrder !== bOrder) return aOrder - bOrder;
  if (a.category !== b.category) return a.category.localeCompare(b.category);
  return a.displayName.localeCompare(b.displayName);
}

export function groupNodeSpecsByPanelCategory(
  specs: NodeSpec[]
): { category: string; nodes: NodeSpec[] }[] {
  const map = new Map<string, NodeSpec[]>();
  for (const spec of specs) {
    if (!map.has(spec.category)) map.set(spec.category, []);
    map.get(spec.category)!.push(spec);
  }
  return sortNodePanelCategories(Array.from(map.keys())).map((category) => ({
    category,
    nodes: map.get(category)!,
  }));
}

/** Flatten grouped panel rows in the same order they appear in the list UI. */
export function flattenGroupedNodeSpecs(
  groups: { category: string; nodes: NodeSpec[] }[]
): NodeSpec[] {
  return groups.flatMap((g) => g.nodes);
}

export function isNodePanelCategoryDividerStart(category: string): boolean {
  return category === 'Inputs' || category === 'Blend' || category === 'Math';
}
