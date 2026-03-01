/**
 * Canvas Icon Renderer
 *
 * Provides efficient SVG-to-canvas rendering with caching.
 * Uses Phosphor Icons exclusively. Path data from public/phosphor-nodes-*.json
 * (see scripts/build-phosphor-icons.ts). https://phosphoricons.com
 *
 * CENTRALIZED ICON DEFINITION SYSTEM:
 * - All icons are defined once here with phosphorIconName + variant (line/filled)
 * - line → Phosphor "regular" weight; filled → Phosphor "fill" weight
 * - Phosphor path data is 256×256; we scale to 24×24 at render time.
 */

import { getPhosphorNodesOutline, getPhosphorNodesFilled } from './phosphor-icons-loader';

/**
 * Icon definition: Phosphor icon name (kebab-case, as in JSON keys) + variant
 */
export interface IconDefinition {
  phosphorIconName: string;
  variant: 'line' | 'filled';
}

/**
 * Centralized icon registry. Single source of truth for DOM and canvas.
 * phosphorIconName must match a key in phosphor-nodes-regular.json or phosphor-nodes-fill.json.
 */
export const iconRegistry: Record<string, IconDefinition> = {
  // Basic shapes
  'circle': { phosphorIconName: 'circle', variant: 'filled' },
  'circle-dotted': { phosphorIconName: 'circle-dashed', variant: 'line' },
  'square': { phosphorIconName: 'square', variant: 'line' },
  'star': { phosphorIconName: 'star', variant: 'line' },
  'square-rounded-corners': { phosphorIconName: 'square', variant: 'line' },
  'rectangle': { phosphorIconName: 'rectangle', variant: 'line' },
  'hexagon': { phosphorIconName: 'hexagon', variant: 'line' },
  'sphere': { phosphorIconName: 'circle', variant: 'line' },
  'cube': { phosphorIconName: 'cube', variant: 'filled' },
  'cube-transparent': { phosphorIconName: 'cube-transparent', variant: 'line' },
  'box': { phosphorIconName: 'cube', variant: 'line' },
  'cylinder': { phosphorIconName: 'cylinder', variant: 'line' },
  'ring': { phosphorIconName: 'circle', variant: 'line' },
  'rings': { phosphorIconName: 'circle', variant: 'line' },
  'infinity': { phosphorIconName: 'infinity', variant: 'line' },
  'sparkles-2': { phosphorIconName: 'sparkles', variant: 'line' },
  'circle-dashed': { phosphorIconName: 'circle-dashed', variant: 'line' },
  'car': { phosphorIconName: 'headlights', variant: 'line' },
  'droplets': { phosphorIconName: 'drop', variant: 'line' },

  // Patterns & grids
  'grid': { phosphorIconName: 'grid-four', variant: 'line' },
  'grid-nine': { phosphorIconName: 'grid-nine', variant: 'line' },
  'dither': { phosphorIconName: 'checkerboard', variant: 'line' },
  'grain': { phosphorIconName: 'dots-three', variant: 'line' },
  'noise': { phosphorIconName: 'dots-three', variant: 'line' },
  'particle': { phosphorIconName: 'dots-three', variant: 'line' },
  'cell': { phosphorIconName: 'squares-four', variant: 'line' },
  'curly-loop': { phosphorIconName: 'infinity', variant: 'line' },
  'hexagons': { phosphorIconName: 'hexagon', variant: 'line' },
  'dots': { phosphorIconName: 'dot', variant: 'line' },
  'dots-nine': { phosphorIconName: 'dots-nine', variant: 'line' },
  'spray': { phosphorIconName: 'dots-three', variant: 'line' },
  'atom-2': { phosphorIconName: 'atom', variant: 'line' },
  'topology-star-ring': { phosphorIconName: 'star', variant: 'line' },
  'sunrise': { phosphorIconName: 'sun', variant: 'line' },
  'triangles': { phosphorIconName: 'caret-up', variant: 'line' },
  'streak': { phosphorIconName: 'arrow-down-right', variant: 'line' },
  'shape-2': { phosphorIconName: 'shapes', variant: 'line' },
  'shapes-filled': { phosphorIconName: 'shapes', variant: 'filled' },
  'layout-board': { phosphorIconName: 'squares-four', variant: 'line' },
  'kaleidoscope': { phosphorIconName: 'shapes', variant: 'line' },
  'compass-rose': { phosphorIconName: 'compass-rose', variant: 'line' },

  // Audio & waveforms
  'audio-waveform': { phosphorIconName: 'wave-sine', variant: 'line' },
  'wave': { phosphorIconName: 'wave-sine', variant: 'line' },
  'waves': { phosphorIconName: 'waves', variant: 'line' },
  'ripple': { phosphorIconName: 'wave-sine', variant: 'line' },
  'trig-wave': { phosphorIconName: 'wave-sine', variant: 'line' },

  // Math & operations
  'calculator': { phosphorIconName: 'calculator', variant: 'line' },
  'plus': { phosphorIconName: 'plus', variant: 'filled' },
  'minus': { phosphorIconName: 'minus', variant: 'filled' },
  'multiply-x': { phosphorIconName: 'asterisk', variant: 'filled' },
  'divide': { phosphorIconName: 'divide', variant: 'line' },
  'power': { phosphorIconName: 'caret-up', variant: 'line' },
  'sqrt': { phosphorIconName: 'function', variant: 'line' },
  'constant': { phosphorIconName: 'hash', variant: 'line' },
  'hash': { phosphorIconName: 'hash', variant: 'line' },
  'hash-straight': { phosphorIconName: 'hash-straight', variant: 'line' },
  'percentage': { phosphorIconName: 'percent', variant: 'line' },
  'math-min': { phosphorIconName: 'caret-down', variant: 'line' },
  'math-max': { phosphorIconName: 'caret-up', variant: 'line' },
  'math-max-min': { phosphorIconName: 'arrows-vertical', variant: 'line' },
  'math-cos': { phosphorIconName: 'wave-sine', variant: 'line' },
  'math-tg': { phosphorIconName: 'wave-sine', variant: 'line' },
  'math-function-y': { phosphorIconName: 'function', variant: 'line' },
  'math-symbols': { phosphorIconName: 'plus-minus', variant: 'line' },
  'math-xy': { phosphorIconName: 'grid-four', variant: 'line' },
  'math-function': { phosphorIconName: 'function', variant: 'line' },
  'wave-sine': { phosphorIconName: 'wave-sine', variant: 'line' },

  // Vectors & geometry
  'arrow-right': { phosphorIconName: 'arrow-right', variant: 'line' },
  'arrow-down': { phosphorIconName: 'arrow-down', variant: 'line' },
  'arrow-up': { phosphorIconName: 'arrow-up', variant: 'line' },
  'arrows-left-right': { phosphorIconName: 'arrows-left-right', variant: 'line' },
  'arrows-right-left': { phosphorIconName: 'arrows-left-right', variant: 'line' },
  'vector-dot': { phosphorIconName: 'dot', variant: 'filled' },
  'vector-cross': { phosphorIconName: 'x', variant: 'line' },
  'vector-two': { phosphorIconName: 'vector-two', variant: 'line' },
  'vector-three': { phosphorIconName: 'vector-three', variant: 'line' },
  'normalize': { phosphorIconName: 'arrows-vertical', variant: 'line' },
  'reflect': { phosphorIconName: 'arrows-left-right', variant: 'line' },
  'refract': { phosphorIconName: 'circle-half', variant: 'line' },
  'bezier': { phosphorIconName: 'bezier-curve', variant: 'line' },
  'normal-map': { phosphorIconName: 'circle-half', variant: 'line' },

  // Transform & movement
  'move': { phosphorIconName: 'arrows-out', variant: 'line' },
  'rotate': { phosphorIconName: 'arrow-clockwise', variant: 'line' },
  'resize': { phosphorIconName: 'arrows-out-simple', variant: 'line' },
  'twist': { phosphorIconName: 'arrow-clockwise', variant: 'line' },
  'arrow-move-right': { phosphorIconName: 'arrow-right', variant: 'line' },
  'arrow-autofit-height': { phosphorIconName: 'arrows-vertical', variant: 'line' },
  'arrow-up-right': { phosphorIconName: 'arrow-up-right', variant: 'line' },
  'arrow-big-right': { phosphorIconName: 'arrow-fat-right', variant: 'line' },
  'flip-horizontal': { phosphorIconName: 'arrows-left-right', variant: 'line' },
  'zoom-in': { phosphorIconName: 'magnifying-glass-plus', variant: 'line' },
  'spiral': { phosphorIconName: 'spiral', variant: 'line' },
  'ikosaedr': { phosphorIconName: 'cube', variant: 'line' },

  // Effects & filters
  'blur-circle': { phosphorIconName: 'circle-half', variant: 'line' },
  'glow': { phosphorIconName: 'sun', variant: 'filled' },
  'scanline': { phosphorIconName: 'scan', variant: 'line' },
  'rgb-split': { phosphorIconName: 'arrows-out', variant: 'line' },
  'glitch-block': { phosphorIconName: 'grid-four', variant: 'filled' },
  'adjustments': { phosphorIconName: 'sliders', variant: 'line' },
  'focus': { phosphorIconName: 'crosshair', variant: 'line' },
  'glitch': { phosphorIconName: 'lightning', variant: 'line' },
  'displacement': { phosphorIconName: 'arrows-out', variant: 'line' },
  'brightness': { phosphorIconName: 'sun', variant: 'line' },
  'fish-simple': { phosphorIconName: 'fish-simple', variant: 'line' },
  'perspective': { phosphorIconName: 'perspective', variant: 'line' },

  // Color & gradients
  'color-palette': { phosphorIconName: 'palette', variant: 'line' },
  'color-wheel': { phosphorIconName: 'circle-half', variant: 'filled' },
  'color-picker': { phosphorIconName: 'eyedropper', variant: 'line' },
  'color-swatch': { phosphorIconName: 'palette', variant: 'line' },
  'gradient': { phosphorIconName: 'gradient', variant: 'line' },
  'ease-in-out-control-points': { phosphorIconName: 'chart-line', variant: 'line' },

  // Coordinates
  'chart-scatter': { phosphorIconName: 'chart-scatter', variant: 'line' },
  'chart-scatter-3d': { phosphorIconName: 'chart-scatter', variant: 'line' },

  // Special icons
  'brand-planetscale': { phosphorIconName: 'database', variant: 'filled' },
  'screen-share': { phosphorIconName: 'share', variant: 'line' },
  'contrast-2': { phosphorIconName: 'circle-half', variant: 'line' },

  // UI & controls
  'settings': { phosphorIconName: 'gear', variant: 'line' },
  'settings-2': { phosphorIconName: 'gear', variant: 'line' },
  'monitor': { phosphorIconName: 'desktop', variant: 'line' },
  'video': { phosphorIconName: 'video', variant: 'line' },
  'time-clock': { phosphorIconName: 'clock', variant: 'line' },
  'layers': { phosphorIconName: 'stack', variant: 'line' },
  'layers-selected': { phosphorIconName: 'stack', variant: 'line' },
  'layers-union': { phosphorIconName: 'stack', variant: 'line' },
  'layers-difference': { phosphorIconName: 'stack-minus', variant: 'line' },
  'blend-mode': { phosphorIconName: 'circles-four', variant: 'line' },
  'sparkles': { phosphorIconName: 'sparkle', variant: 'filled' },
  'light': { phosphorIconName: 'lightbulb', variant: 'filled' },
  'ruler': { phosphorIconName: 'ruler', variant: 'line' },
  'tone-curve': { phosphorIconName: 'chart-line', variant: 'line' },
  'select': { phosphorIconName: 'selection', variant: 'line' },
  'compare': { phosphorIconName: 'columns', variant: 'line' },
  'mask': { phosphorIconName: 'frame-corners', variant: 'line' },

  // Utility operations
  'transfer-out': { phosphorIconName: 'arrow-square-out', variant: 'line' },
};


