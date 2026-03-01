/**
 * Shared persistence for floating panel positions (e.g. per panel type and variant).
 * Each panel type can have its own coordinates; variants (e.g. "large" vs "compact")
 * each get a separate stored position. Use getStoredPosition when opening a panel,
 * and setStoredPosition in onPositionChange when the user drags it.
 */

const STORAGE_KEY_PREFIX = 'shader-composer.floatingPanel.';

export interface StoredPositionOptions {
  /** Variant of the panel (e.g. "large" | "compact"). Each variant has its own position. */
  variant?: string;
  /** Fallback position when nothing is stored (e.g. screen center). */
  fallback: { x: number; y: number };
  /** Legacy localStorage key(s) to try in order after the default key (for migration). */
  legacyKey?: string | string[];
}

/**
 * Build the localStorage key for a panel (and optional variant).
 */
export function buildStorageKey(panelId: string, variant?: string): string {
  if (variant) {
    return `${STORAGE_KEY_PREFIX}${panelId}.${variant}`;
  }
  return `${STORAGE_KEY_PREFIX}${panelId}`;
}

/**
 * Read stored position for a panel. Tries: default key (with variant) → legacyKey → fallback.
 */
export function getStoredPosition(
  panelId: string,
  options: StoredPositionOptions
): { x: number; y: number } {
  const { variant, fallback, legacyKey } = options;

  const read = (key: string): { x: number; y: number } | null => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { x?: number; y?: number };
      if (
        typeof parsed?.x === 'number' &&
        typeof parsed?.y === 'number'
      ) {
        return { x: parsed.x, y: parsed.y };
      }
    } catch {
      /* ignore */
    }
    return null;
  };

  const key = buildStorageKey(panelId, variant);
  const legacyKeys = legacyKey === undefined
    ? []
    : Array.isArray(legacyKey)
      ? legacyKey
      : [legacyKey];
  const stored =
    read(key) ??
    legacyKeys.reduce<{ x: number; y: number } | null>(
      (acc, k) => acc ?? read(k),
      null
    );
  return stored ?? fallback;
}

/**
 * Persist position for a panel (and optional variant). Call from onPositionChange.
 */
export function setStoredPosition(
  panelId: string,
  x: number,
  y: number,
  variant?: string
): void {
  try {
    const key = buildStorageKey(panelId, variant);
    localStorage.setItem(key, JSON.stringify({ x, y }));
  } catch {
    /* ignore */
  }
}
