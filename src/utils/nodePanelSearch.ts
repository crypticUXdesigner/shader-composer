import type { NodeSpec } from '../types/nodeSpec';
import { NODE_SEARCH_TAGS } from './nodeSearchTags';

/** Tags from the spec and the curated registry (deduplicated, lowercased). */
export function getNodeSearchTags(spec: NodeSpec): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (tag: string) => {
    const key = tag.toLowerCase().trim();
    if (key === '' || seen.has(key)) return;
    seen.add(key);
    out.push(key);
  };
  for (const tag of spec.searchTags ?? []) add(tag);
  for (const tag of NODE_SEARCH_TAGS[spec.id] ?? []) add(tag);
  return out;
}

/**
 * Default keyboard selection for a filtered palette list.
 * Prefers exact display name, then display-name prefix, then sole result.
 */
export function pickDefaultNodePanelSelectionIndex(specs: NodeSpec[], query: string): number {
  const q = query.toLowerCase().trim();
  if (specs.length === 0 || q === '') return -1;

  const exactIdx = specs.findIndex((s) => s.displayName.toLowerCase() === q);
  if (exactIdx >= 0) return exactIdx;

  const prefixIdx = specs.findIndex((s) => s.displayName.toLowerCase().startsWith(q));
  if (prefixIdx >= 0) return prefixIdx;

  if (specs.length === 1) return 0;

  return -1;
}

export function matchesNodePanelSearch(spec: NodeSpec, query: string): boolean {
  const q = query.toLowerCase().trim();
  if (q === '') return true;

  if (spec.displayName.toLowerCase().includes(q)) return true;
  if (spec.category.toLowerCase().includes(q)) return true;

  return getNodeSearchTags(spec).some((tag) => tag.includes(q));
}
