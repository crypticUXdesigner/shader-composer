import { describe, it, expect } from 'vitest';
import { advanceRadialPulseSchmitt } from './radialPulseSchmitt';

describe('advanceRadialPulseSchmitt', () => {
  const rise = 0.55;
  const fall = 0.35;

  it('fires once from low to high while armed then requires drop past fall before re-fire', () => {
    let armed = true;

    ({ armed } = advanceRadialPulseSchmitt(armed, 0.2, rise, fall));
    expect(armed).toBe(true);

    let fired = false;
    ({ armed, fired } = advanceRadialPulseSchmitt(armed, 0.6, rise, fall));
    expect(fired).toBe(true);
    expect(armed).toBe(false);

    ({ armed, fired } = advanceRadialPulseSchmitt(armed, 0.6, rise, fall));
    expect(fired).toBe(false);
    expect(armed).toBe(false);

    ({ armed } = advanceRadialPulseSchmitt(armed, 0.3, rise, fall));
    expect(armed).toBe(true);

    ({ armed, fired } = advanceRadialPulseSchmitt(armed, 0.6, rise, fall));
    expect(fired).toBe(true);
    expect(armed).toBe(false);
  });

  it('does not fire when hovering between thresholds after a fire until fall', () => {
    let armed = true;
    let fired = false;
    ({ armed, fired } = advanceRadialPulseSchmitt(armed, 0.62, rise, fall));
    expect(fired).toBe(true);
    expect(armed).toBe(false);

    ({ armed, fired } = advanceRadialPulseSchmitt(armed, 0.5, rise, fall));
    expect(fired).toBe(false);
    expect(armed).toBe(false);
  });

  it('swaps rise/fall when mis-ordered', () => {
    let armed = true;
    const flipped = advanceRadialPulseSchmitt(armed, 0.6, 0.35, 0.55);
    expect(flipped.fired).toBe(true);
  });

  it('flatline at threshold: fires once then stays muted until fall', () => {
    let armed = true;
    let fired = false;
    ({ armed, fired } = advanceRadialPulseSchmitt(armed, rise, rise, fall));
    expect(fired).toBe(true);
    expect(armed).toBe(false);

    ({ armed, fired } = advanceRadialPulseSchmitt(armed, rise, rise, fall));
    expect(fired).toBe(false);
    expect(armed).toBe(false);
  });
});
