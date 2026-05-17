/**
 * Parameters stored as numbers in the graph but baked into generated shader code
 * (not live uniforms). Changing them must trigger recompile, not uniform-only updates.
 *
 * Drift is guarded by `compileTimeBakeParams.test.ts` (same pattern as `runtimeOnlyParams.ts`).
 */

/** Exact (node id, param name) pairs — sorted by node id, then param name. */
export const COMPILE_TIME_BAKE_EXACT_ENTRIES: ReadonlyArray<readonly [string, string]> = [
  ['arrangement-lanes', 'trackFilterMode'],
  ['arrangement-notes', 'noteColorMode'],
  ['arrangement-notes', 'trackFilterList'],
  ['arrangement-notes', 'trackFilterMode'],
  ['arrangement-notes', 'trackLayout'],
  ['arrangement-notes', 'trackNoteColors'],
  ['color-lut', 'preset'],
];

function buildExactMap(entries: ReadonlyArray<readonly [string, string]>): Record<string, Set<string>> {
  const out: Record<string, Set<string>> = {};
  for (const [nodeType, paramName] of entries) {
    let set = out[nodeType];
    if (!set) {
      set = new Set();
      out[nodeType] = set;
    }
    set.add(paramName);
  }
  return out;
}

const COMPILE_TIME_BAKE_EXACT: Record<string, Set<string>> = buildExactMap(COMPILE_TIME_BAKE_EXACT_ENTRIES);

/**
 * True when a scalar graph parameter affects compile-time bake tables (arrangement notes/lanes, etc.).
 */
export function isCompileTimeBakeParameter(nodeType: string, paramName: string): boolean {
  return COMPILE_TIME_BAKE_EXACT[nodeType]?.has(paramName) ?? false;
}
