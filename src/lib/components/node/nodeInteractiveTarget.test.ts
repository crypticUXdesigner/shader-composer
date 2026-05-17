/** @vitest-environment happy-dom */

import { describe, expect, it } from 'vitest';
import { isNodeInteractiveTarget } from './nodeInteractiveTarget';

describe('isNodeInteractiveTarget', () => {
  it('returns true for parameter controls', () => {
    document.body.innerHTML = `
      <div class="node">
        <button type="button" class="toggle"></button>
        <div class="enum-selector-row"><button type="button">Preset</button></div>
      </div>
    `;
    const toggle = document.querySelector('.toggle')!;
    const enumBtn = document.querySelector('.enum-selector-row button')!;
    expect(isNodeInteractiveTarget(toggle)).toBe(true);
    expect(isNodeInteractiveTarget(enumBtn)).toBe(true);
  });

  it('returns false for node chrome outside controls', () => {
    document.body.innerHTML = `
      <div class="node-body">
        <div class="param-cell"><span class="label">Gamma</span></div>
      </div>
    `;
    const label = document.querySelector('.label')!;
    expect(isNodeInteractiveTarget(label)).toBe(false);
  });
});
