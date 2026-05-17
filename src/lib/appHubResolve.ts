/**
 * Turns a hub pick into graph + audio + session state (IndexedDB writes for new user rows).
 */

import { createScratchGraph, generateUUID } from '../data-model/utils';
import type { AudioSetup } from '../data-model/audioSetupTypes';
import type { NodeGraph } from '../data-model/types';
import type { NodeSpecification } from '../data-model/validation';
import { serializeGraph } from '../data-model/serialization';
import { loadPreset, loadPresetFromJson, type LoadPresetResult } from '../utils/presetManager';
import { pickRandomProjectAvatarPreset } from './storage/projectAvatar';
import { createProjectAtomic, getProjectPayload, writeAppMeta } from './storage/projectRepository';
import type { ActiveSession, HubSelection } from './storage/projectSessionTypes';

export interface HubResolveResult {
  graph: NodeGraph;
  audioSetup: AudioSetup;
  activeSession: ActiveSession;
  selectedPreset: string | null;
}

export type ApplyStartingTrackFn = (audioSetup: AudioSetup, startingTrackId: string) => Promise<AudioSetup>;

export type RemapGraphIdsFn = (g: NodeGraph) => NodeGraph;

async function applyLoadResult(
  result: LoadPresetResult,
  remap: RemapGraphIdsFn,
  applyStartingTrack: ApplyStartingTrackFn
): Promise<{ graph: NodeGraph; audioSetup: AudioSetup }> {
  if (!result.graph) {
    throw new Error(result.errors[0] ?? 'Failed to load graph');
  }
  const remapped = remap(result.graph);
  let audioSetup = result.audioSetup ?? { files: [], bands: [], remappers: [] };
  if (result.startingTrackId) {
    audioSetup = await applyStartingTrack(audioSetup, result.startingTrackId);
  }
  return { graph: remapped, audioSetup };
}

/** Build startingTrackId for SerializedGraphFile when primary is playlist track */
function startingTrackOption(setup: AudioSetup): string | undefined {
  return setup.primarySource?.type === 'playlist' ? setup.primarySource.trackId : undefined;
}

export async function resolveHubSelectionToGraph(
  selection: HubSelection,
  nodeSpecs: NodeSpecification[],
  remapGraphIds: RemapGraphIdsFn,
  applyStartingTrack: ApplyStartingTrackFn
): Promise<HubResolveResult> {
  switch (selection.kind) {
    case 'userProject': {
      const row = await getProjectPayload(selection.projectId);
      if (!row) throw new Error('Project not found locally');
      const parsed = await loadPresetFromJson(row.json, nodeSpecs);
      if (!parsed.graph) {
        throw new Error(parsed.errors[0] ?? 'Invalid saved project payload');
      }
      let audioSetup = parsed.audioSetup ?? { files: [], bands: [], remappers: [] };
      if (parsed.startingTrackId) {
        audioSetup = await applyStartingTrack(audioSetup, parsed.startingTrackId);
      }
      await writeAppMeta({ lastOpenedProjectId: selection.projectId });
      return {
        graph: parsed.graph,
        audioSetup,
        activeSession: { kind: 'userProject', projectId: selection.projectId },
        selectedPreset: null,
      };
    }

    case 'newScratch': {
      const graph = remapGraphIds(createScratchGraph('Untitled'));
      const audioSetup: AudioSetup = { files: [], bands: [], remappers: [] };
      const id = generateUUID();
      const iso = new Date().toISOString();
      const json = serializeGraph(graph, true, audioSetup, { startingTrackId: startingTrackOption(audioSetup) });
      const ap = pickRandomProjectAvatarPreset();
      await createProjectAtomic({
        projectId: id,
        json,
        displayName: graph.name.trim() || 'Untitled',
        createdAtISO: iso,
        lastModifiedISO: iso,
        avatarNodeIcon: ap.avatarNodeIcon,
        avatarBgToken: ap.avatarBgToken,
        avatarIconColorToken: ap.avatarIconColorToken,
        setLastOpened: true,
      });
      return {
        graph,
        audioSetup,
        activeSession: { kind: 'userProject', projectId: id },
        selectedPreset: null,
      };
    }

    case 'forkBundledPreset': {
      const result = await loadPreset(selection.presetName, nodeSpecs);
      const { graph, audioSetup } = await applyLoadResult(result, remapGraphIds, applyStartingTrack);
      const id = generateUUID();
      const iso = new Date().toISOString();
      const json = serializeGraph(graph, true, audioSetup, { startingTrackId: startingTrackOption(audioSetup) });
      const ap = pickRandomProjectAvatarPreset();
      await createProjectAtomic({
        projectId: id,
        json,
        displayName: graph.name.trim() || selection.presetName,
        createdAtISO: iso,
        lastModifiedISO: iso,
        presetForkedFrom: selection.presetName,
        avatarNodeIcon: ap.avatarNodeIcon,
        avatarBgToken: ap.avatarBgToken,
        avatarIconColorToken: ap.avatarIconColorToken,
        setLastOpened: true,
      });
      return {
        graph,
        audioSetup,
        activeSession: { kind: 'userProject', projectId: id },
        selectedPreset: selection.presetName,
      };
    }

    default: {
      const _never: never = selection;
      return _never;
    }
  }
}

