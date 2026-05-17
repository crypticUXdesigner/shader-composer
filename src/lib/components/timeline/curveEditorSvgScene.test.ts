import { describe, expect, it } from 'vitest';
import type { AutomationCurve } from '../../../data-model/types';
import {
  buildCurveEditorCurvePathD,
  buildCurveEditorGridLines,
  snapCurveEditorSvgCoord,
} from './curveEditorSvgScene';

describe('curveEditorSvgScene', () => {
  it('builds a non-empty path for a two-keyframe linear curve', () => {
    const curve: AutomationCurve = {
      keyframes: [
        { time: 0, value: 0 },
        { time: 1, value: 1 },
      ],
      interpolation: 'linear',
    };
    const d = buildCurveEditorCurvePathD(curve, 200, 100);
    expect(d.length).toBeGreaterThan(10);
    expect(d.startsWith('M ')).toBe(true);
  });

  it('builds vertical grid lines for bar/division step', () => {
    const { vertical, horizontal } = buildCurveEditorGridLines(200, 100, 4, 1);
    expect(vertical.length).toBeGreaterThan(2);
    expect(horizontal.length).toBe(3);
  });

  it('snapCurveEditorSvgCoord rounds to half pixels', () => {
    expect(snapCurveEditorSvgCoord(10.24)).toBe(10);
    expect(snapCurveEditorSvgCoord(10.26)).toBe(10.5);
  });
});
