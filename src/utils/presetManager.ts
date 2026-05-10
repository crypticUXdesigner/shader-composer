/**
 * Preset Manager for Node-Based Shader System
 *
 * Handles listing, loading, and managing preset files for the node-based system.
 * Presets are stored as JSON files in the src/presets/ directory.
 * Uses audioSetup from file when valid; audio is configured outside the visual node graph.
 */

import {
  type NodeGraph,
  GRAPH_FILE_FORMAT,
  LEGACY_GRAPH_FILE_FORMAT,
} from '../data-model/types';
import type { AudioSetup } from '../data-model/audioSetupTypes';
import {
  serializeGraph,
  deserializeGraph,
  deserializeGraphUnvalidated,
} from '../data-model/serialization';
import type { NodeSpecification } from '../data-model/validation';
import { migrateLegacyNodeGraph } from '../data-model/graphLegacyMigrations';

/**
 * Preset metadata (filename without extension)
 */
export interface PresetInfo {
  name: string;  // Filename without .json extension
  displayName: string;  // Human-readable name (derived from filename)
}

/**
 * List all available presets
 * Uses Vite's import.meta.glob to discover preset files at build time
 */
export async function listPresets(): Promise<PresetInfo[]> {
  // Use import.meta.glob to get all preset files
  // This works because Vite bundles JSON files from src/ as modules
  // Use a relative glob so Rollup/Vite resolve consistently across platforms (Windows paths included).
  const presetModules = import.meta.glob('../presets/*.json', { eager: false });
  
  const presets: PresetInfo[] = [];
  
  for (const modulePath of Object.keys(presetModules)) {
    // Extract filename from path (e.g. "/src/presets/sphere.json" or "src/presets/sphere.json" -> "sphere")
    const match = modulePath.match(/([^/]+)\.json$/);
    if (match) {
      const name = match[1];
      presets.push({
        name,
        displayName: formatPresetName(name)
      });
    }
  }
  
  // Sort alphabetically by display name
  presets.sort((a, b) => a.displayName.localeCompare(b.displayName));
  
  return presets;
}

export interface LoadPresetResult {
  graph: NodeGraph | null;
  audioSetup?: AudioSetup;
  /** Starting track id for playlist (preset/copy); app applies so load restores current track. */
  startingTrackId?: string;
  errors: string[];
  warnings: string[];
}

/**
 * Load a preset by name. Uses data-model serialization and validateGraph so every graph
 * reaching the app has passed validation (aligned with default-state load path).
 * Uses audioSetup from file when valid; legacy audio nodes are no longer supported.
 *
 * @param presetName - Name of the preset (filename without .json extension)
 * @param nodeSpecs - Node specifications for validation (e.g. from toValidationSpecs(nodeSystemSpecs))
 * @returns Result with graph, audioSetup, errors, and warnings; graph is null when load or validation fails
 */
