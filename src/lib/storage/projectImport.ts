import type { NodeSpecification } from '../../data-model/validation';
import type { ApplyStartingTrackFn, RemapGraphIdsFn } from '../appHubResolve';
import { createUserProjectFromValidatedJson, createUserProjectFromValidatedJsonWithMeta } from '../appHubResolve';
import {
  PROJECT_BUNDLE_FORMAT,
  PROJECT_BUNDLE_VERSION,
  type ProjectBundleV1,
} from './projectBundle';
import type { ProjectMeta } from './projectRepository';
import { resolveProjectAvatar } from './projectAvatar';

export type ParseProjectImportTextResult =
  | { kind: 'single'; json: string }
  | { kind: 'bundle'; bundle: ProjectBundleV1 };

export function parseProjectImportText(text: string): ParseProjectImportTextResult {
  const raw = JSON.parse(text) as unknown;
  if (raw && typeof raw === 'object') {
    const format = (raw as { format?: unknown }).format;
    if (format === PROJECT_BUNDLE_FORMAT) {
      const bundle = raw as ProjectBundleV1;
      if (bundle.formatVersion !== PROJECT_BUNDLE_VERSION) {
        throw new Error(`Unsupported bundle version: ${String(bundle.formatVersion)}`);
      }
      if (!Array.isArray(bundle.projects)) {
        throw new Error('Invalid bundle: expected projects[]');
      }
      return { kind: 'bundle', bundle };
    }
  }
  return { kind: 'single', json: text };
}

export type ImportProjectTextResult =
  | { kind: 'single'; projectId: string }
  | {
      kind: 'bundle';
      importedProjectIds: string[];
      failedCount: number;
      totalCount: number;
    };

export async function importProjectTextAsNewLocalProjects(opts: {
  text: string;
  nodeSpecs: NodeSpecification[];
  remapGraphIds: RemapGraphIdsFn;
  applyStartingTrack: ApplyStartingTrackFn;
}): Promise<ImportProjectTextResult> {
  const parsed = parseProjectImportText(opts.text);

  if (parsed.kind === 'single') {
    const { projectId } = await createUserProjectFromValidatedJson(
      opts.nodeSpecs,
      opts.remapGraphIds,
      opts.applyStartingTrack,
      parsed.json
    );
    return { kind: 'single', projectId };
  }

  const importedProjectIds: string[] = [];
  let failedCount = 0;
  const entries = parsed.bundle.projects;

  for (const entry of entries) {
    try {
      const meta = entry.meta as ProjectMeta;
      const avatar = resolveProjectAvatar(meta);
      const { projectId } = await createUserProjectFromValidatedJsonWithMeta(
        opts.nodeSpecs,
        opts.remapGraphIds,
        opts.applyStartingTrack,
        entry.payloadJson,
        {
          displayName: meta.displayName,
          createdAtISO: meta.createdAt,
          lastModifiedISO: meta.lastModified,
          presetForkedFrom: meta.presetForkedFrom ?? null,
          avatarNodeIcon: avatar.avatarNodeIcon,
          avatarBgToken: avatar.avatarBgToken,
          avatarIconColorToken: avatar.avatarIconColorToken,
          setLastOpened: false,
        }
      );
      importedProjectIds.push(projectId);
    } catch {
      failedCount++;
    }
  }

  return {
    kind: 'bundle',
    importedProjectIds,
    failedCount,
    totalCount: entries.length,
  };
}

