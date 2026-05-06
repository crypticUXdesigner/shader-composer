import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetProjectDatabaseForTests } from './projectDb';
import { createProjectAtomic } from './projectRepository';
import { PROJECT_BUNDLE_FORMAT, PROJECT_BUNDLE_VERSION, buildProjectsBundle } from './projectBundle';

const ISO = (): string => new Date().toISOString();

describe('projectBundle', () => {
  beforeEach(async () => {
    await resetProjectDatabaseForTests();
  });

  afterEach(async () => {
    await resetProjectDatabaseForTests();
  });

  it('buildProjectsBundle includes meta + payloadJson for each project', async () => {
    const t = ISO();
    await createProjectAtomic({
      projectId: 'p1',
      json: '{"format":"serialized-graph-file","formatVersion":"2.0","graph":{"id":"g1"}}',
      displayName: 'One',
      createdAtISO: t,
      lastModifiedISO: t,
      setLastOpened: false,
      avatarNodeIcon: 'sphere',
      avatarBgToken: 'teal-70',
      avatarIconColorToken: 'teal-110',
    });
    await createProjectAtomic({
      projectId: 'p2',
      json: '{"format":"serialized-graph-file","formatVersion":"2.0","graph":{"id":"g2"}}',
      displayName: 'Two',
      createdAtISO: t,
      lastModifiedISO: t,
      setLastOpened: false,
    });

    const { bundle, skippedCount } = await buildProjectsBundle();

    expect(skippedCount).toBe(0);
    expect(bundle.format).toBe(PROJECT_BUNDLE_FORMAT);
    expect(bundle.formatVersion).toBe(PROJECT_BUNDLE_VERSION);
    expect(bundle.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const ids = bundle.projects.map((p) => p.meta.projectId).sort();
    expect(ids).toEqual(['p1', 'p2']);

    const p1 = bundle.projects.find((p) => p.meta.projectId === 'p1');
    expect(p1?.meta.displayName).toBe('One');
    expect(p1?.meta.avatarNodeIcon).toBe('sphere');
    expect(p1?.payloadJson).toContain('"graph":{"id":"g1"}');
  });
});

