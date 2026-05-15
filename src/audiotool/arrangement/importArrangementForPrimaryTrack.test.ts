import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AudioSetup } from '../../data-model/audioSetupTypes';
import { buildArrangementSnapshot } from './buildArrangementSnapshot';
import type { RawArrangementEntities } from './rawEntities';
import spikeFixture from './__fixtures__/spike-arrangement-raw.json';
import { importArrangementForPrimaryTrack } from './importArrangementForPrimaryTrack';

const snapshot = buildArrangementSnapshot(spikeFixture as RawArrangementEntities);

vi.mock('../../utils/audiotoolSessionRpc', () => ({
  withAudiotoolUserSession: vi.fn(),
  fetchAudiotoolTrackViaGetTrack: vi.fn(),
}));

vi.mock('./importArrangementSnapshotFromProject', () => ({
  importArrangementSnapshotFromProject: vi.fn(),
}));

import {
  fetchAudiotoolTrackViaGetTrack,
  withAudiotoolUserSession,
} from '../../utils/audiotoolSessionRpc';
import { importArrangementSnapshotFromProject } from './importArrangementSnapshotFromProject';

const mockWithSession = vi.mocked(withAudiotoolUserSession);
const mockGetTrack = vi.mocked(fetchAudiotoolTrackViaGetTrack);
const mockImportProject = vi.mocked(importArrangementSnapshotFromProject);

function playlistSetup(trackId: string): AudioSetup {
  return {
    files: [],
    bands: [],
    remappers: [],
    primarySource: { type: 'playlist', trackId },
  };
}

describe('importArrangementForPrimaryTrack', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns not_playlist_primary for upload primary', async () => {
    const setup: AudioSetup = {
      files: [],
      bands: [],
      remappers: [],
      primarySource: { type: 'upload', file: { id: 'f1', name: 'x', autoPlay: false } },
    };
    const result = await importArrangementForPrimaryTrack({} as never, setup);
    expect(result).toEqual({ ok: false, reason: 'not_playlist_primary' });
    expect(mockWithSession).not.toHaveBeenCalled();
  });

  it('returns disconnected when session is null', async () => {
    mockWithSession.mockResolvedValueOnce({ ok: false, reason: 'disconnected' });
    const result = await importArrangementForPrimaryTrack(null, playlistSetup('tracks/a'));
    expect(result).toEqual({ ok: false, reason: 'disconnected' });
  });

  it('returns no_project_name when GetTrack and bundled fallback lack project', async () => {
    mockWithSession.mockImplementationOnce(async (_session, fn) => {
      mockGetTrack.mockResolvedValueOnce({});
      const value = await fn({} as never);
      return { ok: true, value };
    });
    const result = await importArrangementForPrimaryTrack({} as never, playlistSetup('tracks/a'), () => undefined);
    expect(result).toEqual({ ok: false, reason: 'no_project_name' });
  });

  it('imports and stores snapshot on success', async () => {
    mockWithSession.mockImplementationOnce(async (_session, fn) => {
      mockGetTrack.mockResolvedValueOnce({
        projectName: 'projects/test',
        projectCommitIndex: 7,
      });
      mockImportProject.mockResolvedValueOnce(snapshot);
      const value = await fn({} as never);
      return { ok: true, value };
    });
    const setup = playlistSetup(snapshot.source.trackName);
    const result = await importArrangementForPrimaryTrack({} as never, setup);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot).toEqual(snapshot);
    expect(result.audioSetup.arrangementSnapshot).toEqual(snapshot);
    expect(result.audioSetup.arrangementImportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(mockImportProject).toHaveBeenCalledWith(
      {},
      'projects/test',
      7,
      snapshot.source.trackName
    );
  });

  it('uses bundled project name when GetTrack omits project fields', async () => {
    mockWithSession.mockImplementationOnce(async (_session, fn) => {
      mockGetTrack.mockResolvedValueOnce({});
      mockImportProject.mockResolvedValueOnce(snapshot);
      const value = await fn({} as never);
      return { ok: true, value };
    });
    const setup = playlistSetup(snapshot.source.trackName);
    const result = await importArrangementForPrimaryTrack(
      {} as never,
      setup,
      () => 'projects/from-catalog'
    );
    expect(result.ok).toBe(true);
    expect(mockImportProject).toHaveBeenCalledWith(
      {},
      'projects/from-catalog',
      undefined,
      snapshot.source.trackName
    );
  });
});
