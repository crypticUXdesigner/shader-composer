/**
 * Canvas Icon Renderer
 * 
 * Provides efficient SVG-to-canvas rendering with caching.
 * Uses Tabler Icons exclusively - all icons come from the Tabler library.
 * 
 * CENTRALIZED ICON DEFINITION SYSTEM:
 * - All icons are defined once here with their Tabler icon name AND variant (line/filled)
 * - This ensures consistent icon styling across DOM UI and Canvas UI
 * - To change an icon, update both the Tabler icon name and variant here
 * 
 * Browse available icons at: https://tabler.io/icons
 */

import { getTablerNodesOutline, getTablerNodesFilled } from './tabler-icons-loader';

/**
 * Icon definition: Tabler icon name + variant (line or filled)
 */
export interface IconDefinition {
  tablerIconName: string;
  variant: 'line' | 'filled';
}

/**
 * Centralized icon registry
 * 
 * Defines ALL icons used in the application with:
 * - tablerIconName: The Tabler icon name to use
 * - variant: 'line' (default) or 'filled' - the style variant to use
 * 
 * This is the SINGLE SOURCE OF TRUTH for icon definitions.
 * Both DOM UI and Canvas UI use this registry.
 */
export const iconRegistry: Record<string, IconDefinition> = {
  // Basic shapes
  'circle': { tablerIconName: 'circle', variant: 'filled' },
  'circle-dotted': { tablerIconName: 'circle-dotted', variant: 'line' },
  'square': { tablerIconName: 'square', variant: 'line' },
  'star': { tablerIconName: 'star', variant: 'line' },
  'square-rounded-corners': { tablerIconName: 'square-rounded-corners', variant: 'line' },
  'hexagon': { tablerIconName: 'hexagon', variant: 'line' },
  'sphere': { tablerIconName: 'sphere', variant: 'line' },
  'cube': { tablerIconName: 'cube', variant: 'filled' },
  'box': { tablerIconName: 'box', variant: 'line' },
  'cylinder': { tablerIconName: 'cylinder', variant: 'line' },
  'ring': { tablerIconName: 'ripple', variant: 'line' },
  'infinity': { tablerIconName: 'infinity', variant: 'line' },
  'sparkles-2': { tablerIconName: 'sparkles', variant: 'line' },
  
  // Patterns & grids
  'grid': { tablerIconName: 'grid-4x4', variant: 'line' },
  'dither': { tablerIconName: 'grid-pattern', variant: 'filled' },
  'grain': { tablerIconName: 'grain', variant: 'line' },
  'noise': { tablerIconName: 'grain', variant: 'line' },
  'particle': { tablerIconName: 'grain', variant: 'line' },
  'kaleidoscope': { tablerIconName: 'shapes', variant: 'line' },
  
  // Audio & waveforms
  'audio-waveform': { tablerIconName: 'wave-sine', variant: 'line' },
  'wave': { tablerIconName: 'ripple', variant: 'line' },
  'ripple': { tablerIconName: 'ripple', variant: 'line' },
  'trig-wave': { tablerIconName: 'wave-sine', variant: 'line' },
  
  // Math & operations
  'calculator': { tablerIconName: 'calculator', variant: 'line' },
  'plus': { tablerIconName: 'hexagon-plus', variant: 'filled' },
  'minus': { tablerIconName: 'hexagon-minus', variant: 'filled' },
  'multiply-x': { tablerIconName: 'hexagon-asterisk', variant: 'filled' },
  'divide': { tablerIconName: 'divide', variant: 'line' },
  'power': { tablerIconName: 'bolt', variant: 'line' },
  'sqrt': { tablerIconName: 'math-function', variant: 'line' },
  'constant': { tablerIconName: 'hash', variant: 'line' },
  'hash': { tablerIconName: 'hash', variant: 'line' },
  'percentage': { tablerIconName: 'percentage', variant: 'line' },
  'math-min': { tablerIconName: 'math-min', variant: 'line' },
  'math-max': { tablerIconName: 'math-max', variant: 'line' },
  'math-max-min': { tablerIconName: 'math-max-min', variant: 'line' },
  'math-cos': { tablerIconName: 'math-cos', variant: 'line' },
  'math-tg': { tablerIconName: 'math-tg', variant: 'line' },
  'math-function-y': { tablerIconName: 'math-function-y', variant: 'line' },
  'math-symbols': { tablerIconName: 'math-symbols', variant: 'line' },
  'math-xy': { tablerIconName: 'math-xy', variant: 'line' },
  'math-function': { tablerIconName: 'math-function', variant: 'line' },
  'wave-sine': { tablerIconName: 'wave-sine', variant: 'line' },
  
  // Vectors & geometry
  'arrow-right': { tablerIconName: 'arrow-right', variant: 'line' },
  'arrow-down': { tablerIconName: 'arrow-down', variant: 'line' },
  'arrow-up': { tablerIconName: 'arrow-up', variant: 'line' },
  'arrows-left-right': { tablerIconName: 'arrows-left-right', variant: 'line' },
  'arrows-right-left': { tablerIconName: 'arrows-right-left', variant: 'line' },
  'vector-dot': { tablerIconName: 'circle-dot', variant: 'filled' },
  'vector-cross': { tablerIconName: 'navigation', variant: 'line' },
  'normalize': { tablerIconName: 'arrows-up-down', variant: 'line' },
  'reflect': { tablerIconName: 'arrow-bounce-right', variant: 'line' },
  'refract': { tablerIconName: 'lens', variant: 'line' },
  'bezier': { tablerIconName: 'curve', variant: 'line' },
  'normal-map': { tablerIconName: 'background', variant: 'line' },
  
  // Transform & movement
  'move': { tablerIconName: 'arrows-move', variant: 'line' },
  'rotate': { tablerIconName: 'rotate-clockwise', variant: 'line' },
  'resize': { tablerIconName: 'maximize', variant: 'line' },
  'twist': { tablerIconName: 'gauge', variant: 'line' },
  'arrow-move-right': { tablerIconName: 'arrow-move-right', variant: 'line' },
  'arrow-autofit-height': { tablerIconName: 'arrow-autofit-height', variant: 'line' },
  'arrow-up-right': { tablerIconName: 'arrow-up-right', variant: 'line' },
  'arrow-big-right': { tablerIconName: 'arrow-big-right', variant: 'line' },
  'flip-horizontal': { tablerIconName: 'flip-horizontal', variant: 'line' },
  'zoom-in': { tablerIconName: 'zoom-in', variant: 'line' },
  'spiral': { tablerIconName: 'spiral', variant: 'line' },
  'ikosaedr': { tablerIconName: 'ikosaedr', variant: 'line' },
  
  // Effects & filters
  'blur-circle': { tablerIconName: 'blur', variant: 'line' },
  'glow': { tablerIconName: 'sun', variant: 'filled' },
  'scanline': { tablerIconName: 'scan', variant: 'line' },
  'rgb-split': { tablerIconName: 'color-swatch', variant: 'line' },
  'glitch-block': { tablerIconName: 'layout-grid', variant: 'filled' },
  'adjustments': { tablerIconName: 'adjustments', variant: 'line' },
  'focus': { tablerIconName: 'focus', variant: 'line' },
  'glitch': { tablerIconName: 'bolt', variant: 'line' },
  'displacement': { tablerIconName: 'arrows-move', variant: 'line' },
  'brightness': { tablerIconName: 'brightness', variant: 'line' },
  
  // Color & gradients
  'color-palette': { tablerIconName: 'palette', variant: 'line' },
  'color-wheel': { tablerIconName: 'color-picker', variant: 'filled' },
  'color-picker': { tablerIconName: 'color-picker', variant: 'line' },
  'color-swatch': { tablerIconName: 'color-swatch', variant: 'line' },
  'gradient': { tablerIconName: 'filter', variant: 'line' },
  'ease-in-out-control-points': { tablerIconName: 'ease-in-out-control-points', variant: 'line' },
  
  // Coordinates - LINE style to match canvas
  'chart-scatter': { tablerIconName: 'chart-scatter', variant: 'line' },
  'chart-scatter-3d': { tablerIconName: 'chart-scatter-3d', variant: 'line' },
  
  // Special icons
  'brand-planetscale': { tablerIconName: 'brand-planetscale', variant: 'filled' },
  'screen-share': { tablerIconName: 'screen-share', variant: 'line' },
  'contrast-2': { tablerIconName: 'contrast-2', variant: 'line' },
  
  // UI & controls
  'settings': { tablerIconName: 'settings', variant: 'line' },
  'settings-2': { tablerIconName: 'settings-2', variant: 'line' },
  'monitor': { tablerIconName: 'device-desktop', variant: 'line' },
  'time-clock': { tablerIconName: 'clock', variant: 'line' },
  'layers': { tablerIconName: 'layers', variant: 'line' },
  'layers-selected': { tablerIconName: 'layers-selected', variant: 'line' },
  'layers-union': { tablerIconName: 'layers-union', variant: 'line' },
  'layers-difference': { tablerIconName: 'layers-difference', variant: 'line' },
  'blend-mode': { tablerIconName: 'blend-mode', variant: 'line' },
  'sparkles': { tablerIconName: 'sparkles', variant: 'filled' },
  'light': { tablerIconName: 'bulb', variant: 'filled' },
  'ruler': { tablerIconName: 'ruler', variant: 'line' },
  'tone-curve': { tablerIconName: 'chart-line', variant: 'line' },
  'select': { tablerIconName: 'toggle-left', variant: 'line' },
  'compare': { tablerIconName: 'arrows-left-right', variant: 'line' },
  'mask': { tablerIconName: 'mask', variant: 'line' },
  
  // Utility operations
  'transfer-out': { tablerIconName: 'transfer-out', variant: 'line' },
};


