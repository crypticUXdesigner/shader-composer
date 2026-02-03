/**
 * Migrate preset JSONs: replace each 4-band audio-analyzer with N single-band
 * audio-analyzer nodes (one per band that has connections). Rewire connections
 * and replicate band settings.
 *
 * Run: npx tsx scripts/migrate-audio-analyzer-to-single-band.ts
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface Connection {
  id: string;
  sourceNodeId: string;
  sourcePort: string;
  targetNodeId: string;
  targetPort?: string;
  targetParameter?: string;
}

interface Node {
  id: string;
  type: string;
  position: { x: number; y: number };
  parameters: Record<string, unknown>;
  parameterInputModes?: Record<string, string>;
  label?: string;
}

interface Graph {
  id: string;
  name?: string;
  version?: string;
  nodes: Node[];
  connections: Connection[];
  viewState?: unknown;
}

interface PresetData {
  format?: string;
  formatVersion?: string;
  graph?: Graph;
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function migrateGraph(graph: Graph): boolean {
  const analyzerNodes = graph.nodes.filter((n) => n.type === 'audio-analyzer');
  if (analyzerNodes.length === 0) return false;

  let changed = false;
  for (const oldNode of analyzerNodes) {
    const oldParams = oldNode.parameters as Record<string, unknown>;
    const freqBands = (oldParams.frequencyBands as number[][]) ?? [
      [20, 120],
      [120, 300],
      [300, 4000],
      [4000, 20000],
    ];
    const outConnections = graph.connections.filter((c) => c.sourceNodeId === oldNode.id);
    const bandsInUse = new Set<number>();
    for (const c of outConnections) {
      const m = c.sourcePort.match(/^(band|remap)(\d)$/);
      if (m) bandsInUse.add(Number(m[2]));
    }
    if (bandsInUse.size === 0) bandsInUse.add(0);

    const audioInputConn = graph.connections.find(
      (c) => c.targetNodeId === oldNode.id && c.targetPort === 'audioFile'
    );
    const audioFileNodeId = audioInputConn?.sourceNodeId ?? null;

    const newNodes: Node[] = [];
    const bandIndices = Array.from(bandsInUse).sort((a, b) => a - b);
    const dx = 320;
    for (let idx = 0; idx < bandIndices.length; idx++) {
      const i = bandIndices[idx];
      const band = Array.isArray(freqBands[i]) && freqBands[i].length >= 2 ? freqBands[i] : [20, 20000];
      const smoothing =
        typeof (oldParams[`band${i}Smoothing`] ?? oldParams.smoothing) === 'number'
          ? (oldParams[`band${i}Smoothing`] ?? oldParams.smoothing) as number
          : 0.8;
      const inMin = (typeof oldParams[`band${i}RemapInMin`] === 'number' ? oldParams[`band${i}RemapInMin`] : 0) as number;
      const inMax = (typeof oldParams[`band${i}RemapInMax`] === 'number' ? oldParams[`band${i}RemapInMax`] : 1) as number;
      const outMin = (typeof oldParams[`band${i}RemapOutMin`] === 'number' ? oldParams[`band${i}RemapOutMin`] : 0) as number;
      const outMax = (typeof oldParams[`band${i}RemapOutMax`] === 'number' ? oldParams[`band${i}RemapOutMax`] : 1) as number;

      newNodes.push({
        id: generateId('node'),
        type: 'audio-analyzer',
        position: {
          x: oldNode.position.x + idx * dx,
          y: oldNode.position.y,
        },
        parameters: {
          frequencyBands: [band],
          smoothing,
          fftSize: typeof oldParams.fftSize === 'number' ? oldParams.fftSize : 4096,
          inMin,
          inMax,
          outMin,
          outMax,
        },
      });
    }

    const newConnections: Connection[] = [];
    for (const c of graph.connections) {
      if (c.targetNodeId === oldNode.id && c.targetPort === 'audioFile') {
        for (let idx = 0; idx < newNodes.length; idx++) {
          newConnections.push({
            id: generateId('conn'),
            sourceNodeId: audioFileNodeId!,
            sourcePort: c.sourcePort,
            targetNodeId: newNodes[idx].id,
            targetPort: 'audioFile',
          });
        }
        continue;
      }
      if (c.sourceNodeId !== oldNode.id) {
        newConnections.push(c);
        continue;
      }
      const m = c.sourcePort.match(/^(band|remap)(\d)$/);
      if (!m) {
        newConnections.push(c);
        continue;
      }
      const portType = m[1];
      const bandIndex = Number(m[2]);
      const newIdx = bandIndices.indexOf(bandIndex);
      if (newIdx === -1) {
        newConnections.push(c);
        continue;
      }
      const newNode = newNodes[newIdx];
      const newPort = portType === 'band' ? 'band' : 'remap';
      newConnections.push({
        ...c,
        sourceNodeId: newNode.id,
        sourcePort: newPort,
      });
    }

    graph.nodes = graph.nodes.filter((n) => n.id !== oldNode.id);
    graph.nodes.push(...newNodes);
    graph.connections = newConnections;
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
    const data = JSON.parse(raw) as PresetData;
    const graph = data.graph ?? (data as unknown as Graph);
    if (!graph?.nodes || !graph?.connections) continue;
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
