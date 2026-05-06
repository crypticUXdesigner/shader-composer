import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetProjectDatabaseForTests } from './projectDb';
import {
  createProjectAtomic,
  deleteProjectAtomic,
  duplicateProjectAtomic,
  getProjectMeta,
  getProjectPayload,
  listProjectMeta,
  readAppMeta,
  saveProjectPayloadAtomic,
  updateProjectAppearanceAtomic,
  writeAppMeta,
} from './projectRepository';

const ISO = (): string => new Date().toISOString();

describe('projectRepository', () => {
  beforeEach(async () => {
    await resetProjectDatabaseForTests();
  });

  afterEach(async () => {
    await resetProjectDatabaseForTests();
  });

  it('createProjectAtomic writes meta + payload + lastOpened', async () => {
    const t = ISO();
    await createProjectAtomic({
      projectId: 'p1',
      json: '{"format":"serialized-graph-file","formatVersion":"2.0"}',
      displayName: 'One',
      createdAtISO: t,
      lastModifiedISO: t,
    });
    const list = await listProjectMeta();
    expect(list.map((x) => x.projectId)).toContain('p1');
    const payload = await getProjectPayload('p1');
    expect(payload?.json).toContain('formatVersion');
    const app = await readAppMeta();
    expect(app?.lastOpenedProjectId).toBe('p1');
  });

  it('deleteProjectAtomic removes rows and clears lastOpened when matched', async () => {
    const t = ISO();
    await createProjectAtomic({
      projectId: 'gone',
      json: '{"x":1}',
      displayName: 'Gone',
      createdAtISO: t,
      lastModifiedISO: t,
    });
    const beforeDelete = await readAppMeta();
    expect(beforeDelete?.lastOpenedProjectId).toBe('gone');
    await deleteProjectAtomic('gone');
    expect(await getProjectMeta('gone')).toBeUndefined();
    expect(await getProjectPayload('gone')).toBeUndefined();
    expect((await readAppMeta())?.lastOpenedProjectId).toBeUndefined();
  });

  it('duplicateProjectAtomic copies payload verbatim with new id', async () => {
    const json = '{"format":"serialized-graph-file","formatVersion":"2.0","graph":{"id":"g"}}';
    const t = ISO();
    await createProjectAtomic({
      projectId: 'src',
      json,
      displayName: 'Source',
      createdAtISO: t,
      lastModifiedISO: t,
      setLastOpened: false,
      avatarNodeIcon: 'sphere',
      avatarBgToken: 'teal-70',
      avatarIconColorToken: 'teal-110',
    });
    await duplicateProjectAtomic({
      sourceProjectId: 'src',
      newProjectId: 'dup',
      createdAtISO: t,
      lastModifiedISO: t,
    });
    const dupPayload = await getProjectPayload('dup');
    expect(dupPayload?.json).toBe(json);
    const meta = await getProjectMeta('dup');
    expect(meta?.displayName).toContain('Source');
    expect(meta?.avatarNodeIcon).toBe('sphere');
    expect(meta?.avatarBgToken).toBe('teal-70');
    expect(meta?.avatarIconColorToken).toBe('teal-110');
    expect((await readAppMeta())?.lastOpenedProjectId).toBe('dup');
  });

  it('saveProjectPayloadAtomic updates json and timestamps', async () => {
    const t0 = ISO();
    await createProjectAtomic({
      projectId: 'live',
      json: '{"v":1}',
      displayName: 'Live',
      createdAtISO: t0,
      lastModifiedISO: t0,
      setLastOpened: false,
    });
    await new Promise((r) => setTimeout(r, 5));
    const t1 = new Date().toISOString();
    await saveProjectPayloadAtomic({
      projectId: 'live',
      json: '{"v":2}',
      displayName: 'Renamed',
      lastModifiedISO: t1,
    });
    expect((await getProjectPayload('live'))?.json).toBe('{"v":2}');
    expect((await getProjectMeta('live'))?.displayName).toBe('Renamed');
  });

  it('updateProjectAppearanceAtomic updates meta and lastModified', async () => {
    const t0 = ISO();
    await createProjectAtomic({
      projectId: 'av',
      json: '{}',
      displayName: 'A',
      createdAtISO: t0,
      lastModifiedISO: t0,
      setLastOpened: false,
    });
    await new Promise((r) => setTimeout(r, 5));
    const t1 = new Date().toISOString();
    await updateProjectAppearanceAtomic({
      projectId: 'av',
      avatarNodeIcon: 'cube',
      avatarBgToken: 'blue-70',
      avatarIconColorToken: 'blue-110',
      lastModifiedISO: t1,
    });
    const m = await getProjectMeta('av');
    expect(m?.avatarNodeIcon).toBe('cube');
    expect(m?.avatarBgToken).toBe('blue-70');
    expect(m?.avatarIconColorToken).toBe('blue-110');
    expect(m?.lastModified).toBe(t1);
  });

  it('writeAppMeta merges keys', async () => {
    await writeAppMeta({ lastOpenedProjectId: 'x' });
    const app = await readAppMeta();
    expect(app?.lastOpenedProjectId).toBe('x');
    await writeAppMeta({ lastOpenedProjectId: 'y' });
    expect((await readAppMeta())?.lastOpenedProjectId).toBe('y');
  });
});
