/**
 * Tracks data from public/tracks-data.json.
 * Provides playlist order (alphabetical by displayName) and track URL by id.
 */

export interface TrackEntry {
  name: string;
  displayName: string;
  mp3Url: string;
  playDuration?: string;
  [key: string]: unknown;
}

export type TracksDataMap = Record<string, TrackEntry>;

let cached: TracksDataMap | null = null;

/**
 * Base URL for static assets (matches Vite base, e.g. /shader-composer/).
 * Relative fetch would use document URL; we use BASE_URL so it works with any base path.
 */
function getTracksDataUrl(): string {
  try {
    const base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '';
    return `${base.replace(/\/$/, '')}/tracks-data.json`;
  } catch {
    return '/tracks-data.json';
  }
}

/**
 * Fetch and cache tracks-data.json. Returns cached map after first load.
 */
export async function getTracksData(): Promise<TracksDataMap> {
  if (cached) return cached;
  const url = getTracksDataUrl();
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load tracks-data: ${res.status}`);
  const data = (await res.json()) as TracksDataMap;
  cached = data;
  return data;
}

/**
 * Get track entry by id (e.g. "tracks/xyz").
 */
export function getTrackById(data: TracksDataMap, trackId: string): TrackEntry | undefined {
  return data[trackId];
}

/**
 * Get mp3 URL for a track id. Returns undefined if track not found.
 */
export function getTrackMp3Url(data: TracksDataMap, trackId: string): string | undefined {
  return getTrackById(data, trackId)?.mp3Url;
}

/**
 * Parse playDuration string (e.g. "123.45s" or "0.010s") to seconds. Returns undefined if missing or invalid.
 */
export function parsePlayDurationSeconds(playDuration: string | undefined): number | undefined {
  if (playDuration == null || playDuration === '') return undefined;
  const s = playDuration.trim().replace(/s$/i, '');
  const n = parseFloat(s);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/**
 * Get track duration in seconds from tracks-data (from playDuration). Returns undefined if not found or invalid.
 */
export async function getTrackDurationSeconds(trackId: string): Promise<number | undefined> {
  const data = await getTracksData();
  const entry = getTrackById(data, trackId);
  return parsePlayDurationSeconds(entry?.playDuration);
}

/**
 * Build playlist order: all track ids from tracks-data, sorted alphabetically by displayName.
 */
export function getPlaylistOrder(data: TracksDataMap): string[] {
  const ids = Object.keys(data);
  return ids.slice().sort((a, b) => {
    const nameA = (data[a]?.displayName ?? data[a]?.name ?? a).toLowerCase();
    const nameB = (data[b]?.displayName ?? data[b]?.name ?? b).toLowerCase();
    return nameA.localeCompare(nameB);
  });
}
