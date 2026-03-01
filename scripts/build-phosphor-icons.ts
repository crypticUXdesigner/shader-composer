/**
 * Build Phosphor Icons path-data JSON
 *
 * Reads SVG assets from @phosphor-icons/core (regular + fill weights),
 * extracts <path d="..."> data, and writes JSON files for use by the icon
 * loader (see work package tabler-to-phosphor 02).
 *
 * Run: npm run build-phosphor-icons (or pnpm run build-phosphor-icons)
 * Output: public/phosphor-nodes-regular.json, public/phosphor-nodes-fill.json
 *
 * Output format: Record<string, Array<["path", { d: string }]>> — same shape
 * consumed by icons.ts and canvas-icons.ts.
 * Path data is left at Phosphor’s native scale (typically 256×256); scaling
 * to 24×24 is handled at render time in the app.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROJECT_ROOT = join(__dirname, '..');
const ASSETS_ROOT = join(PROJECT_ROOT, 'node_modules', '@phosphor-icons', 'core', 'assets');
const PUBLIC_DIR = join(PROJECT_ROOT, 'public');

type PathNode = ['path', { d: string }];
type IconData = PathNode[];
type OutputFormat = Record<string, IconData>;

const WEIGHTS = ['regular', 'fill'] as const;

/** Extract all <path d="..."> values from SVG string (double-quoted). */
function extractPathDStrings(svgContent: string): string[] {
  const dValues: string[] = [];
  const regex = /<path[^>]*\s+d="([^"]*)"/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(svgContent)) !== null) {
    const d = match[1]?.trim();
    if (d) dValues.push(d);
  }
  return dValues;
}

/** Build icon key from filename: "plus-regular.svg" -> "plus". */
function iconKeyFromFilename(filename: string, weight: string): string {
  const suffix = `-${weight}.svg`;
  if (filename.toLowerCase().endsWith(suffix)) {
    return filename.slice(0, filename.length - suffix.length);
  }
  return filename.replace(/\.svg$/i, '');
}

function buildWeightJson(weight: (typeof WEIGHTS)[number]): OutputFormat {
  const assetsDir = join(ASSETS_ROOT, weight);
  if (!existsSync(assetsDir)) {
    console.warn(`Assets dir not found: ${assetsDir}`);
    return {};
  }

  const files = readdirSync(assetsDir).filter((f) => f.endsWith('.svg'));
  const out: OutputFormat = {};

  for (const file of files) {
    const filePath = join(assetsDir, file);
    const svgContent = readFileSync(filePath, 'utf-8');
    const dStrings = extractPathDStrings(svgContent);
    if (dStrings.length === 0) continue;

    const key = iconKeyFromFilename(file, weight);
    const nodes: IconData = dStrings.map((d) => ['path', { d }] as PathNode);
    out[key] = nodes;
  }

  return out;
}

function main(): void {
  if (!existsSync(ASSETS_ROOT)) {
    console.error(
      `Phosphor assets not found at ${ASSETS_ROOT}. Run: npm install (ensure @phosphor-icons/core is in dependencies).`
    );
    process.exit(1);
  }

  for (const weight of WEIGHTS) {
    const data = buildWeightJson(weight);
    const outputPath = join(PUBLIC_DIR, `phosphor-nodes-${weight}.json`);
    writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');
    const count = Object.keys(data).length;
    console.log(`Wrote ${outputPath} (${count} icons).`);
  }
}

main();
