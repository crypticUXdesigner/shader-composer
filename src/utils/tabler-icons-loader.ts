/**
 * Tabler Icons Data Loader
 * Loads Tabler icon JSON data files
 */

// Use dynamic import to load JSON files
let tablerNodesOutline: any = null;
let tablerNodesFilled: any = null;
let loadingPromise: Promise<void> | null = null;

export async function loadTablerIconData(): Promise<void> {
  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
    try {
      // Load from public directory (files should be copied there)
      const base = import.meta.env.BASE_URL || '/';
      const [outlineRes, filledRes] = await Promise.all([
        fetch(`${base}tabler-nodes-outline.json`).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`${base}tabler-nodes-filled.json`).then(r => r.ok ? r.json() : null).catch(() => null)
      ]);
      
      if (outlineRes) {
        tablerNodesOutline = outlineRes;
      }
      if (filledRes) {
        tablerNodesFilled = filledRes;
      }
    } catch (e) {
      console.warn('Could not load Tabler icon data:', e);
    }
  })();

  return loadingPromise;
}

export function getTablerNodesOutline(): any {
  return tablerNodesOutline || {};
}

export function getTablerNodesFilled(): any {
  return tablerNodesFilled || {};
}

// Preload on module load
if (typeof window !== 'undefined') {
  loadTablerIconData();
}
