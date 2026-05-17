/**
 * Regenerates src/utils/nodeSearchTags.ts from node specs + curated overrides.
 * Run: node scripts/generate-node-search-tags.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const nodesDir = path.join(__dirname, '..', 'src', 'shaders', 'nodes');
const outFile = path.join(__dirname, '..', 'src', 'utils', 'nodeSearchTags.ts');

/** Extra tags per node id (merged with generated baseline). */
const OVERRIDES = {
  'uv-coordinates': ['uv', 'coords', 'texture', 'coordinates'],
  'fragment-coordinates': ['frag', 'pixel', 'screen', 'glsl'],
  time: ['clock', 'seconds', 'animation', 'timeline'],
  resolution: ['size', 'viewport', 'dimensions', 'screen'],
  'constant-float': ['scalar', 'number', 'value'],
  'constant-vec2': ['vector', 'uv', 'xy'],
  'constant-vec3': ['vector', 'rgb', 'color', 'xyz'],
  'constant-vec4': ['vector', 'rgba', 'xyzw'],
  'mixed-wave-signal': ['audio', 'wave', 'lfo', 'modulation'],
  'arrangement-lanes': ['midi', 'regions', 'arrangement', 'tracks'],
  'arrangement-notes': ['midi', 'notes', 'piano', 'arrangement'],
  'oscillator-2d': ['audio', 'lfo', 'xy', 'modulation'],
  'path-drive': ['audio', 'envelope', 'path', 'automation'],
  'oklch-color': ['color', 'oklch', 'perceptual', 'picker'],
  'bezier-curve': ['curve', 'easing', 'interpolation', 'remap'],
  transform: ['scale', 'rotate', 'translate', '2d', 'matrix'],
  'polar-coordinates': ['polar', 'angle', 'radius', 'coords'],
  'vector-field': ['flow', 'direction', 'distort', 'warp'],
  turbulence: ['noise', 'warp', 'distort', 'fbm'],
  kaleidoscope: ['mirror', 'symmetry', 'segments', 'radial'],
  'kaleidoscope-smooth': ['kaleidoscope', 'mirror', 'symmetry', 'smooth'],
  'radial-uv-warp': ['radial', 'warp', 'bulge', 'lens'],
  ripple: ['wave', 'water', 'distort', 'concentric'],
  displace: ['offset', 'translate', 'warp', 'uv'],
  vortex: ['twist', 'swirl', 'rotate', 'distort'],
  'quad-warp': ['perspective', 'corner', 'pin', 'warp'],
  'plane-project': ['projection', 'camera', 'uv', '3d'],
  'brick-tiling': ['tile', 'brick', 'repeat', 'offset'],
  'uv-block-glitch': ['glitch', 'blocks', 'digital', 'corrupt'],
  'uv-band-shift': ['shift', 'bands', 'offset', 'slice'],
  'infinite-zoom': ['zoom', 'tunnel', 'scale', 'loop'],
  noise: ['fbm', 'perlin', 'simplex', 'random', 'procedural'],
  'warp-terrain': ['terrain', 'height', 'landscape', 'fbm'],
  'voronoi-noise': ['voronoi', 'worley', 'cells', 'cellular'],
  'cubic-curl-noise': ['curl', 'flow', 'vector', 'noise'],
  rings: ['concentric', 'circle', 'radial', 'lines'],
  'radial-pulse': ['pulse', 'beat', 'wave', 'radial'],
  gradient: ['ramp', 'lerp', 'color', 'blend'],
  'radial-rays': ['rays', 'godrays', 'sun', 'radial'],
  'crepuscular-rays': ['godrays', 'sunbeams', 'light', 'volumetric'],
  'volume-rays': ['fog', 'cloud', 'volumetric', 'density'],
  streak: ['spot', 'flare', 'lens', 'streak'],
  'flow-field-pattern': ['flow', 'streamlines', 'pattern', 'vector'],
  'hexagonal-grid': ['hex', 'tile', 'grid', 'pattern'],
  stripes: ['lines', 'bands', 'parallel', 'pattern'],
  dots: ['stipple', 'points', 'halftone', 'grid'],
  'disco-pattern': ['disco', 'tiles', 'color', 'pattern'],
  'triangle-grid': ['triangular', 'mesh', 'tiling', 'pattern'],
  'particle-system': ['grain', 'speckle', 'dust', 'particles'],
  'rain-drops': ['rain', 'water', 'drops', 'weather'],
  'sphere-raymarch': ['sphere', '3d', 'raymarch', 'sdf'],
  'spherical-fibonacci': ['sphere', 'fibonacci', 'points', 'distribution'],
  'bloom-sphere': ['sphere', 'glow', 'lattice', '3d'],
  'box-torus-sdf': ['box', 'torus', 'primitive', 'sdf', 'mesh'],
  'glass-shell': ['glass', 'shell', 'transparent', 'sdf'],
  'hex-prism-sdf': ['hex', 'prism', 'sdf', '3d'],
  'radial-repeat-sdf': ['repeat', 'polar', 'sdf', 'array'],
  'repeated-hex-prism-sdf': ['hex', 'repeat', 'prism', 'sdf', 'array'],
  'kifs-sdf': ['kifs', 'fractal', 'fold', 'sdf'],
  'mandelbox-sdf': ['mandelbox', 'fractal', 'fold', 'sdf'],
  'menger-sponge-sdf': ['menger', 'sponge', 'fractal', 'sdf'],
  'sierpinski-tetra-sdf': ['sierpinski', 'tetrahedron', 'fractal', 'sdf'],
  'ether-sdf': ['ether', 'fractal', 'organic', 'sdf'],
  'julia-slab-sdf': ['julia', 'fractal', 'slab', '2d', 'sdf'],
  'mandelbulb-sdf': ['mandelbulb', 'fractal', 'bulb', '3d', 'sdf'],
  'displacement-3d': ['displace', '3d', 'surface', 'noise'],
  'generic-raymarcher': ['raymarch', 'sdf', '3d', 'distance', 'render'],
  'iridescent-tunnel': ['tunnel', 'iridescent', '3d', 'color'],
  'inflated-icosahedron': ['icosahedron', 'polyhedron', '3d', 'mesh'],
  'shapes-2d': ['circle', 'rectangle', 'sdf', '2d', 'mask'],
  'star-shape-2d': ['star', 'flower', '2d', 'shape'],
  'star-2d': ['star', 'burst', '2d', 'spike'],
  metaballs: ['blob', 'merge', 'sdf', 'organic'],
  fractal: ['mandelbrot', 'julia', '2d', 'iteration'],
  'iterated-inversion': ['inversion', 'fractal', 'fold', 'spotlight'],
  'plane-grid': ['grid', 'floor', 'plane', 'lines'],
  'sky-dome': ['sky', 'sun', 'atmosphere', 'background'],
  'bokeh-point': ['bokeh', 'lens', 'defocus', 'lights'],
  'drive-home-lights': ['lights', 'street', 'night', 'bokeh'],
  add: ['plus', 'sum'],
  subtract: ['minus', 'difference'],
  multiply: ['times', 'product'],
  divide: ['division', 'ratio'],
  power: ['exponent', 'pow'],
  'square-root': ['sqrt', 'root'],
  absolute: ['abs', 'magnitude'],
  modulo: ['mod', 'remainder'],
  mix: ['lerp', 'blend', 'interpolate'],
  step: ['threshold', 'hard'],
  smoothstep: ['ease', 'smooth', 'hermite'],
  sine: ['sin', 'wave', 'oscillator'],
  cosine: ['cos', 'wave'],
  tangent: ['tan'],
  'arc-sine': ['asin', 'arcsin'],
  'arc-cosine': ['acos', 'arccos'],
  'arc-tangent': ['atan', 'arctan'],
  'arc-tangent-2': ['atan2'],
  exponential: ['exp', 'pow'],
  'natural-logarithm': ['log', 'ln'],
  length: ['magnitude', 'norm'],
  distance: ['dist', 'separation'],
  'dot-product': ['dot', 'inner'],
  'cross-product': ['cross'],
  normalize: ['unit', 'direction'],
  reflect: ['mirror', 'bounce'],
  refract: ['snell', 'glass'],
  blend: ['mix', 'lerp', 'overlay', 'multiply', 'screen', 'composite', 'photoshop'],
  compare: ['greater', 'less', 'equal', 'condition'],
  select: ['branch', 'if', 'switch', 'choose'],
  'mask-composite-float': ['mask', 'alpha', 'bw', 'composite'],
  'mask-composite-vec2': ['mask', 'uv', 'composite'],
  'mask-composite-vec3': ['mask', 'color', 'composite'],
  blur: ['gaussian', 'soften', 'defocus'],
  'glow-bloom': ['glow', 'bloom', 'halation', 'bright'],
  bokeh: ['defocus', 'lens', 'circles'],
  'edge-detection': ['sobel', 'edges', 'outline', 'contour'],
  'chromatic-aberration': ['aberration', 'dispersion', 'rgb', 'lens'],
  'rgb-separation': ['rgb', 'channel', 'offset', 'glitch'],
  scanlines: ['crt', 'tv', 'lines', 'interlace'],
  'color-grading': ['grade', 'levels', 'curves', 'color'],
  'normal-mapping': ['normal', 'bump', 'lighting', 'surface'],
  'lighting-shading': ['light', 'shade', 'diffuse', 'specular'],
  hash32: ['hash', 'random', 'noise', 'seed'],
  'one-minus': ['invert', 'reverse'],
  negate: ['invert', 'sign'],
  reciprocal: ['inverse', 'divide'],
  'clamp-01': ['saturate', 'limit'],
  saturate: ['clamp', 'limit', '01'],
  lerp: ['mix', 'blend', 'interpolate'],
  swizzle: ['shuffle', 'reorder', 'channels'],
  'split-vector': ['split', 'unpack', 'decompose'],
  'combine-vector': ['combine', 'pack', 'vec2', 'vec3', 'vec4', 'merge', 'layers'],
  'oklch-color-map': ['colormap', 'gradient', 'palette', 'smooth', 'stepped', 'bands'],
  'color-lut': ['lut', 'colormap', 'viridis', 'turbo', 'preset', 'heatmap', 'scientific'],
  'color-gradient': ['gradient', 'spatial', 'sky', 'ramp', 'oklch', 'position', 'mask'],
  'bayer-dither': ['dither', 'ordered', 'halftone'],
  'tone-mapping': ['hdr', 'exposure', 'reinhard', 'filmic'],
  'final-output': ['output', 'render', 'present', 'screen'],
  'orbit-camera': ['camera', 'orbit', '3d', 'view'],
  'look-at-camera': ['camera', 'lookat', '3d', 'view'],
  ceil: ['ceiling', 'round', 'integer'],
  floor: ['flooring', 'round', 'integer'],
  fract: ['fractional', 'decimal', 'repeat'],
  clamp: ['limit', 'bounds', 'range'],
  truncate: ['trunc', 'integer', 'floor'],
  sign: ['signum', 'positive', 'negative'],
  round: ['rounding', 'nearest', 'integer'],
  min: ['minimum', 'lower'],
  max: ['maximum', 'upper'],
};

