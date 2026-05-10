/**
 * Node Power eligibility policy.
 *
 * Pure, synchronous helpers that answer "can this node be powered off?" and
 * "if it is, which bypass rule applies?" — derived entirely from `NodeSpec`.
 * Both UI (NodeHeader Power button) and compiler (passthrough/disconnect)
 * import this module so eligibility never drifts between layers.
 *
 * See `docs/implementation/node-power/_OVERVIEW.md` for the rule definitions.
 *
 * Note: Categories are aligned to the actual strings used in
 * `src/shaders/nodes/**` (audited 2026-05-10). The `_OVERVIEW.md` table lists
 * "Color System" conceptually, but those nodes are tagged in code as
 * `'Inputs'`, `'Effects'`, or `'Blend'` — so listing those three already
 * covers the color system. `'Utilities'` and `'Mask'` are intentionally
 * excluded (math, utility, masking/control nodes are out of scope).
 */
import type { NodeSpec } from '../types/nodeSpec';

export const POWER_ELIGIBLE_CATEGORIES: ReadonlySet<string> = new Set([
  'Distort',
  'Effects',
  'Blend',
  'Inputs',
  'Patterns',
  'Shapes',
  'SDF',
]);

export type NodePowerRule = 'A' | 'B' | 'none';

/**
 * Decide which bypass rule applies to a node *if* it were powered off.
 *
 *  - `'none'` — the node has no outputs (e.g. `final-output`); cannot be bypassed.
 *  - `'A'`    — passthrough: `inputs[0].type === outputs[0].type`. Bypassed
 *               node emits `out = inputs[0]`.
 *  - `'B'`    — disconnect: no inputs, or `inputs[0].type !== outputs[0].type`.
 *               Bypassed node behaves as if its outgoing wires didn't exist;
 *               consumers fall back to their own port defaults.
 */
export function nodePowerRule(spec: NodeSpec): NodePowerRule {
  if (spec.outputs.length === 0) return 'none';
  if (spec.inputs.length >= 1 && spec.inputs[0].type === spec.outputs[0].type) {
    return 'A';
  }
  return 'B';
}

/**
 * Should the UI offer a Power button for this node?
 *
 * Eligibility = category in the allowlist AND a defined bypass rule applies.
 * The `'none'` guard is defense-in-depth: even if a node from an excluded
 * category somehow slipped past the allowlist, a node with no outputs is
 * still not bypassable.
 */
export function nodeSupportsPower(spec: NodeSpec): boolean {
  return (
    POWER_ELIGIBLE_CATEGORIES.has(spec.category) && nodePowerRule(spec) !== 'none'
  );
}
