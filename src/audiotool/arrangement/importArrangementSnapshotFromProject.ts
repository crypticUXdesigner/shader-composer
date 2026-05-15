import type { AudiotoolClient } from '@audiotool/nexus';
import { logArrangementImportDiagnostics } from './arrangementDiagnostics';
import { buildArrangementSnapshot } from './buildArrangementSnapshot';
import { extractRawArrangementEntities } from './extractRawArrangementEntities';
import type { ArrangementSnapshot } from './types';

const PROJECT_UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** Same resource shape Nexus `open` expects (`projects/{uuid}`). */
function normalizeProjectName(project: string): string {
  const trimmed = project.trim();
  if (trimmed.startsWith('projects/')) return trimmed;
  const match = trimmed.match(PROJECT_UUID_RE);
  if (match === null) {
    throw new Error(
      `Could not extract project id from "${project}" (expected URL, UUID, or projects/{id})`
    );
  }
  return `projects/${match[0]}`;
}

/**
 * One-shot import: `open` → `start` → `queryEntities` → `stop`.
 *
 * @param client Authenticated Nexus client (`project:read` / `project:write` for session).
 * @param projectName Project URL, UUID, or `projects/{id}` resource name.
 * @param commitIndex Publish commit from `GetTrack` (stored on snapshot; Nexus `open` attaches at latest — pin at commit in task 02 via `GetEntities` when needed).
 * @param sourceTrackName Playlist track resource name for `snapshot.source.trackName`.
 */
export async function importArrangementSnapshotFromProject(
  client: AudiotoolClient,
  projectName: string,
  commitIndex?: number,
  sourceTrackName = ''
): Promise<ArrangementSnapshot> {
  const projectsResource = normalizeProjectName(projectName);
  const doc = await client.open(projectsResource);
  try {
    await doc.start();
    const raw = extractRawArrangementEntities(doc.queryEntities, {
      trackName: sourceTrackName,
      projectName: projectsResource,
      commitIndex: commitIndex ?? 0,
    });
    const snapshot = buildArrangementSnapshot(raw);
    logArrangementImportDiagnostics(raw, snapshot);
    return snapshot;
  } finally {
    await doc.stop();
  }
}