const SKIP_TAG = new Set(['the', 'and', 'for', 'with', 'from', 'node', 'sdf', '2d', '3d']);

function tokenizeId(id) {
  return id.split('-').filter((t) => t.length > 1 && !SKIP_TAG.has(t));
}

function tokenizeDisplayName(displayName) {
  return displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !SKIP_TAG.has(t));
}

function uniqueTags(...lists) {
  const seen = new Set();
  const out = [];
  for (const list of lists) {
    for (const raw of list) {
      const tag = raw.toLowerCase().trim();
      if (!tag || seen.has(tag)) continue;
      seen.add(tag);
      out.push(tag);
    }
  }
  return out;
}

function extractSpecs(content) {
  const specs = [];
  const re = /export const \w+NodeSpec:\s*NodeSpec\s*=\s*\{([\s\S]*?)\n\};/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const block = m[1];
    const id = block.match(/^\s*id:\s*'([^']+)'/m)?.[1];
    const displayName = block.match(/displayName:\s*'([^']+)'/)?.[1];
    const category = block.match(/category:\s*'([^']+)'/)?.[1];
    if (id && displayName && category) specs.push({ id, displayName, category });
  }
  return specs;
}

const files = fs
  .readdirSync(nodesDir)
  .filter((f) => f.endsWith('.ts') && f !== 'index.ts' && f !== 'math-operations.ts');

