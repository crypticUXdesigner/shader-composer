import { describe, expect, it } from 'vitest';
import { nodeSystemSpecs } from '../shaders/nodes/index';
import { COMPILE_TIME_BAKE_EXACT_ENTRIES, isCompileTimeBakeParameter } from './compileTimeBakeParams';

const specById = new Map(nodeSystemSpecs.map((s) => [s.id, s]));

function compareEntry(a: readonly [string, string], b: readonly [string, string]): number {
  const c = a[0].localeCompare(b[0]);
  if (c !== 0) return c;
  return a[1].localeCompare(b[1]);
}

describe('compileTimeBakeParams registry', () => {
  it('keeps COMPILE_TIME_BAKE_EXACT_ENTRIES strictly sorted and unique', () => {
    for (let i = 1; i < COMPILE_TIME_BAKE_EXACT_ENTRIES.length; i++) {
      const prev = COMPILE_TIME_BAKE_EXACT_ENTRIES[i - 1]!;
      const curr = COMPILE_TIME_BAKE_EXACT_ENTRIES[i]!;
      expect(compareEntry(prev, curr)).toBeLessThan(0);
    }
  });

  it('maps every exact entry to a real NodeSpec parameter', () => {
    for (const [nodeId, paramName] of COMPILE_TIME_BAKE_EXACT_ENTRIES) {
      const spec = specById.get(nodeId);
      expect(spec, `unknown node id in compile-time bake registry: ${nodeId}`).toBeDefined();
      expect(
        Object.prototype.hasOwnProperty.call(spec!.parameters, paramName),
        `compile-time bake param "${paramName}" missing from NodeSpec.parameters for ${nodeId}`
      ).toBe(true);
      expect(isCompileTimeBakeParameter(nodeId, paramName)).toBe(true);
    }
  });

  it('does not mark unrelated arrangement-notes params as bake-only', () => {
    expect(isCompileTimeBakeParameter('arrangement-notes', 'layoutOrientation')).toBe(false);
    expect(isCompileTimeBakeParameter('arrangement-notes', 'windowSeconds')).toBe(false);
  });
});
