/**
 * Guards for Nexus / Connect RPCs that require an Audiotool OAuth session.
 * Use before user-scoped calls (profile, track listing, future library APIs).
 */

import type { AuthenticatedClient, AudiotoolClient } from '@audiotool/nexus';
import { registerAudiotoolPlaylistTrackPlaybackUrl } from './audiotoolPlaylistPlaybackUrls';
import { MethodKind, type JsonObject, type JsonValue } from '@bufbuild/protobuf';
import { setAudiotoolTrackDisplayNameCache } from './audiotoolTrackTitleCache';
import { appendHeaders, Code, ConnectError } from '@connectrpc/connect';
import {
  errorFromJson,
  protocolVersion,
  trailerDemux,
  validateResponse,
} from '@connectrpc/connect/protocol-connect';

export type AudiotoolUserRpcResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: 'disconnected' }
  /** Bearer rejected or missing (refresh/sign-in needed). */
  | { ok: false; reason: 'session_auth_failed'; error: unknown }
  /** Valid session but OAuth token / app lacks permission for this RPC. Not a logout case. */
  | { ok: false; reason: 'rpc_forbidden'; error: unknown };

export interface AudiotoolPublishedTrackItem {
  /** Audiotool track resource name (e.g. `tracks/xyz`). */
  trackId: string;
  /** Human label from the linked project. */
  displayName: string;
  /**
   * Playback URL from API output-only fields (`mp3_url` / `wav_url` / …) when the list response includes them.
   * Real URLs differ from the legacy `cdn.audiotool.com/tracks/{id}/track.mp3` guess.
   */
  playbackUrl?: string;
}

/**
 * Unwrap `@audiotool/nexus` unary errors — `RetryingClient` surfaces failures as Error, often with
 * `cause: ConnectError` rather than rejecting with ConnectError directly.
 */
export function unwrapConnectError(error: unknown): ConnectError | null {
  let cur: unknown = error;
  for (let i = 0; i < 8 && cur !== null && cur !== undefined; i++) {
    if (cur instanceof ConnectError) return cur;
    if (cur instanceof Error && cur.cause !== undefined) {
      cur = cur.cause;
      continue;
    }
    break;
  }
  return null;
}

/**
 * True when the server rejected the **filter** / CEL for ListTracks (try another filter shape).
 * Audiotool has returned `UNIMPLEMENTED` for macro-style CEL (e.g. `.exists`) and `INVALID_ARGUMENT`
 * for unsupported `in` overloads on some fields.
 */
export function isCelListTracksFilterRejected(error: unknown): boolean {
  const ce = unwrapConnectError(error);
  if (!ce) return false;
  const m = `${ce.rawMessage} ${ce.message}`;
  if (ce.code === Code.Unimplemented && /cel|expression type|query error/i.test(m)) return true;
  if (ce.code === Code.InvalidArgument && /cel|query error|overload|could not check CEL/i.test(m)) {
    return true;
  }
  return false;
}

/**
 * Returns true when a Connect/server error strongly suggests the bearer session is no longer valid.
 * Intended for prompting re-sign-in, not missing OAuth scopes (**PermissionDenied** is handled separately).
 */
export function isAudiotoolSessionAuthFailure(error: unknown): boolean {
  const ce = unwrapConnectError(error);
  if (ce) return ce.code === Code.Unauthenticated;
  if (error instanceof Error) {
    const m = error.message;
    return /UNAUTHENTICATED|Unauthorized|invalid.*token|401\b/i.test(m);
  }
  return false;
}

/**
 * Runs `fn(session)` only when `session` is non-null.
 * Maps auth-type failures to `session_auth_failed` for UI to invalidate the Nexus client.
 *
 * Throws on non-auth errors so callers preserve existing “surfaces anyway” behaviors where needed.
 */
export async function withAudiotoolUserSession<T>(
  session: AuthenticatedClient | null,
  fn: (client: AudiotoolClient) => Promise<T>
): Promise<AudiotoolUserRpcResult<T>> {
  if (session == null) {
    return { ok: false, reason: 'disconnected' };
  }
  try {
    const value = await fn(session);
    return { ok: true, value };
  } catch (e) {
    const ce = unwrapConnectError(e);
    if (ce?.code === Code.PermissionDenied) {
      return { ok: false, reason: 'rpc_forbidden', error: e };
    }
    if (isAudiotoolSessionAuthFailure(e)) {
      return { ok: false, reason: 'session_auth_failed', error: e };
    }
    throw e;
  }
}

