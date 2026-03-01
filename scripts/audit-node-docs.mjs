/**
 * One-off audit: list node IDs from registry vs node-documentation.json.
 * Run: node scripts/audit-node-docs.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

// CamelCase or mixed name to kebab-case id (e.g. uvCoordinatesNodeSpec -> uv-coordinates).
// Specs that use numbers or different kebab patterns override the default.
const OVERRIDE_IDS = {
  arcTangent2NodeSpec: 'arc-tangent-2',
  clamp01NodeSpec: 'clamp-01',
  displacement3dNodeSpec: 'displacement-3d',
  shapes2dNodeSpec: 'shapes-2d',
  starShape2dNodeSpec: 'star-shape-2d',
  star2dNodeSpec: 'star-2d',
  _metaballs: 'metaballs'
};

function varToId(name) {
  if (OVERRIDE_IDS[name]) return OVERRIDE_IDS[name];
  const base = name.replace(/NodeSpec$/, '').replace(/^_/, '');
  return base
    .replace(/([A-Z])/g, (m) => '-' + m.toLowerCase())
    .replace(/^\-/, '');
}

// Read node index and extract every spec variable from nodeSystemSpecs array
const indexPath = path.join(root, 'src/shaders/nodes/index.ts');
const indexContent = fs.readFileSync(indexPath, 'utf8');
const arrayMatch = indexContent.match(/export const nodeSystemSpecs: NodeSpec\[\] = \[([\s\S]*?)\];/);
if (!arrayMatch) {
  console.error('Could not find nodeSystemSpecs array');
  process.exit(1);
}
const specVars = arrayMatch[1]
  .split(/[\n,]/)
  .map((s) => s.replace(/\/\/.*/, '').trim())
  .filter((s) => /^[a-zA-Z_]\w*NodeSpec$/.test(s) || /^_[a-zA-Z]\w+$/.test(s));

const registryIds = specVars.map((v) => varToId(v)).filter(Boolean).sort();

// Load node-documentation.json
const docPath = path.join(root, 'src/data/node-documentation.json');
const doc = JSON.parse(fs.readFileSync(docPath, 'utf8'));
const docKeys = Object.keys(doc.helpItems || {}).filter((k) => k.startsWith('node:'));
const docIds = docKeys.map((k) => k.replace('node:', '')).sort();

const missing = registryIds.filter((id) => !docIds.includes(id));
const extra = docIds.filter((id) => !registryIds.includes(id));

console.log('Registry node count:', registryIds.length);
console.log('Doc node:<id> count:', docIds.length);
console.log('Missing from docs:', missing.length, missing.slice(0, 30).join(', '), missing.length > 30 ? '...' : '');
console.log('Extra in docs (not in registry):', extra.length, extra.slice(0, 15).join(', ') || '(none)');
