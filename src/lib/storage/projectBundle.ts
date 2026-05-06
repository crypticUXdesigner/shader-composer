import type { ProjectMeta } from './projectRepository';
import { getProjectPayload, listProjectMeta } from './projectRepository';

export const PROJECT_BUNDLE_FORMAT = 'shadernoice-project-bundle' as const;
export const PROJECT_BUNDLE_VERSION = 1 as const;

export interface ProjectBundleV1 {
  format: typeof PROJECT_BUNDLE_FORMAT;
  formatVersion: typeof PROJECT_BUNDLE_VERSION;
  /** ISO string */
  exportedAt: string;
  projects: Array<{
    meta: ProjectMeta;
    /** SerializedGraphFile JSON string (verbatim) */
    payloadJson: string;
  }>;
}

export interface BuildProjectsBundleResult {
  bundle: ProjectBundleV1;
  skippedCount: number;
  skippedProjectIds: string[];
}

export async function buildProjectsBundle(): Promise<BuildProjectsBundleResult> {
  const metaList = await listProjectMeta();

  const projects: ProjectBundleV1['projects'] = [];
  const skippedProjectIds: string[] = [];

  for (const meta of metaList) {
    try {
      const payload = await getProjectPayload(meta.projectId);
      if (!payload?.json || typeof payload.json !== 'string') {
        skippedProjectIds.push(meta.projectId);
        continue;
      }
      projects.push({
        meta,
        payloadJson: payload.json,
      });
    } catch {
      skippedProjectIds.push(meta.projectId);
    }
  }

  return {
    bundle: {
      format: PROJECT_BUNDLE_FORMAT,
      formatVersion: PROJECT_BUNDLE_VERSION,
      exportedAt: new Date().toISOString(),
      projects,
    },
    skippedCount: skippedProjectIds.length,
    skippedProjectIds,
  };
}

function isoDateStamp(iso: string): string {
  // ISO: 2026-05-05T21:09:00.000Z -> 2026-05-05
  return iso.slice(0, 10);
}

export function downloadProjectsBundleAsJsonFile(bundle: ProjectBundleV1): void {
  const json = JSON.stringify(bundle);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `shadernoice-projects-${isoDateStamp(bundle.exportedAt)}.json`;
  a.rel = 'noopener';
  a.click();

  URL.revokeObjectURL(url);
}