/**
 * Cache for rendered icons
 * Key format: `${iconName}-${size}-${color}-${strokeWidth}`
 */
const iconCache = new Map<string, HTMLCanvasElement>();

/**
 * Cache for Phosphor icon path data. Key: `${registryKey}-${variant}`
 */
const pathDataCache = new Map<string, string[]>();

/**
 * Extracts path data from Phosphor icon nodes: [["path", {d}], ...].
 */
function getPhosphorIconPathData(phosphorIconName: string, variant: 'line' | 'filled'): string[] {
  try {
    const nodes = variant === 'filled' ? getPhosphorNodesFilled() : getPhosphorNodesOutline();
    const iconData = nodes[phosphorIconName];
    if (!iconData || !Array.isArray(iconData)) {
      return [];
    }
    return iconData
      .filter((node: unknown): node is ['path', { d: string }] =>
        Array.isArray(node) && node[0] === 'path' && typeof (node[1] as { d?: string })?.d === 'string')
      .map((node) => node[1].d);
  } catch {
    return [];
  }
}

function getCachedPathData(iconName: string, phosphorIconName: string, variant: 'line' | 'filled'): string[] {
  const cacheKey = `${iconName}-${variant}`;
  const cached = pathDataCache.get(cacheKey);
  if (cached) return cached;
  const pathData = getPhosphorIconPathData(phosphorIconName, variant);
  if (pathData.length > 0) pathDataCache.set(cacheKey, pathData);
  return pathData;
}

