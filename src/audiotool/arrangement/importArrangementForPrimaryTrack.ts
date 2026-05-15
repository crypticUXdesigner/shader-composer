import type { AuthenticatedClient } from '@audiotool/nexus';
import type { AudioSetup } from '../../data-model/audioSetupTypes';
import { setArrangementSnapshot } from '../../data-model/audioSetupUpdates';
import {
  fetchAudiotoolTrackViaGetTrack,
  withAudiotoolUserSession,
} from '../../utils/audiotoolSessionRpc';
import { importArrangementSnapshotFromProject } from './importArrangementSnapshotFromProject';
import type { ArrangementSnapshot } from './types';

export type ImportArrangementForPrimaryTrackResult =
  | { ok: true; snapshot: ArrangementSnapshot; audioSetup: AudioSetup }
  | { ok: false; reason: 'disconnected' }
  | { ok: false; reason: 'not_playlist_primary' }
  | { ok: false; reason: 'no_project_name' }
  | { ok: false; reason: 'rpc_forbidden'; error: unknown }
  | { ok: false; reason: 'session_auth_failed'; error: unknown }
  | { ok: false; reason: 'import_failed'; error: unknown };

type SessionInnerResult =
  | { kind: 'no_project' }
  | { kind: 'ok'; snapshot: ArrangementSnapshot };

/**
 * Import arrangement snapshot for the current playlist primary track.
 * Resolves `project_name` + `project_commit_index` from GetTrack, with optional bundled-catalog fallback.
 */
export async function importArrangementForPrimaryTrack(
  session: AuthenticatedClient | null,
  audioSetup: AudioSetup,
  resolveBundledProjectName?: (trackId: string) => string | undefined
): Promise<ImportArrangementForPrimaryTrackResult> {
  const primary = audioSetup.primarySource;
  if (primary?.type !== 'playlist') {
    return { ok: false, reason: 'not_playlist_primary' };
  }
  const trackId = primary.trackId;

  let sessionResult: Awaited<ReturnType<typeof withAudiotoolUserSession<SessionInnerResult>>>;
  try {
    sessionResult = await withAudiotoolUserSession(session, async (client) => {
    const parsed = await fetchAudiotoolTrackViaGetTrack(client, trackId);
    let projectName = parsed?.projectName;
    const commitIndex = parsed?.projectCommitIndex;
    if (projectName === undefined && resolveBundledProjectName !== undefined) {
      projectName = resolveBundledProjectName(trackId);
    }
    if (projectName === undefined || projectName.trim() === '') {
      return { kind: 'no_project' } satisfies SessionInnerResult;
    }
    const snapshot = await importArrangementSnapshotFromProject(
      client,
      projectName,
      commitIndex,
      trackId
    );
    return { kind: 'ok', snapshot } satisfies SessionInnerResult;
    });
  } catch (e) {
    return { ok: false, reason: 'import_failed', error: e };
  }

  if (!sessionResult.ok) {
    if (sessionResult.reason === 'disconnected') {
      return { ok: false, reason: 'disconnected' };
    }
    if (sessionResult.reason === 'rpc_forbidden') {
      return { ok: false, reason: 'rpc_forbidden', error: sessionResult.error };
    }
    if (sessionResult.reason === 'session_auth_failed') {
      return { ok: false, reason: 'session_auth_failed', error: sessionResult.error };
    }
    return { ok: false, reason: 'import_failed', error: sessionResult };
  }

  const inner = sessionResult.value;
  if (inner.kind === 'no_project') {
    return { ok: false, reason: 'no_project_name' };
  }

  const nextSetup = setArrangementSnapshot(audioSetup, inner.snapshot);
  return { ok: true, snapshot: inner.snapshot, audioSetup: nextSetup };
}