const exportNameToId = new Map();
const allSpecs = new Map();
for (const file of files) {
  const content = fs.readFileSync(path.join(nodesDir, file), 'utf8');
  const exportRe = /export const (\w+NodeSpec):\s*NodeSpec\s*=\s*\{[\s\S]*?^\s*id:\s*'([^']+)'/gm;
  let exportMatch;
  while ((exportMatch = exportRe.exec(content)) !== null) {
    exportNameToId.set(exportMatch[1], exportMatch[2]);
  }
  for (const spec of extractSpecs(content)) {
    allSpecs.set(spec.id, spec);
  }
}

const indexContent = fs.readFileSync(path.join(nodesDir, 'index.ts'), 'utf8');
const aliasToExport = new Map();
const aliasRe = /const (\w+)\s*=\s*(\w+NodeSpec)/g;
let aliasMatch;
while ((aliasMatch = aliasRe.exec(indexContent)) !== null) {
  aliasToExport.set(aliasMatch[1], aliasMatch[2]);
}
const arrayBody = indexContent.match(/export const nodeSystemSpecs[\s\S]*?=\s*\[([\s\S]*?)\];/)?.[1] ?? '';
const arrayTokens = arrayBody
  .replace(/\/\/.*$/gm, '')
  .split(/[\n,]/)
  .map((s) => s.trim())
  .filter(Boolean);
