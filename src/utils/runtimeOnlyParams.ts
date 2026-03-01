/**
 * Single source of truth for parameters that live in the graph but do not generate
 * shader uniforms (runtime-only). Used by UniformGenerator, CompilationManager,
 * RuntimeManager, and ExportRenderPath so behavior is consistent.
 *
 * To add a new runtime-only parameter: add the exact name to RUNTIME_ONLY_EXACT
 * for the node type, or add a RegExp to RUNTIME_ONLY_PATTERNS if the name is
 * pattern-based.
 */

/** Exact parameter names that are runtime-only (no shader uniform) per node type. */
const RUNTIME_ONLY_EXACT: Record<string, Set<string>> = {};

/**
 * Regex patterns for runtime-only params.
 * Param names matching any pattern for the node type are treated as runtime-only.
 */
const RUNTIME_ONLY_PATTERNS: Record<string, RegExp[]> = {};

/**
 * Returns true if the given (nodeType, paramName) is runtime-only (no shader uniform).
 */
export function isRuntimeOnlyParameter(nodeType: string, paramName: string): boolean {
  const exact = RUNTIME_ONLY_EXACT[nodeType];
  if (exact?.has(paramName)) return true;
  const patterns = RUNTIME_ONLY_PATTERNS[nodeType];
  if (patterns) {
    for (const re of patterns) {
      if (re.test(paramName)) return true;
    }
  }
  return false;
}
