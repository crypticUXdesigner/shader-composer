/**
 * Preset Manager for Node-Based Shader System
 *
 * Handles listing, loading, and managing preset files for the node-based system.
 * Presets are stored as JSON files in the src/presets/ directory.
 * Uses audioSetup from file when valid; audio is configured outside the visual node graph.
 */

import type { NodeGraph } from '../data-model/types';
import type { AudioSetup } from '../data-model/audioSetupTypes';
import { serializeGraph, deserializeGraph } from '../data-model/serialization';
import type { NodeSpecification } from '../data-model/validation';
import { migrateNoiseNodes } from '../data-model/noiseNodesMigration';

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
  const presetModules = import.meta.glob('/src/presets/*.json', { eager: false });
  
  const presets: PresetInfo[] = [];
  
  for (const path in presetModules) {
    // Extract filename from path (e.g., "/src/presets/sphere.json" -> "sphere")
    const match = path.match(/\/([^/]+)\.json$/);
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
    const presetModules = import.meta.glob('/src/presets/*.json', { eager: false });
    const presetPath = `/src/presets/${presetName}.json`;

    if (!(presetPath in presetModules)) {
      return emptyResult([`Preset not found: ${presetName}`]);
    }

    const module = await presetModules[presetPath]();
    const data = (module as { default: unknown }).default as Record<string, unknown>;

    let graph: NodeGraph;
    if (data.format === 'shader-composer-node-graph' && data.graph) {
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

    const migratedGraph = migrateNoiseNodes(graph);
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
    const result = deserializeGraph(json, nodeSpecs);
    if (result.errors.length > 0) {
      return {
        graph: result.graph ?? null,
        audioSetup: result.audioSetup ?? undefined,
        errors: result.errors,
        warnings: result.warnings,
      };
    }
    if (!result.graph) {
      return emptyResult(result.errors, result.warnings);
    }
    const migrated = migrateNoiseNodes(result.graph);
    const audioSetup: AudioSetup | undefined = result.audioSetup ?? undefined;
    return {
      graph: migrated,
      audioSetup,
      startingTrackId: result.startingTrackId,
      errors: result.errors,
      warnings: result.warnings,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return emptyResult([`Invalid preset JSON: ${message}`]);
  }
}

/**
 * Copy current graph and audio setup to clipboard as JSON
 * @param graph - The graph to copy
 * @param audioSetup - Panel audio configuration (files, bands, remappers, primarySource, playlistState)
 * @returns Promise that resolves when copy is complete
 */
export async function copyGraphToClipboard(
  graph: NodeGraph,
  audioSetup?: AudioSetup | null
): Promise<void> {
  const startingTrackId =
    audioSetup?.primarySource?.type === 'playlist' ? audioSetup.primarySource.trackId : undefined;
  const json = serializeGraph(graph, true, audioSetup ?? undefined, { startingTrackId });
  try {
    // Check if clipboard API is available
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(json);
    } else {
      throw new Error('Clipboard API not available');
    }
  } catch (error) {
    // Fallback for browsers that don't support clipboard API
    const textarea = document.createElement('textarea');
    textarea.value = json;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
      const success = document.execCommand('copy');
      if (!success) {
        throw new Error('execCommand copy failed');
      }
    } catch (err) {
      document.body.removeChild(textarea);
      throw new Error('Failed to copy to clipboard', { cause: err });
    } finally {
      document.body.removeChild(textarea);
    }
  }
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
