import type { ArrangementSnapshot, ArrangementTrackKind } from './types';
import { MAX_ARRANGEMENT_NOTES_PACKED } from './types';

/** Prefer a note track near this count when picking a default **Notes** node filter. */
const DEFAULT_ARRANGEMENT_NOTES_TRACK_TARGET = 400;

export type ArrangementTrackFilterRow = {
  id: string;
  label: string;
  kind: ArrangementTrackKind;
  enabled: boolean;
  noteCount: number;
  regionCount: number;
};

export type ArrangementTrackFilterEmptyMetric = 'notes' | 'regions' | 'both';

export type ArrangementTrackFilterListOptions = {
  /** Include only these track kinds (default: all kinds). */
  kinds?: ReadonlySet<ArrangementTrackKind>;
  /**
   * Omit tracks with nothing useful to select for this node.
   * Uses {@link hideEmptyMetric} when set; otherwise infers from `kinds` (note → notes, audio → regions, all → regions).
   */
  hideEmpty?: boolean;
  /** With `hideEmpty`, which count must be &gt; 0 (default inferred from `kinds`). */
  hideEmptyMetric?: ArrangementTrackFilterEmptyMetric;
};

function trackIsHiddenAsEmpty(
  noteCount: number,
  regionCount: number,
  options: ArrangementTrackFilterListOptions
): boolean {
  if (!options.hideEmpty) return false;

  const metric =
    options.hideEmptyMetric ??
    (() => {
      const kinds = options.kinds;
      if (kinds !== undefined && kinds.size === 1 && kinds.has('note')) return 'notes' as const;
      if (kinds !== undefined && kinds.size === 1 && kinds.has('audio')) return 'regions' as const;
      // Lanes (all kinds): region rectangles are what matter.
      if (kinds === undefined) return 'regions' as const;
      return 'both' as const;
    })();

  if (metric === 'notes') return noteCount === 0;
  if (metric === 'regions') return regionCount === 0;
  return noteCount === 0 && regionCount === 0;
}

