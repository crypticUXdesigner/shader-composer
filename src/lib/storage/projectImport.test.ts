import 'fake-indexeddb/auto';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { resetProjectDatabaseForTests } from './projectDb';
import { listProjectMeta, readAppMeta } from './projectRepository';
import { PROJECT_BUNDLE_FORMAT, PROJECT_BUNDLE_VERSION, type ProjectBundleV1 } from './projectBundle';
import { importProjectTextAsNewLocalProjects } from './projectImport';
import { nodeSystemSpecs } from '../../shaders/nodes';
import { toValidationSpecs } from '../../utils/nodeSpecUtils';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('projectImport', () => {
  beforeEach(async () => {
    await resetProjectDatabaseForTests();
  });

  afterEach(async () => {
    await resetProjectDatabaseForTests();
  });

  it('imports single SerializedGraphFile JSON as a new local project', async () => {
    const validationSpecs = toValidationSpecs(nodeSystemSpecs);
    const presetPath = join(__dirname, '../../presets', 'testing.json');
    const json = readFileSync(presetPath, 'utf-8');

    const before = await listProjectMeta();
    expect(before.length).toBe(0);

    const result = await importProjectTextAsNewLocalProjects({
      text: json,
      nodeSpecs: validationSpecs,
      remapGraphIds: (g) => g,
      applyStartingTrack: async (s) => s,
    });

    expect(result.kind).toBe('single');
    const after = await listProjectMeta();
    expect(after.length).toBe(1);
    expect(after[0]?.projectId).toBeTruthy();
    expect(after[0]?.displayName?.trim()).toBeTruthy();

    const appMeta = await readAppMeta();
    expect(appMeta?.lastOpenedProjectId).toBe(after[0]!.projectId);
  });

  it('imports bundle JSON as multiple new projects and skips invalid entries without creating rows', async () => {
    const validationSpecs = toValidationSpecs(nodeSystemSpecs);
    const presetPath = join(__dirname, '../../presets', 'testing.json');
    const json = readFileSync(presetPath, 'utf-8');

    const bundle: ProjectBundleV1 = {
      format: PROJECT_BUNDLE_FORMAT,
      formatVersion: PROJECT_BUNDLE_VERSION,
      exportedAt: new Date().toISOString(),
      projects: [
        {
          meta: {
            projectId: 'old-1',
            displayName: 'Imported One',
            createdAt: new Date().toISOString(),
            lastModified: new Date().toISOString(),
            avatarNodeIcon: 'sphere',
            avatarBgToken: 'teal-70',
            avatarIconColorToken: 'teal-gray-130',
          },
          payloadJson: json,
        },
        {
          meta: {
            projectId: 'old-2',
            displayName: 'Broken',
            createdAt: new Date().toISOString(),
            lastModified: new Date().toISOString(),
          },
          payloadJson: '{not json',
        },
        {
          meta: {
            projectId: 'old-3',
            displayName: 'Imported Two',
            createdAt: new Date().toISOString(),
            lastModified: new Date().toISOString(),
          },
          payloadJson: json,
        },
      ],
    };

    const result = await importProjectTextAsNewLocalProjects({
      text: JSON.stringify(bundle),
      nodeSpecs: validationSpecs,
      remapGraphIds: (g) => g,
      applyStartingTrack: async (s) => s,
    });

    expect(result.kind).toBe('bundle');
    if (result.kind !== 'bundle') throw new Error('expected bundle');
    expect(result.totalCount).toBe(3);
    expect(result.failedCount).toBe(1);
    expect(result.importedProjectIds.length).toBe(2);

    const meta = await listProjectMeta();
    expect(meta.length).toBe(2);
    const ids = meta.map((m) => m.projectId);
    expect(ids).not.toContain('old-1');
    expect(ids).not.toContain('old-3');

    const names = meta.map((m) => m.displayName);
    expect(names).toContain('Imported One');
    expect(names).toContain('Imported Two');

    // bundle import should not bump lastOpened (caller controls "auto-open")
    const appMeta = await readAppMeta();
    expect(appMeta?.lastOpenedProjectId).toBeUndefined();
  });
});