export async function loadPreset(
  presetName: string,
  nodeSpecs: NodeSpecification[] = []
): Promise<LoadPresetResult> {
  const emptyResult = (
    errors: string[],
    warnings: string[] = []
  ): LoadPresetResult => ({
    graph: null,
    audioSetup: undefined,
    errors,
    warnings,
  });

  try {
    const presetModules = import.meta.glob('../presets/*.json', { eager: false });
    // Vite glob keys may be with or without leading slash depending on env; match by suffix
    const presetPath = Object.keys(presetModules).find((k) => k.endsWith(`/${presetName}.json`));

    if (!presetPath) {
      return emptyResult([`Preset not found: ${presetName}`]);
    }

    const loader = presetModules[presetPath];
    const module = typeof loader === 'function' ? await loader() : (loader as { default: unknown });
    const data = (module as { default: unknown }).default as Record<string, unknown>;

    let graph: NodeGraph;
    if ((data.format === GRAPH_FILE_FORMAT || data.format === LEGACY_GRAPH_FILE_FORMAT) && data.graph) {
      graph = data.graph as NodeGraph;
    } else if (
      typeof data.id === 'string' &&
      Array.isArray(data.nodes) &&
      Array.isArray(data.connections)
    ) {
      graph = data as unknown as NodeGraph;
    } else {
      return emptyResult([`Invalid preset format: ${presetName}`]);
    }

    const migratedGraph = migrateLegacyNodeGraph(graph);
    const audioSetup = isValidAudioSetup(data.audioSetup)
      ? (data.audioSetup as AudioSetup)
      : { files: [], bands: [], remappers: [] };

    const json = serializeGraph(migratedGraph, false, audioSetup);
    const result = deserializeGraph(json, nodeSpecs);
    const startingTrackId =
      typeof (data as Record<string, unknown>).startingTrackId === 'string'
        ? (data as Record<string, unknown>).startingTrackId as string
        : result.startingTrackId;

    return {
      graph: result.graph,
      audioSetup: result.audioSetup ?? audioSetup,
      startingTrackId,
      errors: result.errors,
      warnings: result.warnings,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return emptyResult([`Failed to load preset ${presetName}: ${message}`]);
  }
}

/**
 * Load a preset from a JSON string (e.g. from a file or clipboard).
 * Preserves automation (lanes, regions, curves). Uses same validation and migrations as loadPreset.
 * Use for "Import from file" when the user selects a saved .json preset file.
 */
export async function loadPresetFromJson(
  json: string,
  nodeSpecs: NodeSpecification[] = []
): Promise<LoadPresetResult> {
  const emptyResult = (
    errors: string[],
    warnings: string[] = []
  ): LoadPresetResult => ({
    graph: null,
    audioSetup: undefined,
    errors,
    warnings,
  });

  try {
    const unvalidated = deserializeGraphUnvalidated(json);
    if (unvalidated.errors.length > 0) {
      return {
        graph: null,
        audioSetup: undefined,
        errors: unvalidated.errors,
        warnings: unvalidated.warnings,
      };
    }
    if (!unvalidated.graph) {
      return emptyResult(unvalidated.errors, unvalidated.warnings);
    }

    const migratedGraph = migrateLegacyNodeGraph(unvalidated.graph);

    const roundtripJson = serializeGraph(
      migratedGraph,
      false,
      unvalidated.audioSetup,
      unvalidated.startingTrackId ? { startingTrackId: unvalidated.startingTrackId } : undefined
    );
    const result = deserializeGraph(roundtripJson, nodeSpecs);

    return {
      graph: result.graph,
      audioSetup: result.audioSetup ?? unvalidated.audioSetup ?? undefined,
      startingTrackId: result.startingTrackId ?? unvalidated.startingTrackId,
      errors: result.errors,
      warnings: [...unvalidated.warnings, ...result.warnings],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return emptyResult([`Invalid preset JSON: ${message}`]);
  }
}

function presetJsonDownloadFilename(graph: NodeGraph): string {
  const raw = graph.name.trim().slice(0, 80) || 'graph';
  const safe = raw
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `${safe || 'graph'}.json`;
}

/**
 * Download current graph and audio setup as a JSON file (same payload as former clipboard export).
 */
export function downloadGraphAsJsonFile(graph: NodeGraph, audioSetup?: AudioSetup | null): void {
  const startingTrackId =
    audioSetup?.primarySource?.type === 'playlist' ? audioSetup.primarySource.trackId : undefined;
  const json = serializeGraph(graph, true, audioSetup ?? undefined, { startingTrackId });
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = presetJsonDownloadFilename(graph);
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Format preset filename to display name
 * Converts "my-preset" to "My Preset"
 */
function formatPresetName(name: string): string {
  return name
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function isValidAudioSetup(val: unknown): val is AudioSetup {
  if (!val || typeof val !== 'object') return false;
  const o = val as Record<string, unknown>;
  return (
    Array.isArray(o.files) &&
    Array.isArray(o.bands) &&
    Array.isArray(o.remappers)
  );
}
