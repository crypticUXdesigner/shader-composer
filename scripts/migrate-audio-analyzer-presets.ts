/**
 * One-off migration: add per-band smoothing (band0..3Smoothing) to audio-analyzer
 * nodes in preset JSON files. Copies from existing "smoothing" when present.
 * Run: npx tsx scripts/migrate-audio-analyzer-presets.ts
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function migrateGraph(graph: { nodes: Array<{ type?: string; parameters?: Record<string, unknown> }> }): boolean {
  let changed = false;
  for (const node of graph.nodes) {
    if (node.type !== 'audio-analyzer' || !node.parameters) continue;
    const p = node.parameters;
    if (p.band0Smoothing !== undefined && typeof p.band0Smoothing === 'number') continue;
    const legacy = typeof p.smoothing === 'number' ? p.smoothing : 0.8;
    p.band0Smoothing = legacy;
    p.band1Smoothing = legacy;
    p.band2Smoothing = legacy;
    p.band3Smoothing = legacy;
    changed = true;
  }
  return changed;
}

function main(): void {
  const presetsDir = join(__dirname, '../src/presets');
  const files = readdirSync(presetsDir)
    .filter((f) => f.endsWith('.json'))
    .sort();
  let updated = 0;
  for (const file of files) {
    const path = join(presetsDir, file);
    const raw = readFileSync(path, 'utf-8');
    const data = JSON.parse(raw) as {
      format?: string;
      graph?: { nodes: Array<{ type?: string; parameters?: Record<string, unknown> }> };
      nodes?: Array<{ type?: string; parameters?: Record<string, unknown> }>;
    };
    const graph =
      data.format === 'shader-composer-node-graph'
        ? data.graph
        : data.nodes
          ? (data as { nodes: Array<{ type?: string; parameters?: Record<string, unknown> }> })
          : null;
    if (!graph?.nodes) continue;
    const changed = migrateGraph(graph);
    if (changed) {
      writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf-8');
      console.log(`Updated ${file}`);
      updated++;
    }
  }
  console.log(`Done. Updated ${updated} preset(s).`);
}

main();