function userResourceName(userNameFromAuth: string): string {
  const t = userNameFromAuth.trim();
  if (!t.length) return '';
  if (t.startsWith('users/')) return t;
  return `users/${t}`;
}

/** Embed `value` inside a double-quoted CEL string literal (RPC list filters). */
export function escapeAudiotoolCelDoubleQuotedSegment(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * **`contributor_names` is a repeated field** — rpc.audiotool.com types it as **`list(dyn)`**, so
 * **`track.contributor_names == "users/..."` is rejected** (`_==_(list(string), string)` / no overload).
 * Use **membership**: `"users/..." in track.contributor_names`.
 *
 * Macros like `.exists` still return UNIMPLEMENTED on this host.
 */
export function celListTracksFilterContributorInList(userResourcePath: string): string {
  const u = escapeAudiotoolCelDoubleQuotedSegment(userResourcePath.trim());
  return `"${u}" in track.contributor_names`;
}

const TRACK_SERVICE_LIST_TRACKS_PATH = '/audiotool.track.v1.TrackService/ListTracks';
const TRACK_SERVICE_GET_TRACK_PATH = '/audiotool.track.v1.TrackService/GetTrack';

function getAudiotoolRpcConnectBaseUrl(): string {
  try {
    const raw = import.meta.env.VITE_AUDIOTOOL_RPC_URL?.trim?.();
    if (typeof raw === 'string' && raw.length > 0) return raw.replace(/\/$/, '');
  } catch {
    /* import.meta unavailable */
  }
  if (import.meta.env.DEV) return '/__audiotool_rpc__';
  return 'https://rpc.audiotool.com';
}

/**
 * CONNECT unary JSON (same framing as Nexus / `@connectrpc/connect-web`).
 * Nexus does not expose `TrackService`; we POST directly with `authorizedFetch`.
 */
async function postAudiotoolConnectUnaryJson(
  client: AudiotoolClient,
  absoluteUrl: string,
  jsonBody: JsonObject
): Promise<JsonObject> {
  const res = await client.authorizedFetch(absoluteUrl, {
    method: 'POST',
    credentials: 'same-origin',
    mode: 'cors',
    redirect: 'error',
    headers: new Headers({
      'Content-Type': 'application/json',
      'Connect-Protocol-Version': protocolVersion,
      'Connect-Timeout-Ms': '60000',
    }),
    body: JSON.stringify(jsonBody),
  });

  if (res instanceof Error) throw res;

  const validation = validateResponse(MethodKind.Unary, false, res.status, res.headers);
  const trailerMerged = appendHeaders(...trailerDemux(res.headers));
  const text = await res.text();

  if (validation.isUnaryError) {
    let parsed: JsonValue;
    try {
      parsed = text.length ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }
    throw errorFromJson(parsed, trailerMerged, validation.unaryError);
  }

  if (!text.length) throw new ConnectError('empty unary JSON response', Code.Unknown);

  try {
    return JSON.parse(text) as JsonObject;
  } catch {
    throw new ConnectError('invalid unary JSON response', Code.Unknown);
  }
}

function contributorNamesFromTrackJson(track: Record<string, unknown>): string[] {
  const raw = track['contributorNames'] ?? track['contributor_names'];
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is string => typeof x === 'string')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function trackJsonMatchesContributor(trackJson: Record<string, unknown>, userResource: string): boolean {
  return contributorNamesFromTrackJson(trackJson).includes(userResource);
}

/**
 * Best HTTP(S) URL to load full audio for decoding (Web Audio). Prefer mp3; omit HLS (not decodable as one file).
 * Matches Connect JSON for `audiotool.track.v1.Track` (camelCase or snake_case keys).
 */
export function extractPlaybackAudioUrlFromTrackJson(trackJson: Record<string, unknown>): string | undefined {
  const tryOrder = [
    ['mp3Url', 'mp3_url'],
    ['wavUrl', 'wav_url'],
    ['oggUrl', 'ogg_url'],
  ] as const;
  for (const keys of tryOrder) {
    for (const k of keys) {
      const v = trackJson[k];
      if (typeof v === 'string' && /^https?:\/\//i.test(v.trim())) return v.trim();
    }
  }
  return undefined;
}

/** Prefer API display fields; omit when absent so callers do not treat `tracks/…` resource names as UX titles. */
function humanDisplayNameFromTrackJson(trackJson: Record<string, unknown>): string | undefined {
  const snake =
    typeof trackJson.display_name === 'string' && trackJson.display_name.trim() !== ''
      ? trackJson.display_name.trim()
      : '';
  const camel =
    typeof trackJson.displayName === 'string' && trackJson.displayName.trim() !== ''
      ? trackJson.displayName.trim()
      : '';
  const fromFields = snake || camel;
  return fromFields.length > 0 ? fromFields : undefined;
}

/** Parsed subset of TrackService.GetTrack (HTTP media URLs + labels + publish project). */
export interface AudiotoolGetTrackParsed {
  playbackUrl?: string;
  displayName?: string;
  /** Nexus project resource name, e.g. `projects/{uuid}`. */
  projectName?: string;
  /** Publish commit index from the track's linked project. */
  projectCommitIndex?: number;
}

function parseProjectFieldsFromTrackJson(
  trackJson: Record<string, unknown>
): Pick<AudiotoolGetTrackParsed, 'projectName' | 'projectCommitIndex'> {
  const projectRaw =
    typeof trackJson.project_name === 'string'
      ? trackJson.project_name
      : typeof trackJson.projectName === 'string'
        ? trackJson.projectName
        : '';
  const projectName = projectRaw.trim().length > 0 ? projectRaw.trim() : undefined;

  const commitRaw = trackJson.project_commit_index ?? trackJson.projectCommitIndex;
  let projectCommitIndex: number | undefined;
  if (typeof commitRaw === 'number' && Number.isFinite(commitRaw) && commitRaw >= 0) {
    projectCommitIndex = Math.floor(commitRaw);
  }

  const out: Pick<AudiotoolGetTrackParsed, 'projectName' | 'projectCommitIndex'> = {};
  if (projectName !== undefined) out.projectName = projectName;
  if (projectCommitIndex !== undefined) out.projectCommitIndex = projectCommitIndex;
  return out;
}

export function parseAudiotoolTrackJsonPayload(trackJson: Record<string, unknown>): AudiotoolGetTrackParsed {
  const dn = humanDisplayNameFromTrackJson(trackJson);
  const playbackUrl = extractPlaybackAudioUrlFromTrackJson(trackJson);
  const projectFields = parseProjectFieldsFromTrackJson(trackJson);
  const out: AudiotoolGetTrackParsed = { ...projectFields };
  if (dn !== undefined) out.displayName = dn;
  if (playbackUrl !== undefined) out.playbackUrl = playbackUrl;
  return out;
}

function trackRowToItem(trackJson: Record<string, unknown>): AudiotoolPublishedTrackItem | null {
  const name = typeof trackJson.name === 'string' ? trackJson.name.trim() : '';
  if (!name.startsWith('tracks/')) return null;
  const human = humanDisplayNameFromTrackJson(trackJson);
  const displayName = human ?? name;
  if (human) setAudiotoolTrackDisplayNameCache(name, human);
  const playbackUrl = extractPlaybackAudioUrlFromTrackJson(trackJson);
  return playbackUrl !== undefined ? { trackId: name, displayName, playbackUrl } : { trackId: name, displayName };
}

/** Coalesce concurrent GetTrack calls per resource (e.g. picker + background hydration). */
const inflightAudiotoolGetTrack = new Map<string, Promise<AudiotoolGetTrackParsed | undefined>>();

/**
 * `TrackService.GetTrack` — playable URL plus display label when the JSON carries them.
 */
export async function fetchAudiotoolTrackViaGetTrack(
  client: AudiotoolClient,
  trackResourceName: string
): Promise<AudiotoolGetTrackParsed | undefined> {
  const name = trackResourceName.trim();
  if (!name.startsWith('tracks/')) return undefined;

  const existing = inflightAudiotoolGetTrack.get(name);
  if (existing) return existing;

  const promise = (async (): Promise<AudiotoolGetTrackParsed | undefined> => {
    const base = getAudiotoolRpcConnectBaseUrl();
    const url = `${base}${TRACK_SERVICE_GET_TRACK_PATH}`;
    const body = await postAudiotoolConnectUnaryJson(client, url, { name });
    const trackRaw = body['track'];
    if (typeof trackRaw !== 'object' || trackRaw === null || Array.isArray(trackRaw)) return undefined;
    const parsed = parseAudiotoolTrackJsonPayload(trackRaw as Record<string, unknown>);
    if (parsed.displayName) setAudiotoolTrackDisplayNameCache(name, parsed.displayName);
    return parsed;
  })().finally(() => {
    inflightAudiotoolGetTrack.delete(name);
  });

  inflightAudiotoolGetTrack.set(name, promise);
  return promise;
}

/** Returns only playback URL — GetTrack parsing lives in {@link fetchAudiotoolTrackViaGetTrack}. */
export async function fetchAudiotoolTrackPlaybackUrlViaGetTrack(
  client: AudiotoolClient,
  trackResourceName: string
): Promise<string | undefined> {
  const parsed = await fetchAudiotoolTrackViaGetTrack(client, trackResourceName);
  return parsed?.playbackUrl;
}

/**
 * Paginate `TrackService.ListTracks` with `filter`; only keep tracks that list `userResource` among contributors.
 */
async function listTracksPagedForContributor(
  client: AudiotoolClient,
  userResource: string,
  filter: string,
  pageSize: number,
  maxPages: number
): Promise<AudiotoolPublishedTrackItem[]> {
  const base = getAudiotoolRpcConnectBaseUrl();
  const url = `${base}${TRACK_SERVICE_LIST_TRACKS_PATH}`;
  /** Proto lists `track.create_time` for order_by — not `update_time`. */
  const orderBy = 'track.create_time desc';

  const seen = new Set<string>();
  const out: AudiotoolPublishedTrackItem[] = [];
  let pageToken = '';

  for (let i = 0; i < maxPages; i++) {
    const body = await postAudiotoolConnectUnaryJson(client, url, {
      filter,
      pageSize,
      pageToken,
      orderBy,
    });

    const tracksRaw = body['tracks'];
    const rows = Array.isArray(tracksRaw) ? tracksRaw : [];

    for (const row of rows) {
      if (typeof row !== 'object' || row === null || Array.isArray(row)) continue;
      const o = row as Record<string, unknown>;
      if (!trackJsonMatchesContributor(o, userResource)) continue;
      const item = trackRowToItem(o);
      if (!item || seen.has(item.trackId)) continue;
      seen.add(item.trackId);
      out.push(item);
    }

    const nextTok =
      typeof body['nextPageToken'] === 'string' ? (body['nextPageToken'] as string).trim() : '';
    if (!nextTok) break;
    pageToken = nextTok;
  }

  return out;
}

/**
 * Tracks the signed-in user **contributed to**, via **`audiotool.track.v1.TrackService.ListTracks`**
 * (`contributor_names` on `audiotool.track.v1.Track`). No **`Project`** listing.
 *
 * `@audiotool/nexus` has no `client.tracks`; this uses CONNECT+JSON (`authorizedFetch`) like audiograph helpers.
 *
 * CEL filter: **`"users/..." in track.contributor_names`** (see {@link celListTracksFilterContributorInList}).
 * Rows are **always** re-checked against JSON `contributorNames` / `contributor_names` arrays.
 *
 * **`options.pageToken`** is not used across strategy retries — start listing from empty token (dialog loads once).
 *
 * Typical OAuth scopes: include whatever Audiotool requires for authenticated Track RPCs (often with `project:read`; adjust at developer.audiotool.com).
 */
export async function listAudiotoolMyPublishedTracks(
  client: AudiotoolClient,
  userNameFromAuth: string,
  options?: { pageSize?: number; pageToken?: string }
): Promise<{ items: AudiotoolPublishedTrackItem[]; nextPageToken: string }> {
  const userResource = userResourceName(userNameFromAuth);
  if (!userResource) return { items: [], nextPageToken: '' };

  const pageSize = Math.max(1, Math.min(200, options?.pageSize ?? 50));
  const maxPages = 48;
  const filter = celListTracksFilterContributorInList(userResource);

  const items = await listTracksPagedForContributor(
    client,
    userResource,
    filter,
    pageSize,
    maxPages
  );
  for (const item of items) {
    if (item.playbackUrl) registerAudiotoolPlaylistTrackPlaybackUrl(item.trackId, item.playbackUrl);
  }
  return { items, nextPageToken: '' };
}