/**
 * Cache for rendered icons
 * Key format: `${iconName}-${size}-${color}-${strokeWidth}`
 */
const iconCache = new Map<string, HTMLCanvasElement>();

/**
 * Cache for Tabler icon path data
 * Key: icon name
 */
const pathDataCache = new Map<string, string[]>();

/**
 * Extracts path data from Tabler icon nodes
 */
function getTablerIconPathData(tablerIconName: string, variant: 'line' | 'filled'): string[] {
  try {
    const tablerNodes = variant === 'filled' ? getTablerNodesFilled() : getTablerNodesOutline();
    const iconData = tablerNodes[tablerIconName];
    if (!iconData || !Array.isArray(iconData)) {
      return [];
    }
    
    // Extract path data from the node format: [["path", {d: "..."}], ...]
    return iconData
      .filter((node: any) => Array.isArray(node) && node[0] === 'path' && node[1]?.d)
      .map((node: any) => node[1].d);
  } catch (e) {
    return [];
  }
}

/**
 * Gets cached path data for a Tabler icon
 */
function getCachedPathData(iconName: string, tablerIconName: string, variant: 'line' | 'filled'): string[] {
  const cacheKey = `${iconName}-${variant}`;
  if (pathDataCache.has(cacheKey)) {
    return pathDataCache.get(cacheKey)!;
  }
  
  const pathData = getTablerIconPathData(tablerIconName, variant);
  if (pathData.length > 0) {
    pathDataCache.set(cacheKey, pathData);
  }
  return pathData;
}