/** Comma-separated ids in document order (first occurrence wins; duplicates trimmed). */
export function parseTrackFilterListOrdered(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of raw.split(',').map((s) => s.trim())) {
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function parseTrackFilterList(raw: string): Set<string> {
  return new Set(parseTrackFilterListOrdered(raw));
}

export function serializeTrackFilterList(ids: Iterable<string>): string {
  return [...ids].join(',');
}

/** Dedupe preserving first occurrence — used before persisting filters. */
export function normalizeOrderedTrackIds(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (!id.trim()) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function countNotesPerTrack(snapshot: ArrangementSnapshot): Map<string, number> {
  const counts = new Map<string, number>();
  for (const note of snapshot.notes ?? []) {
    counts.set(note.trackId, (counts.get(note.trackId) ?? 0) + 1);
  }
  return counts;
}

function countRegionsPerTrack(snapshot: ArrangementSnapshot): Map<string, number> {
  const counts = new Map<string, number>();
  for (const region of snapshot.regions) {
    if (!region.enabled) continue;
    counts.set(region.trackId, (counts.get(region.trackId) ?? 0) + 1);
  }
  return counts;
}

/**
 * Tracks shown in the arrangement filter UI, in DAW order.
 */
export function listArrangementTracksForFilter(
  snapshot: ArrangementSnapshot | undefined,
  options: ArrangementTrackFilterListOptions = {}
): ArrangementTrackFilterRow[] {
  if (!snapshot) return [];

  const noteCounts = countNotesPerTrack(snapshot);
  const regionCounts = countRegionsPerTrack(snapshot);
  const kinds = options.kinds;

  const rows: ArrangementTrackFilterRow[] = [];
  for (const track of snapshot.tracks) {
    if (!track.enabled) continue;
    if (kinds !== undefined && !kinds.has(track.kind)) continue;

    const noteCount = noteCounts.get(track.id) ?? 0;
    const regionCount = regionCounts.get(track.id) ?? 0;
    if (trackIsHiddenAsEmpty(noteCount, regionCount, options)) continue;

    rows.push({
      id: track.id,
      label: track.label?.trim() ? track.label.trim() : track.id,
      kind: track.kind,
      enabled: track.enabled,
      noteCount,
      regionCount,
    });
  }

  rows.sort((a, b) => {
    const trackA = snapshot.tracks.find((t) => t.id === a.id);
    const trackB = snapshot.tracks.find((t) => t.id === b.id);
    return (trackA?.orderAmongTracks ?? 0) - (trackB?.orderAmongTracks ?? 0);
  });

  return rows;
}

export function readSelectedTrackIds(
  trackFilterMode: number,
  trackFilterList: string,
  allTrackIds: readonly string[]
): Set<string> {
  if (trackFilterMode !== 1) {
    return new Set(allTrackIds);
  }
  return parseTrackFilterList(trackFilterList);
}

/**
 * @param orderedSelectedIds — selection order defines lane/stack order when `trackFilterMode === 1`.
 */
export function buildTrackFilterParams(
  orderedSelectedIds: readonly string[],
  allTrackIds: readonly string[]
): { trackFilterMode: number; trackFilterList: string } {
  if (allTrackIds.length === 0) {
    return { trackFilterMode: 0, trackFilterList: '' };
  }
  const allSet = new Set(allTrackIds);
  const normalized = normalizeOrderedTrackIds(orderedSelectedIds).filter((id) => allSet.has(id));
  if (normalized.length === 0) {
    return { trackFilterMode: 1, trackFilterList: '' };
  }
  const selectedSet = new Set(normalized);
  const allSelected =
    normalized.length === allTrackIds.length && allTrackIds.every((id) => selectedSet.has(id));
  if (allSelected) {
    return { trackFilterMode: 0, trackFilterList: '' };
  }
  return {
    trackFilterMode: 1,
    trackFilterList: serializeTrackFilterList(normalized),
  };
}

/** True when adding `trackItemCount` to the current baked total would exceed `cap`. */
export function wouldExceedArrangementBakeCap(
  selectedItemsTotal: number,
  trackItemCount: number,
  cap: number
): boolean {
  return selectedItemsTotal + trackItemCount > cap;
}

export function arrangementTrackFilterButtonLabel(
  rows: readonly ArrangementTrackFilterRow[],
  selectedIds: Set<string>
): string {
  if (rows.length === 0) return 'No tracks';
  const allIds = rows.map((r) => r.id);
  if (selectedIds.size === 0) return 'No tracks';
  if (selectedIds.size >= allIds.length && allIds.every((id) => selectedIds.has(id))) {
    return rows.length === 1 ? 'All tracks' : `All tracks (${rows.length})`;
  }
  return `${selectedIds.size} / ${rows.length} tracks`;
}

export function trackPassesArrangementFilter(
  trackId: string,
  snapshot: ArrangementSnapshot,
  trackFilterMode: number,
  trackFilterList: string
): boolean {
  if (trackFilterMode !== 1) return true;
  const allow = parseTrackFilterList(trackFilterList);
  if (allow.size === 0) return false;
  const track = snapshot.tracks.find((t) => t.id === trackId);
  return track !== undefined && track.enabled && allow.has(track.id);
}

/**
 * Pick one note track for a new **Notes** node: prefer a lane with a few hundred notes
 * that fits the GPU bake cap; fall back to the closest match or first non-empty lane.
 */
export function pickDefaultArrangementNotesTrackId(
  snapshot: ArrangementSnapshot | undefined
): string | undefined {
  const rows = listArrangementTracksForFilter(snapshot, {
    kinds: new Set<ArrangementTrackKind>(['note']),
    hideEmpty: true,
  });
  if (rows.length === 0) return undefined;

  const withNotes = rows.filter((r) => r.noteCount > 0);
  const pool = withNotes.length > 0 ? withNotes : rows;

  const underCap = pool.filter((r) => r.noteCount <= MAX_ARRANGEMENT_NOTES_PACKED);
  const candidates = underCap.length > 0 ? underCap : pool;

  let best = candidates[0]!;
  let bestDist = Math.abs(best.noteCount - DEFAULT_ARRANGEMENT_NOTES_TRACK_TARGET);
  for (const row of candidates.slice(1)) {
    const dist = Math.abs(row.noteCount - DEFAULT_ARRANGEMENT_NOTES_TRACK_TARGET);
    if (dist < bestDist) {
      best = row;
      bestDist = dist;
    }
  }
  return best.id;
}

/** Default **Notes** track filter: exactly one lane when a snapshot is available. */
export function defaultArrangementNotesTrackFilter(
  snapshot: ArrangementSnapshot | undefined
): { trackFilterMode: number; trackFilterList: string } {
  const id = pickDefaultArrangementNotesTrackId(snapshot);
  if (id === undefined) {
    return { trackFilterMode: 1, trackFilterList: '' };
  }
  return { trackFilterMode: 1, trackFilterList: id };
}
