import type { NodeGraph } from '../../data-model/types';
import type { NodeSpec } from '../../types/nodeSpec';
import { inferBlendPortType, type BlendSourceTypeLookup } from './blendPortTypeInference';

type WgslType = 'f32' | 'vec2<f32>' | 'vec3<f32>' | 'vec4<f32>';
export type WgslExpr = { type: WgslType; code: string };

export const WGSL_BLEND_MODE_HELPERS = `
fn blendMultiply(base: f32, blend: f32) -> f32 { return base * blend; }
fn blendScreen(base: f32, blend: f32) -> f32 { return 1.0 - (1.0 - base) * (1.0 - blend); }
fn blendOverlay(base: f32, blend: f32) -> f32 {
  return select(2.0 * base * blend, 1.0 - 2.0 * (1.0 - base) * (1.0 - blend), base >= 0.5);
}
fn blendSoftLight(base: f32, blend: f32) -> f32 {
  return select(
    base - (1.0 - 2.0 * blend) * base * (1.0 - base),
    base + (2.0 * blend - 1.0) * (sqrt(base) - base),
    blend >= 0.5
  );
}
fn blendHardLight(base: f32, blend: f32) -> f32 {
  return select(2.0 * base * blend, 1.0 - 2.0 * (1.0 - base) * (1.0 - blend), blend >= 0.5);
}
fn blendColorDodge(base: f32, blend: f32) -> f32 { return base / (1.0 - blend + 0.001); }
fn blendColorBurn(base: f32, blend: f32) -> f32 { return 1.0 - (1.0 - base) / (blend + 0.001); }
fn blendLinearDodge(base: f32, blend: f32) -> f32 { return min(base + blend, 1.0); }
fn blendLinearBurn(base: f32, blend: f32) -> f32 { return max(base + blend - 1.0, 0.0); }
fn blendDifference(base: f32, blend: f32) -> f32 { return abs(base - blend); }
fn blendExclusion(base: f32, blend: f32) -> f32 { return base + blend - 2.0 * base * blend; }

fn applyBlendMode(base: f32, blend: f32, mode: f32) -> f32 {
  let m0 = mode < 0.5;
  let m1 = mode >= 0.5 && mode < 1.5;
  let m2 = mode >= 1.5 && mode < 2.5;
  let m3 = mode >= 2.5 && mode < 3.5;
  let m4 = mode >= 3.5 && mode < 4.5;
  let m5 = mode >= 4.5 && mode < 5.5;
  let m6 = mode >= 5.5 && mode < 6.5;
  let m7 = mode >= 6.5 && mode < 7.5;
  let m8 = mode >= 7.5 && mode < 8.5;
  let m9 = mode >= 8.5 && mode < 9.5;
  let m10 = mode >= 9.5 && mode < 10.5;
  let m11 = mode >= 10.5;

  let r1 = blendMultiply(base, blend);
  let r2 = blendScreen(base, blend);
  let r3 = blendOverlay(base, blend);
  let r4 = blendSoftLight(base, blend);
  let r5 = blendHardLight(base, blend);
  let r6 = blendColorDodge(base, blend);
  let r7 = blendColorBurn(base, blend);
  let r8 = blendLinearDodge(base, blend);
  let r9 = blendLinearBurn(base, blend);
  let r10 = blendDifference(base, blend);
  let r11 = blendExclusion(base, blend);

  return
    blend * select(0.0, 1.0, m0) +
    r1 * select(0.0, 1.0, m1) +
    r2 * select(0.0, 1.0, m2) +
    r3 * select(0.0, 1.0, m3) +
    r4 * select(0.0, 1.0, m4) +
    r5 * select(0.0, 1.0, m5) +
    r6 * select(0.0, 1.0, m6) +
    r7 * select(0.0, 1.0, m7) +
    r8 * select(0.0, 1.0, m8) +
    r9 * select(0.0, 1.0, m9) +
    r10 * select(0.0, 1.0, m10) +
    r11 * select(0.0, 1.0, m11);
}
`;

