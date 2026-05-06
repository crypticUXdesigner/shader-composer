/**
 * Persisted recent node type ids for the canvas Add picker (deduplicated, max 5).
 */
const STORAGE_KEY = 'shader-noice.recent-node-types-v1';
const MAX = 5;

export function loadRecentNodeTypes(): string[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === 'string').slice(0, MAX);
  } catch {
    return [];
  }
}

export function pushRecentNodeType(nodeType: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const prev = loadRecentNodeTypes().filter((t) => t !== nodeType);
    const next = [nodeType, ...prev].slice(0, MAX);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore quota / private mode
  }
}
