import { describe, it, expect } from 'vitest';
import { remapValue } from './remapValue';

describe('remapValue', () => {
  it('maps across input range to output range with clamp', () => {
    expect(remapValue(0.5, 0, 1, 0, 10)).toBe(5);
    expect(remapValue(2, 0, 1, 0, 10)).toBe(10);
    expect(remapValue(-1, 0, 1, 0, 10)).toBe(0);
  });

  it('returns midpoint when value is nullish', () => {
    expect(remapValue(null, 0, 1, 0, 10)).toBe(5);
    expect(remapValue(undefined, 0, 1, -1, 1)).toBe(0);
  });

  it('treats zero input range as normalized 0', () => {
    expect(remapValue(0.5, 1, 1, 0, 10)).toBe(0);
  });
});