/** Phosphor path data is 256×256; we scale to size with origin at center. */
const PHOSPHOR_VIEW_SIZE = 256;

/**
 * Renders a Phosphor icon on canvas using path data (synchronous).
 */
function renderPhosphorIconOnCanvas(
  ctx: CanvasRenderingContext2D,
  phosphorIconName: string,
  iconName: string,
  x: number,
  y: number,
  size: number,
  color: string,
  variant: 'line' | 'filled',
  strokeWidth: number = 2
): void {
  const pathData = getCachedPathData(iconName, phosphorIconName, variant);

  if (pathData.length === 0) {
    ctx.save();
    ctx.translate(x, y);
    if (variant === 'filled') {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeWidth;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.3, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  ctx.save();
  ctx.translate(x, y);
  const scale = size / PHOSPHOR_VIEW_SIZE;
  ctx.scale(scale, scale);
  ctx.translate(-PHOSPHOR_VIEW_SIZE / 2, -PHOSPHOR_VIEW_SIZE / 2);

  // Phosphor path data is authored as filled shapes (fill="currentColor") in both
  // regular and fill weights; we always fill, never stroke, for correct appearance.
  ctx.fillStyle = color;
  for (const pathString of pathData) {
    const path = new Path2D(pathString);
    ctx.fill(path);
  }

  ctx.restore();
}

/**
 * Gets a cached icon canvas or creates one (synchronous)
 */
function getCachedIcon(
  iconName: string,
  size: number,
  color: string,
  variant: 'line' | 'filled',
  strokeWidth: number = 2
): HTMLCanvasElement {
  const cacheKey = `${iconName}-${size}-${color}-${variant}-${strokeWidth}`;
  
  if (iconCache.has(cacheKey)) {
    return iconCache.get(cacheKey)!;
  }
  
  // Create new canvas
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  
  // Get icon definition from registry
  const iconDef = iconRegistry[iconName];
  
  if (iconDef) {
    renderPhosphorIconOnCanvas(ctx, iconDef.phosphorIconName, iconName, size / 2, size / 2, size, color, iconDef.variant, strokeWidth);
  } else {
    // Fallback: draw placeholder
    if (variant === 'filled') {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size * 0.3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeWidth;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size * 0.3, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  
  iconCache.set(cacheKey, canvas);
  return canvas;
}

/**
 * Renders an icon on canvas using cached icons (synchronous).
 * Uses the centralized icon registry (phosphorIconName + variant).
 */
export function renderIconOnCanvas(
  ctx: CanvasRenderingContext2D,
  iconName: string,
  x: number,
  y: number,
  size: number,
  color: string,
  strokeWidth: number = 2
): void {
  // Get icon definition from centralized registry
  const iconDef = iconRegistry[iconName];
  if (!iconDef) {
    console.warn(`Icon "${iconName}" not found in icon registry. Add it to canvas-icons.ts`);
    // Fallback: draw placeholder circle
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = color;
    ctx.lineWidth = strokeWidth;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    return;
  }
  
  const cached = getCachedIcon(iconName, size, color, iconDef.variant, strokeWidth);
  ctx.drawImage(cached, x - size / 2, y - size / 2);
}

/**
 * Pre-caches icons for better performance
 * Call this during app initialization
 */
export function preloadIcons(
  iconNames: string[],
  sizes: number[] = [16, 24, 32, 36, 48],
  colors: string[] = ['#ffffff', '#000000']
): void {
  for (const iconName of iconNames) {
    const iconDef = iconRegistry[iconName];
    const variant = iconDef?.variant ?? 'line';
    for (const size of sizes) {
      for (const color of colors) {
        getCachedIcon(iconName, size, color, variant);
      }
    }
  }
}

/**
 * Clears the icon cache
 */
export function clearIconCache(): void {
  iconCache.clear();
  pathDataCache.clear();
}

/**
 * Gets the complete icon definition (phosphorIconName + variant) for a given icon name.
 */
export function getIconDefinition(iconName: string): IconDefinition | null {
  return iconRegistry[iconName] ?? null;
}

/**
 * Checks if an icon is in the registry (API preserved for callers).
 */
export function hasIcon(iconName: string): boolean {
  return iconName in iconRegistry;
}
