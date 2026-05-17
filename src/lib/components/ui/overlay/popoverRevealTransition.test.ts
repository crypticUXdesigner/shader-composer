/** @vitest-environment happy-dom */
import { describe, expect, it } from 'vitest';
import { popoverReveal, readPopoverRevealParams } from './popoverRevealTransition';

describe('popoverReveal', () => {
  it('fades and slides on the inner wrapper only', () => {
    const node = document.createElement('div');
    const config = popoverReveal(node, { duration: 165, y: 16 });
    expect(config.duration).toBe(165);
    const css = config.css?.(0.5, 0.5);
    expect(css).toBe('opacity: 0.5; transform: translateY(8px);');
  });

  it('returns instant config when duration is zero', () => {
    const node = document.createElement('div');
    expect(popoverReveal(node, { duration: 0, y: 16 }).duration).toBe(0);
  });

  it('readPopoverRevealParams disables motion when reduced', () => {
    expect(readPopoverRevealParams(true)).toEqual({ duration: 0, y: 0 });
  });
});