/**
 * Import JSON as a new local row, then caller opens it as userProject by id.
 */
export async function createUserProjectFromValidatedJson(
  nodeSpecs: NodeSpecification[],
  remapGraphIds: RemapGraphIdsFn,
  applyStartingTrack: ApplyStartingTrackFn,
  json: string
): Promise<{ projectId: string; graph: NodeGraph; audioSetup: AudioSetup }> {
  return await createUserProjectFromValidatedJsonWithMeta(nodeSpecs, remapGraphIds, applyStartingTrack, json, {});
}

export async function createUserProjectFromValidatedJsonWithMeta(
  nodeSpecs: NodeSpecification[],
  remapGraphIds: RemapGraphIdsFn,
  applyStartingTrack: ApplyStartingTrackFn,
  json: string,
  meta: Partial<{
    displayName: string;
    createdAtISO: string;
    lastModifiedISO: string;
    presetForkedFrom: string | null;
    avatarNodeIcon: string;
    avatarBgToken: string;
    avatarIconColorToken: string;
    setLastOpened: boolean;
  }>
): Promise<{ projectId: string; graph: NodeGraph; audioSetup: AudioSetup }> {
  const parsed = await loadPresetFromJson(json, nodeSpecs);
  const { graph, audioSetup } = await applyLoadResult(parsed, remapGraphIds, applyStartingTrack);

  const id = generateUUID();
  const iso = new Date().toISOString();
  const createdAtISO = meta.createdAtISO ?? iso;
  const lastModifiedISO = meta.lastModifiedISO ?? iso;

  const serialized = serializeGraph(graph, true, audioSetup, { startingTrackId: startingTrackOption(audioSetup) });
  const ap = pickRandomProjectAvatarPreset();

  await createProjectAtomic({
    projectId: id,
    json: serialized,
    displayName: (meta.displayName ?? graph.name).trim() || 'Imported',
    createdAtISO,
    lastModifiedISO,
    ...(meta.presetForkedFrom !== undefined ? { presetForkedFrom: meta.presetForkedFrom } : {}),
    avatarNodeIcon: meta.avatarNodeIcon ?? ap.avatarNodeIcon,
    avatarBgToken: meta.avatarBgToken ?? ap.avatarBgToken,
    avatarIconColorToken: meta.avatarIconColorToken ?? ap.avatarIconColorToken,
    setLastOpened: meta.setLastOpened ?? true,
  });

  return { projectId: id, graph, audioSetup };
}
