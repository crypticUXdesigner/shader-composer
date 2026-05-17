import { describe, expect, it } from 'vitest';
import type { NodeInstance } from '../data-model/types';
import { evaluatePathDrivePortPreview } from './pathDrivePreview';

function pathDriveNode(overrides: Record<string, number> = {}): NodeInstance {
  return {
    id: 'pd-test',
    type: 'path-drive',
    position: { x: 0, y: 0 },
    parameters: {
      pathPreset: 0,
      size: 0.5,
      speed: 0,
      centerX: 0.1,
      centerY: -0.2,
      wander: 0,
      jitter: 0,
      aspect: 1,
      phase: 0,
      lineAngle: 0,
      pulseDepth: 0.5,
      rotate: 0,
      rotationSpeed: 0,
      rotationPhase: 0,
      ...overrides,
    },
  };
}

describe('evaluatePathDrivePortPreview', () => {
  it('at speed 0 returns center plus orbit offset at phase', () => {
    const node = pathDriveNode({ speed: 0, size: 0.4, phase: 0 });
    const x = evaluatePathDrivePortPreview(node, 'x');
    const y = evaluatePathDrivePortPreview(node, 'y');
    expect(x).toBeCloseTo(0.1 + 0.4, 4);
    expect(y).toBeCloseTo(-0.2, 4);
  });

  it('orbit preset with size 0 yields center only', () => {
    const node = pathDriveNode({ size: 0, speed: 1 });
    expect(evaluatePathDrivePortPreview(node, 'x')).toBeCloseTo(0.1, 4);
    expect(evaluatePathDrivePortPreview(node, 'y')).toBeCloseTo(-0.2, 4);
  });

  it('90° rotate swaps orbit offset axes at speed 0', () => {
    const node = pathDriveNode({ speed: 0, size: 0.4, phase: 0, rotate: 90, centerX: 0, centerY: 0 });
    const x = evaluatePathDrivePortPreview(node, 'x');
    const y = evaluatePathDrivePortPreview(node, 'y');
    expect(x).toBeCloseTo(0, 2);
    expect(y).toBeCloseTo(0.4, 2);
  });

  it('line preset moves along angle axis', () => {
    const node = pathDriveNode({
      pathPreset: 4,
      size: 1,
      speed: 0,
      phase: 0,
      lineAngle: 90,
      centerX: 0,
      centerY: 0,
    });
    const x = evaluatePathDrivePortPreview(node, 'x');
    expect(Math.abs(x)).toBeLessThan(0.02);
    expect(Math.abs(evaluatePathDrivePortPreview(node, 'y'))).toBeGreaterThan(0.9);
  });

  it.each([
    { preset: 0, label: 'orbit' },
    { preset: 1, label: 'figure-8' },
    { preset: 3, label: 'pulse' },
    { preset: 4, label: 'line' },
  ])('$label preset rotate pivots at center', ({ preset }) => {
    const base = {
      pathPreset: preset,
      size: 0.5,
      speed: 0,
      phase: 0,
      centerX: 0.3,
      centerY: -0.1,
      wander: 0,
      jitter: 0,
    };
    const at0 = pathDriveNode({ ...base, rotate: 0 });
    const at90 = pathDriveNode({ ...base, rotate: 90 });
    const cx = 0.3;
    const cy = -0.1;
    const x0 = evaluatePathDrivePortPreview(at0, 'x');
    const y0 = evaluatePathDrivePortPreview(at0, 'y');
    const x90 = evaluatePathDrivePortPreview(at90, 'x');
    const y90 = evaluatePathDrivePortPreview(at90, 'y');
    const r0 = Math.hypot(x0 - cx, y0 - cy);
    const r90 = Math.hypot(x90 - cx, y90 - cy);
    expect(r0).toBeGreaterThan(0.05);
    expect(r90).toBeCloseTo(r0, 3);
  });

  it('line preset rotate pivots at center, not world origin', () => {
    const base = {
      pathPreset: 4,
      size: 0.5,
      speed: 0,
      phase: 0,
      lineAngle: 0,
      centerX: 0.3,
      centerY: -0.1,
      wander: 0,
      jitter: 0,
    };
    const at0 = pathDriveNode({ ...base, rotate: 0 });
    const at90 = pathDriveNode({ ...base, rotate: 90 });
    const x0 = evaluatePathDrivePortPreview(at0, 'x');
    const y0 = evaluatePathDrivePortPreview(at0, 'y');
    const x90 = evaluatePathDrivePortPreview(at90, 'x');
    const y90 = evaluatePathDrivePortPreview(at90, 'y');
    const cx = 0.3;
    const cy = -0.1;
    expect(Math.hypot(x0 - cx, y0 - cy)).toBeCloseTo(0.5, 3);
    expect(Math.hypot(x90 - cx, y90 - cy)).toBeCloseTo(0.5, 3);
    expect(x0).toBeCloseTo(cx + 0.5, 3);
    expect(y0).toBeCloseTo(cy, 3);
    expect(x90).toBeCloseTo(cx, 2);
    expect(y90).toBeCloseTo(cy + 0.5, 2);
  });
});