const registeredIds = new Set(
  arrayTokens
    .map((token) => (token.endsWith('NodeSpec') ? token : aliasToExport.get(token)))
    .map((exportName) => exportNameToId.get(exportName))
    .filter(Boolean)
);

const entries = [...allSpecs.values()]
  .filter(({ id }) => registeredIds.has(id))
  .sort((a, b) => a.id.localeCompare(b.id))
  .map(({ id, displayName }) => {
    const tags = uniqueTags(
      tokenizeId(id),
      tokenizeDisplayName(displayName),
      OVERRIDES[id] ?? []
    );
    return [id, tags];
  });

const lines = [
  '/**',
  ' * Curated palette search aliases keyed by node id.',
  ' * Regenerate: `node scripts/generate-node-search-tags.mjs`',
  ' */',
  'export const NODE_SEARCH_TAGS: Readonly<Record<string, readonly string[]>> = {',
];

for (const [id, tags] of entries) {
  const formatted = tags.map((t) => `'${t.replace(/'/g, "\\'")}'`).join(', ');
  lines.push(`  '${id}': [${formatted}],`);
}
lines.push('};', '');

const missing = [...registeredIds].filter((id) => !entries.some(([eid]) => eid === id));
if (missing.length > 0) {
  console.error('Registered nodes missing from parsed specs:', missing.join(', '));
  process.exit(1);
}

fs.writeFileSync(outFile, lines.join('\n'));
console.log(
  `Wrote ${entries.length} node tag entries (${registeredIds.size} registered) to ${path.relative(process.cwd(), outFile)}`
);
