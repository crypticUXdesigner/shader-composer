/**
 * CPU-side preview of path-drive X/Y outputs for parameter UI live values.
 * Must stay in sync with `functions` + `mainCode` in `shaders/nodes/path-drive.ts`.
 */

import type { NodeInstance } from '../data-model/types';
import { pathDriveNodeSpec } from '../shaders/nodes/path-drive';
import { getShaderTimeSeconds } from './mixedWaveSignalPreview';

function paramNum(node: NodeInstance, key: string, fallback: number): number {
  const spec = pathDriveNodeSpec.parameters[key];
  const def = typeof spec?.default === 'number' ? spec.default : fallback;
  const v = node.parameters[key];
  return typeof v === 'number' && !isNaN(v) ? v : def;
}

function paramInt(node: NodeInstance, key: string, fallback: number): number {
  const spec = pathDriveNodeSpec.parameters[key];
  const def = typeof spec?.default === 'number' ? Math.round(spec.default) : fallback;
  const v = node.parameters[key];
  const r = typeof v === 'number' && !isNaN(v) ? Math.round(v) : def;
  if (spec?.type === 'int' && typeof spec.min === 'number' && typeof spec.max === 'number') {
    return Math.max(spec.min, Math.min(spec.max, r));
  }
  return r;
}

/** Mirrors GLSL `pd_pathCore` */
function pathCore(
  preset: number,
  t: number,
  size: number,
  aspect: number,
  pulseDepth: number,
): { px: number; py: number } {
  let px = 0;
  let py = 0;
  if (preset === 0) {
    px = size * Math.cos(t);
    py = size * aspect * Math.sin(t);
  } else if (preset === 1) {
    px = size * Math.cos(t);
    py = size * aspect * Math.sin(2 * t) * 0.5;
  } else if (preset === 2) {
    px =
      size *
      (0.62 * Math.sin(t * 0.71) +
        0.34 * Math.sin(t * 1.11 + 1.17) +
        0.19 * Math.sin(t * 1.89 + 2.61));
    py =
      size *
      (0.58 * Math.sin(t * 0.79 + 0.83) +
        0.36 * Math.sin(t * 1.03 + 2.07) +
        0.21 * Math.sin(t * 1.67 + 0.49));
  } else if (preset === 3) {
    const breathe = 1 - pulseDepth + pulseDepth * (0.5 + 0.5 * Math.sin(t));
    const r = size * breathe;
    px = r * Math.cos(t);
    py = r * Math.sin(t);
  } else {
    const along = Math.cos(t);
    px = size * along;
    py = 0;
  }
  return { px, py };
}

/** Mirrors GLSL `pd_wanderJitter` */
function wanderJitter(
  t: number,
  size: number,
  wanderAmt: number,
  jitterAmt: number,
): { wx: number; wy: number; jx: number; jy: number } {
  const wx =
    wanderAmt * size * 0.36 * (Math.sin(t * 0.31 + 1.07) + 0.48 * Math.sin(t * 0.17 + 2.31));
  const wy =
    wanderAmt * size * 0.36 * (Math.sin(t * 0.27 + 0.71) + 0.48 * Math.sin(t * 0.19 + 3.12));
  const jf = t * 47.3 + Math.sin(t * 13.7) * Math.PI * 2;
  const jg = t * 53.1 + Math.sin(t * 11.2) * Math.PI * 2 + 1.47;
  const jx = jitterAmt * size * 0.14 * Math.sin(jf);
  const jy = jitterAmt * size * 0.14 * Math.sin(jg);
  return { wx, wy, jx, jy };
}

export function evaluatePathDrivePortPreview(node: NodeInstance, port: 'x' | 'y'): number {
  const tau = 6.283185307179586;
  const tSec = getShaderTimeSeconds();
  const preset = Math.max(0, Math.min(4, paramInt(node, 'pathPreset', 0)));
  const pdT = tSec * paramNum(node, 'speed', 0.5) * tau + (paramNum(node, 'phase', 0) * Math.PI) / 180;
  const size = paramNum(node, 'size', 0.25);
  const { px, py } = pathCore(
    preset,
    pdT,
    size,
    paramNum(node, 'aspect', 1),
    paramNum(node, 'pulseDepth', 0.55),
  );
  const { wx, wy, jx, jy } = wanderJitter(
    pdT,
    size,
    paramNum(node, 'wander', 0.12),
    paramNum(node, 'jitter', 0),
  );
  const ox = px + wx + jx;
  const oy = py + wy + jy;
  const lineRot =
    preset === 4 ? (paramNum(node, 'lineAngle', 0) * Math.PI) / 180 : 0;
  const theta =
    (paramNum(node, 'rotate', 0) * Math.PI) / 180 +
    tSec * paramNum(node, 'rotationSpeed', 0) * tau +
    (paramNum(node, 'rotationPhase', 0) * Math.PI) / 180 +
    lineRot;
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  const rx = cosT * ox - sinT * oy;
  const ry = sinT * ox + cosT * oy;
  const cx = paramNum(node, 'centerX', 0);
  const cy = paramNum(node, 'centerY', 0);
  if (port === 'x') {
    return cx + rx;
  }
  return cy + ry;
}
