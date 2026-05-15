import { describe, it, expect } from 'vitest';
import { Code, ConnectError } from '@connectrpc/connect';
import {
  celListTracksFilterContributorInList,
  escapeAudiotoolCelDoubleQuotedSegment,
  extractPlaybackAudioUrlFromTrackJson,
  isAudiotoolSessionAuthFailure,
  isCelListTracksFilterRejected,
  parseAudiotoolTrackJsonPayload,
  withAudiotoolUserSession,
} from './audiotoolSessionRpc';

describe('extractPlaybackAudioUrlFromTrackJson', () => {
  it('prefers mp3 over wav/ogg', () => {
    expect(
      extractPlaybackAudioUrlFromTrackJson({
        mp3_url: 'https://cdn.example/a.mp3',
        wav_url: 'https://cdn.example/a.wav',
      })
    ).toBe('https://cdn.example/a.mp3');
  });

  it('accepts camelCase Connect JSON keys', () => {
    expect(extractPlaybackAudioUrlFromTrackJson({ mp3Url: 'https://x/y.mp3' })).toBe('https://x/y.mp3');
  });

  it('returns undefined when only hls is set', () => {
    expect(extractPlaybackAudioUrlFromTrackJson({ hlsUrl: 'https://x/hls/' })).toBeUndefined();
  });
});

describe('parseAudiotoolTrackJsonPayload', () => {
  it('sets displayName from API fields without falling back to resource name', () => {
    expect(
      parseAudiotoolTrackJsonPayload({
        name: 'tracks/abc',
        displayName: 'My Song',
      })
    ).toEqual({ displayName: 'My Song' });
  });

  it('supports snake_case display_name', () => {
    expect(
      parseAudiotoolTrackJsonPayload({
        name: 'tracks/x',
        display_name: 'From snake',
      })
    ).toEqual({ displayName: 'From snake' });
  });

  it('omits displayName when proto only has resource name — avoids UX treating tracks/… as title', () => {
    expect(parseAudiotoolTrackJsonPayload({ name: 'tracks/zzz' })).toEqual({});
  });

  it('parses project_name and project_commit_index', () => {
    expect(
      parseAudiotoolTrackJsonPayload({
        name: 'tracks/abc',
        project_name: 'projects/uuid-here',
        project_commit_index: 12,
      })
    ).toEqual({
      projectName: 'projects/uuid-here',
      projectCommitIndex: 12,
    });
  });

  it('accepts camelCase project fields from Connect JSON', () => {
    expect(
      parseAudiotoolTrackJsonPayload({
        projectName: 'projects/other',
        projectCommitIndex: 3,
      })
    ).toEqual({
      projectName: 'projects/other',
      projectCommitIndex: 3,
    });
  });
});

describe('CEL ListTracks filters', () => {
  it('escapes quotes and backslashes for embedded string literals', () => {
    expect(escapeAudiotoolCelDoubleQuotedSegment('a\\b"c')).toBe('a\\\\b\\"c');
  });

  it('uses `in` — contributor_names is list(dyn), not comparable with string via `==`', () => {
    expect(celListTracksFilterContributorInList('users/dquerg')).toBe(
      '"users/dquerg" in track.contributor_names'
    );
  });
});

describe('isCelListTracksFilterRejected', () => {
  it('detects cel UNIMPLEMENTED patterns', () => {
    expect(
      isCelListTracksFilterRejected(new ConnectError('cel query error: foo', Code.Unimplemented))
    ).toBe(true);
    expect(
      isCelListTracksFilterRejected(
        new ConnectError('[unimplemented] expression type: 2', Code.Unimplemented)
      )
    ).toBe(true);
  });

  it('detects cel INVALID_ARGUMENT patterns', () => {
    expect(
      isCelListTracksFilterRejected(new ConnectError('could not check CEL: ...', Code.InvalidArgument))
    ).toBe(true);
    expect(
      isCelListTracksFilterRejected(new ConnectError('overload for @in applied', Code.InvalidArgument))
    ).toBe(true);
    expect(
      isCelListTracksFilterRejected(
        new ConnectError(
          "found no matching overload for '_==_' applied to '(list(dyn), string)'",
          Code.InvalidArgument
        )
      )
    ).toBe(true);
  });

  it('returns false for unrelated errors', () => {
    expect(isCelListTracksFilterRejected(new ConnectError('oops', Code.NotFound))).toBe(false);
    expect(isCelListTracksFilterRejected(new ConnectError('', Code.PermissionDenied))).toBe(false);
  });
});

describe('isAudiotoolSessionAuthFailure', () => {
  it('detects Connect Unauthenticated', () => {
    expect(isAudiotoolSessionAuthFailure(new ConnectError('', Code.Unauthenticated))).toBe(true);
  });

  it('does not treat PermissionDenied as session expiry (missing scope vs expired token)', () => {
    expect(isAudiotoolSessionAuthFailure(new ConnectError('', Code.PermissionDenied))).toBe(false);
  });

  it('detects loose 401 message', () => {
    expect(isAudiotoolSessionAuthFailure(new Error('Request failed with 401 Unauthorized'))).toBe(true);
  });

  it('returns false for unrelated errors', () => {
    expect(isAudiotoolSessionAuthFailure(new Error('ECONNRESET'))).toBe(false);
    expect(isAudiotoolSessionAuthFailure(new ConnectError('', Code.Unavailable))).toBe(false);
  });
});

describe('withAudiotoolUserSession', () => {
  it('returns disconnected when session is null', async () => {
    const result = await withAudiotoolUserSession(null, async () => 1);
    expect(result).toEqual({ ok: false, reason: 'disconnected' });
  });

  it('maps auth failures to session_auth_failed', async () => {
    const session = {} as Parameters<typeof withAudiotoolUserSession>[0];
    const err = new ConnectError('nope', Code.Unauthenticated);
    const result = await withAudiotoolUserSession(session, async () => {
      throw err;
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('session_auth_failed');
      expect(result.error).toBe(err);
    }
  });

  it('maps PermissionDenied to rpc_forbidden (not session_auth_failed)', async () => {
    const session = {} as Parameters<typeof withAudiotoolUserSession>[0];
    const cause = new ConnectError('insufficient rights', Code.PermissionDenied);
    const wrapped = new Error('listTracks threw');
    wrapped.cause = cause;
    const result = await withAudiotoolUserSession(session, async () => {
      throw wrapped;
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('rpc_forbidden');
  });

  it('throws on unrelated failures', async () => {
    const session = {} as Parameters<typeof withAudiotoolUserSession>[0];
    const boom = new Error('boom');
    await expect(
      withAudiotoolUserSession(session, async () => {
        throw boom;
      })
    ).rejects.toBe(boom);
  });
});
