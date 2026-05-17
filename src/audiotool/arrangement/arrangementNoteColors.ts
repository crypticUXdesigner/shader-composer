import type { OKLCH } from '../../utils/colorConversion';
import { linearRgbToOklch, oklchToLinearRgb } from '../../utils/colorConversion';
import type { ArrangementTrack } from './types';

/** `arrangement-notes` `noteColorMode` — must match NodeSpec / shader bake. */
export const NOTE_COLOR_MODE = {
  MONO_LIGHT: 0,
  MONO_DARK: 1,
  PROJECT: 2,
  CUSTOM: 3,
  PITCH: 4,
} as const;

export type NoteColorMode = (typeof NOTE_COLOR_MODE)[keyof typeof NOTE_COLOR_MODE];

const TAU = Math.PI * 2;

export const MONO_LIGHT_LINEAR_RGB = { r: 1, g: 1, b: 1 } as const;
/** Dark gray so velocity scaling remains visible on typical backgrounds. */
export const MONO_DARK_LINEAR_RGB = { r: 0.14, g: 0.14, b: 0.16 } as const;

export function clampNoteColorMode(raw: unknown): NoteColorMode {
  const n = Number(raw);
  if (n === NOTE_COLOR_MODE.MONO_LIGHT) return NOTE_COLOR_MODE.MONO_LIGHT;
  if (n === NOTE_COLOR_MODE.MONO_DARK) return NOTE_COLOR_MODE.MONO_DARK;
  if (n === NOTE_COLOR_MODE.CUSTOM) return NOTE_COLOR_MODE.CUSTOM;
  if (n === NOTE_COLOR_MODE.PITCH) return NOTE_COLOR_MODE.PITCH;
  return NOTE_COLOR_MODE.PROJECT;
}

/** Procedural palette keyed by Audiotool region `colorIndex` (matches Regions “Palette”). */
export function paletteLinearRgbFromColorIndex(colorIndex: number): {
  r: number;
  g: number;
  b: number;
} {
  const hue = ((colorIndex * 0.0625 + 0.02) % 1 + 1) % 1;
  return cosinePaletteRgb(hue);
}

/** Fallback when a track has no imported `colorIndex`. */
export function paletteLinearRgbFromTrackRow(trackRow: number): { r: number; g: number; b: number } {
  const hue = ((trackRow * 0.17 + 0.41) % 1 + 1) % 1;
  return cosinePaletteRgb(hue, 0.5, 0.5);
}

/** Legacy pitch rainbow (per MIDI note). */
export function paletteLinearRgbFromPitch(pitch: number): { r: number; g: number; b: number } {
  const hue = ((pitch * 0.024 + 0.12) % 1 + 1) % 1;
  return cosinePaletteRgb(hue);
}

function cosinePaletteRgb(
  hue: number,
  base = 0.55,
  amp = 0.45
): { r: number; g: number; b: number } {
  return {
    r: base + amp * Math.cos(TAU * (hue + 0)),
    g: base + amp * Math.cos(TAU * (hue + 0.33)),
    b: base + amp * Math.cos(TAU * (hue + 0.66)),
  };
}

export function trackRowNormalized(track: ArrangementTrack, visibleTracks: ArrangementTrack[]): number {
  if (visibleTracks.length <= 1) return 0;
  const index = visibleTracks.findIndex((t) => t.id === track.id);
  if (index < 0) return 0;
  return index / Math.max(1, visibleTracks.length - 1);
}

export type ParsedTrackNoteColors = Map<string, OKLCH>;

/** `trackId:L:C:H` entries separated by `;`. */
export function parseTrackNoteColors(raw: string): ParsedTrackNoteColors {
  const out: ParsedTrackNoteColors = new Map();
  if (!raw.trim()) return out;
  for (const part of raw.split(';')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const sep = trimmed.indexOf(':');
    if (sep <= 0) continue;
    const id = trimmed.slice(0, sep).trim();
    const rest = trimmed.slice(sep + 1);
    const nums = rest.split(':').map((s) => Number(s.trim()));
    if (nums.length < 3 || !nums.every((n) => Number.isFinite(n))) continue;
    out.set(id, { l: nums[0]!, c: nums[1]!, h: nums[2]! });
  }
  return out;
}

export function serializeTrackNoteColors(colors: ParsedTrackNoteColors): string {
  const parts: string[] = [];
  for (const [id, oklch] of colors) {
    if (!id.trim()) continue;
    parts.push(
      `${id}:${oklch.l.toFixed(6)}:${oklch.c.toFixed(6)}:${oklch.h.toFixed(3)}`
    );
  }
  return parts.join(';');
}

export function projectOklchForTrack(
  track: ArrangementTrack,
  visibleTracks: ArrangementTrack[]
): OKLCH {
  const row = trackRowNormalized(track, visibleTracks);
  const rgb =
    track.colorIndex !== undefined
      ? paletteLinearRgbFromColorIndex(track.colorIndex)
      : paletteLinearRgbFromTrackRow(row);
  return linearRgbToOklch(rgb.r, rgb.g, rgb.b);
}

export function serializeProjectTrackNoteColorsForTracks(
  visibleTracks: readonly ArrangementTrack[]
): string {
  const map: ParsedTrackNoteColors = new Map();
  for (const track of visibleTracks) {
    map.set(track.id, projectOklchForTrack(track, [...visibleTracks]));
  }
  return serializeTrackNoteColors(map);
}

/** PROJECT bake: `colorIndex` is -1 when the track has no imported index (shader uses `trackRow`). */
export function projectColorDataForNote(
  trackId: string,
  visibleTracks: readonly ArrangementTrack[]
): { colorIndex: number; trackRow: number } {
  const visible = [...visibleTracks];
  const track = visible.find((t) => t.id === trackId);
  const trackRow = track ? trackRowNormalized(track, visible) : 0;
  return {
    colorIndex: track?.colorIndex ?? -1,
    trackRow,
  };
}

export function resolveCustomTrackTableLinearRgb(
  visibleNoteTracks: readonly ArrangementTrack[],
  customColors: ParsedTrackNoteColors
): LinearRgb[] {
  return visibleNoteTracks.map((track) => {
    const custom = customColors.get(track.id);
    if (custom) return oklchToLinearRgb(custom.l, custom.c, custom.h);
    const row = trackRowNormalized(track, [...visibleNoteTracks]);
    const rgb =
      track.colorIndex !== undefined
        ? paletteLinearRgbFromColorIndex(track.colorIndex)
        : paletteLinearRgbFromTrackRow(row);
    return rgb;
  });
}

export type LinearRgb = { r: number; g: number; b: number };
