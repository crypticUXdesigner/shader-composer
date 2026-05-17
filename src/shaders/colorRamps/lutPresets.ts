import type { NodeSpec } from '../../types/nodeSpec';
import {
  LUT_PRESET_META,
  LUT_PRESET_SIZE,
  LUT_RGB_FLOATS_PER_PRESET,
  LUT_PRESET_TABLES_FLAT,
  type LutPresetMeta,
} from './lutPresetData.generated';

export { LUT_PRESET_SIZE, LUT_RGB_FLOATS_PER_PRESET, LUT_PRESET_META, type LutPresetMeta };

export function getLutPresetCount(): number {
  return LUT_PRESET_META.length;
}

export function getLutPresetMeta(index: number): LutPresetMeta | undefined {
  return LUT_PRESET_META[index];
}

/** Display label for preset index or id string. */
export function getLutPresetLabel(preset: number | string): string {
  if (typeof preset === 'string') {
    const found = LUT_PRESET_META.find((p) => p.id === preset);
    return found?.label ?? preset;
  }
  return LUT_PRESET_META[preset]?.label ?? `Preset ${preset}`;
}

export function getLutPresetId(index: number): string {
  return LUT_PRESET_META[index]?.id ?? `preset-${index}`;
}

/** RGB triplet table for one preset (length 256 × 3). */
export function getLutPresetRgbFlat(presetIndex: number): readonly number[] {
  const base = presetIndex * LUT_RGB_FLOATS_PER_PRESET;
  return LUT_PRESET_TABLES_FLAT.slice(base, base + LUT_RGB_FLOATS_PER_PRESET);
}

export function getAllLutPresetTablesFlat(): readonly number[] {
  return LUT_PRESET_TABLES_FLAT;
}

/** Preset index baked into generated LUT helpers (compile-time; changing preset recompiles). */
export function getBakedLutPresetIndex(
  node: { parameters: Record<string, unknown> },
  nodeSpec: Pick<NodeSpec, 'parameters'>
): number {
  const raw = node.parameters.preset;
  const def = nodeSpec.parameters.preset?.default ?? 0;
  const fallback = typeof def === 'number' ? def : 0;
  const index = Math.round(typeof raw === 'number' ? raw : fallback);
  return Math.max(0, Math.min(getLutPresetCount() - 1, index));
}