export interface EmitWgslBlendNodeArgs {
  nodeId: string;
  graph: NodeGraph;
  nodeSpecs: Map<string, NodeSpec>;
  lookupSourceOutputType: BlendSourceTypeLookup;
  alphaMode: 0 | 1;
  requireHelper: (key: string, body: string) => void;
  setNodeOut: (nodeId: string, port: string, expr: WgslExpr) => void;
  paramMode: string;
  paramOpacity: string;
  resolveInputF32: (nodeId: string, port: string) => WgslExpr | null;
  resolveInputVec2: (nodeId: string, port: string) => WgslExpr | null;
  resolveInputVec3: (nodeId: string, port: string) => WgslExpr | null;
  resolveInputVec4: (nodeId: string, port: string) => WgslExpr | null;
  coerceToType: (expr: WgslExpr, target: WgslType) => WgslExpr | null;
  asF32: (expr: WgslExpr) => WgslExpr | null;
}

function blendPerComponent(
  base: WgslExpr,
  blend: WgslExpr,
  components: string[],
  mode: string
): string {
  const parts = components.map(
    (c) => `applyBlendMode((${base.code})${c}, (${blend.code})${c}, ${mode})`
  );
  return parts.join(', ');
}

export function emitWgslBlendNode(args: EmitWgslBlendNodeArgs): void {
  const node = args.graph.nodes.find((n) => n.id === args.nodeId);
  if (!node) return;

  const resolved = inferBlendPortType(node, args.graph, args.lookupSourceOutputType);
  args.requireHelper('blend', WGSL_BLEND_MODE_HELPERS);

  const { paramMode: mode, paramOpacity: opacity } = args;

  if (resolved === 'float') {
    const base = args.resolveInputF32(args.nodeId, 'base');
    const blend = args.resolveInputF32(args.nodeId, 'blend');
    if (!base || !blend) return;
    const b0 = args.asF32(base) ?? base;
    const b1 = args.asF32(blend) ?? blend;
    const blended = `applyBlendMode(${b0.code}, ${b1.code}, ${mode})`;
    args.setNodeOut(args.nodeId, 'out', {
      type: 'f32',
      code: `mix(${b0.code}, ${blended}, ${opacity})`
    });
    return;
  }

  if (resolved === 'vec2') {
    const base = args.resolveInputVec2(args.nodeId, 'base');
    const blend = args.resolveInputVec2(args.nodeId, 'blend');
    if (!base || !blend) return;
    const b0 = args.coerceToType(base, 'vec2<f32>') ?? base;
    const b1 = args.coerceToType(blend, 'vec2<f32>') ?? blend;
    const blended = `vec2<f32>(${blendPerComponent(b0, b1, ['.x', '.y'], mode)})`;
    args.setNodeOut(args.nodeId, 'out', {
      type: 'vec2<f32>',
      code: `mix(${b0.code}, ${blended}, ${opacity})`
    });
    return;
  }

  if (resolved === 'vec3') {
    const base = args.resolveInputVec3(args.nodeId, 'base');
    const blend = args.resolveInputVec3(args.nodeId, 'blend');
    if (!base || !blend) return;
    const b0 = args.coerceToType(base, 'vec3<f32>') ?? base;
    const b1 = args.coerceToType(blend, 'vec3<f32>') ?? blend;
    const blended = `vec3<f32>(${blendPerComponent(b0, b1, ['.x', '.y', '.z'], mode)})`;
    args.setNodeOut(args.nodeId, 'out', {
      type: 'vec3<f32>',
      code: `mix(${b0.code}, ${blended}, ${opacity})`
    });
    return;
  }

  const baseV = args.resolveInputVec4(args.nodeId, 'base');
  const blendV = args.resolveInputVec4(args.nodeId, 'blend');
  if (!baseV || !blendV) return;
  const b = args.coerceToType(baseV, 'vec4<f32>') ?? baseV;
  const s = args.coerceToType(blendV, 'vec4<f32>') ?? blendV;

  if (args.alphaMode === 1) {
    const blended = `vec4<f32>(${blendPerComponent(b, s, ['.x', '.y', '.z', '.w'], mode)})`;
    args.setNodeOut(args.nodeId, 'out', {
      type: 'vec4<f32>',
      code: `mix(${b.code}, ${blended}, ${opacity})`
    });
    return;
  }

  const blendedRgb = `vec3<f32>(applyBlendMode(${b.code}.x, ${s.code}.x, ${mode}), applyBlendMode(${b.code}.y, ${s.code}.y, ${mode}), applyBlendMode(${b.code}.z, ${s.code}.z, ${mode}))`;
  const rgb = `mix(${b.code}.xyz, ${blendedRgb}, ${opacity})`;
  const a = `mix(${b.code}.w, ${s.code}.w, ${opacity})`;
  args.setNodeOut(args.nodeId, 'out', { type: 'vec4<f32>', code: `vec4<f32>(${rgb}, ${a})` });
}