/**
 * Renders a Tabler icon on canvas using path data (synchronous)
 * If path data is not available, renders a simple placeholder
 */
function renderTablerIconOnCanvas(
  ctx: CanvasRenderingContext2D,
  tablerIconName: string,
  iconName: string,
  x: number,
  y: number,
  size: number,
  color: string,
  variant: 'line' | 'filled',
  strokeWidth: number = 2
): void {
  const pathData = getCachedPathData(iconName, tablerIconName, variant);
  
  if (pathData.length === 0) {
    // If no path data available, draw a simple placeholder circle
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
  
  // Render using path data directly (more efficient)
  ctx.save();
  ctx.translate(x, y);
  const scale = size / 24; // Tabler icons are 24x24
  ctx.scale(scale, scale);
  ctx.translate(-12, -12);
  
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = strokeWidth / scale; // Adjust line width for scale
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  pathData.forEach((pathString) => {
    const path = new Path2D(pathString);
    if (variant === 'filled') {
      ctx.fill(path);
    } else {
      ctx.stroke(path);
    }
  });
  
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
    // Render Tabler icon with correct variant
    renderTablerIconOnCanvas(ctx, iconDef.tablerIconName, iconName, size / 2, size / 2, size, color, iconDef.variant, strokeWidth);
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
 * Renders an icon on canvas using cached icons (synchronous)
 * This is the main entry point for rendering icons
 * Uses the centralized icon registry to get both Tabler icon name and variant
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
 * Gets the Tabler icon name for a given icon name (if available)
 * @deprecated Use getIconDefinition instead
 */
export function getTablerIcon(iconName: string): string | null {
  const def = iconRegistry[iconName];
  return def ? def.tablerIconName : null;
}

/**
 * Gets the complete icon definition (Tabler icon name + variant) for a given icon name
 */
export function getIconDefinition(iconName: string): IconDefinition | null {
  return iconRegistry[iconName] || null;
}

/**
 * Checks if an icon has a Tabler equivalent
 */
export function hasTablerIcon(iconName: string): boolean {
  return iconName in iconRegistry;
}
