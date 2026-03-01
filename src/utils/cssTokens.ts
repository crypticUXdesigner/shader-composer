/**
 * Utility functions for reading CSS custom properties (CSS variables)
 * Used for canvas rendering and other places where CSS variables need to be accessed from JavaScript
 */

/**
 * Get a CSS custom property value from the root element
 * @param propertyName The CSS variable name (with or without -- prefix)
 * @param fallback Optional fallback value if the property is not found
 * @returns The computed value of the CSS variable
 */
export function getCSSVariable(propertyName: string, fallback?: string): string {
  const name = propertyName.startsWith('--') ? propertyName : `--${propertyName}`;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback || '';
}

/**
 * Get a CSS custom property value as a number
 * @param propertyName The CSS variable name (with or without -- prefix)
 * @param fallback Optional fallback value if the property is not found or cannot be parsed
 * @returns The numeric value of the CSS variable in pixels
 */
export function getCSSVariableAsNumber(propertyName: string, fallback: number = 0): number {
  const value = getCSSVariable(propertyName);
  if (!value) return fallback;
  
  // Handle rem units - convert to pixels
  if (value.endsWith('rem')) {
    const remValue = parseFloat(value);
    if (isNaN(remValue)) return fallback;
    // Get base font size from root element (defaults to 16px)
    const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    return remValue * rootFontSize;
  }
  
  // Handle px units
  if (value.endsWith('px')) {
    const pxValue = parseFloat(value);
    return isNaN(pxValue) ? fallback : pxValue;
  }
  
  // Handle unitless values or fallback to parsing numeric value
  const numericValue = parseFloat(value.replace(/[^\d.-]/g, ''));
  return isNaN(numericValue) ? fallback : numericValue;
}

/**
 * Parse a CSS color value (hex, rgb, rgba, or CSS variable)
 * @param value The color value to parse
 * @returns The parsed color as a hex string (e.g., "#FF0000")
 */
export function parseCSSColor(value: string): string {
  if (!value) return '#000000';
  
  // If it's already a hex color, return it
  if (value.startsWith('#')) {
    return value;
  }
  
  // If it's a CSS variable, resolve it
  if (value.startsWith('var(')) {
    const match = value.match(/var\((--[^)]+)\)/);
    if (match) {
      const resolved = getCSSVariable(match[1]);
      return parseCSSColor(resolved);
    }
  }
  
  // If it's rgb/rgba, convert to hex
  if (value.startsWith('rgb')) {
    const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
    if (match) {
      const r = parseInt(match[1], 10);
      const g = parseInt(match[2], 10);
      const b = parseInt(match[3], 10);
      return `#${[r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      }).join('')}`;
    }
  }
  
  // Fallback
  return value;
}

/**
 * Get a CSS color variable and parse it to a hex color
 * @param propertyName The CSS variable name (with or without -- prefix)
 * @param fallback Optional fallback color if the property is not found
 * @returns The color as a hex string
 */
export function getCSSColor(propertyName: string, fallback: string = '#000000'): string {
  const value = getCSSVariable(propertyName);
  if (!value) return fallback;
  return parseCSSColor(value);
}

/** Node IDs that are system inputs (Frag Coords, UV Coords, Resolution, Time). Used for sub-group styling. */
export const SYSTEM_INPUT_NODE_IDS = new Set([
  'uv-coordinates',
  'fragment-coordinates',
  'resolution',
  'time'
]);

/** Node IDs for structured patterns (rays, grids, gradients, waves — more prominent). Default = noise (muted). */
export const STRUCTURED_PATTERN_NODE_IDS = new Set([
  'rings',
  'spiral',
  'radial-rays',
  'sunbeams',
  'crepuscular-rays',
  'volume-rays',
  'streak',
  'gradient',
  'flow-field-pattern',
  'hexagonal-grid',
  'stripes',
  'dots',
  'triangle-grid',
  'wave-patterns'
]);

/** Node IDs for derived shapes / scenes & surfaces (more prominent). Default = primitive (muted). */
export const DERIVED_SHAPE_NODE_IDS = new Set([
  'fractal',
  'plane-grid',
  'sky-dome',
  'hex-voxel',
  'bloom-sphere',
  'bloom-sphere-effect',
  'iridescent-tunnel',
  'inflated-icosahedron',
  'glass-shell'
]);

/** Node IDs for the generic raymarcher in the SDF category (used for SDF sub-section styling). */
export const SDF_RAYMARCHER_NODE_IDS = new Set([
  'generic-raymarcher',
]);

/** Node IDs that span 2 columns in the node panel grid. Kept empty so no panel items (including device/audio) ever span 2. */
export const PANEL_GRID_SPAN_2_NODE_IDS = new Set<string>([]);

/** Node IDs for warp distortions (bulge, fisheye, displace, etc. — more prominent). Default = transform (muted). */
export const WARP_DISTORT_NODE_IDS = new Set([
  'bulge-pinch',
  'fisheye',
  'spherize',
  'ripple',
  'quad-warp',
  'twist-distortion',
  'vortex',
  'displace',
  'directional-displace',
  'vector-field',
  'turbulence'
]);

/** Node IDs for math functions (power, sqrt, rounding, comparison, interpolation — middle prominence). Default = arithmetic (muted). */
export const FUNCTIONS_MATH_NODE_IDS = new Set([
  'power',
  'square-root',
  'absolute',
  'floor',
  'ceil',
  'fract',
  'modulo',
  'min',
  'max',
  'clamp',
  'mix',
  'step',
  'smoothstep'
]);

/** Node IDs for advanced math (trigonometry, exponential, vector operations — more prominent). Default = arithmetic (muted). */
export const ADVANCED_MATH_NODE_IDS = new Set([
  'sine',
  'cosine',
  'tangent',
  'arc-sine',
  'arc-cosine',
  'arc-tangent',
  'arc-tangent-2',
  'exponential',
  'natural-logarithm',
  'length',
  'distance',
  'dot-product',
  'cross-product',
  'normalize',
  'reflect',
  'refract'
]);

/** Node IDs for effects stylize (chromatic aberration, RGB separation, scanlines, etc. — more prominent). Default = filter (muted). */
export const STYLIZE_EFFECTS_NODE_IDS = new Set([
  'chromatic-aberration',
  'rgb-separation',
  'scanlines',
  'color-grading',
  'bayer-dither',
  'tone-mapping',
  'blending-modes'
]);

/**
 * Whether a node is marked as visually \"shiny\" (recommended / especially interesting).
 * Category is included for future category-specific logic but is not required for the
 * initial implementation — IDs are currently unique across categories.
 */
export function isShinyNode(nodeId: string, _category: string): boolean {
  return SHINY_NODE_IDS.has(nodeId);
}

/**
 * Node IDs marked as "shiny" — highly recommended or especially interesting to try.
 * Shiny is a visual/discovery hint only; it does not affect behavior or data-model.
 * Initial set is curated from existing prominent sub-groups (derived shapes, raymarcher, hero patterns/warps, etc.).
 */
export const SHINY_NODE_IDS = new Set<string>([
  // Shapes / SDF scenes and surfaces
  'fractal',
  'sphere-raymarch',
  'hex-voxel',
  'bloom-sphere',
  'bloom-sphere-effect',
  'iridescent-tunnel',
  'inflated-icosahedron',
  'glass-shell',
  // SDF raymarcher
  'generic-raymarcher',
  // Patterns
  'flow-field-pattern',
  'hexagonal-grid',
  'wave-patterns',
  // Distort / warp
  'bulge-pinch',
  'fisheye',
  'displace',
  'vector-field',
]);

/** Canonical list of node categories that have per-category tokens (lowercase token suffix). */
const CATEGORY_TOKEN_SUFFIXES = new Set([
  'inputs',
  'patterns',
  'sdf',
  'shapes',
  'math',
  'utilities',
  'distort',
  'blend',
  'mask',
  'effects',
  'output',
  'audio'
]);

/**
 * Get the token suffix for a category (e.g. "Inputs" -> "inputs"). Unknown categories become "default".
 */
export function getCategoryTokenSuffix(category: string): string {
  const lower = (category ?? '').trim().toLowerCase();
  return CATEGORY_TOKEN_SUFFIXES.has(lower) ? lower : 'default';
}

/** Alias for class names on .node.{slug} */
export function getCategorySlug(category: string): string {
  return getCategoryTokenSuffix(category);
}

/** Whether a node is a system input (UV Coords, Time, Resolution, Frag Coords) for sub-group styling. */
export function isSystemInputNode(nodeId: string, category: string): boolean {
  return getCategorySlug(category) === 'inputs' && SYSTEM_INPUT_NODE_IDS.has(nodeId);
}

/** Whether a pattern node is in the structured sub-group (rays, grids, gradients, waves). */
export function isStructuredPatternNode(nodeId: string, category: string): boolean {
  return getCategorySlug(category) === 'patterns' && STRUCTURED_PATTERN_NODE_IDS.has(nodeId);
}

/** Whether a shape node is in the derived sub-group (fractal, environment, surface). */
export function isDerivedShapeNode(nodeId: string, category: string): boolean {
  return getCategorySlug(category) === 'shapes' && DERIVED_SHAPE_NODE_IDS.has(nodeId);
}

/** Whether a distort node is in the warp sub-group (bulge, fisheye, displace, etc.). */
export function isWarpDistortNode(nodeId: string, category: string): boolean {
  return getCategorySlug(category) === 'distort' && WARP_DISTORT_NODE_IDS.has(nodeId);
}

/** Whether a math node is in the functions sub-group (power, sqrt, rounding, comparison, interpolation). */
export function isFunctionsMathNode(nodeId: string, category: string): boolean {
  return getCategorySlug(category) === 'math' && FUNCTIONS_MATH_NODE_IDS.has(nodeId);
}

/** Whether a math node is in the advanced sub-group (trigonometry, exponential, vector operations). */
export function isAdvancedMathNode(nodeId: string, category: string): boolean {
  return getCategorySlug(category) === 'math' && ADVANCED_MATH_NODE_IDS.has(nodeId);
}

/** Whether an effects node is in the stylize sub-group (chromatic aberration, RGB separation, scanlines, etc.). */
export function isStylizeEffectsNode(nodeId: string, category: string): boolean {
  return getCategorySlug(category) === 'effects' && STYLIZE_EFFECTS_NODE_IDS.has(nodeId);
}

/** Whether an SDF node is the generic raymarcher (used for SDF sub-group styling). */
export function isSdfRaymarcherNode(nodeId: string, category: string): boolean {
  return getCategorySlug(category) === 'sdf' && SDF_RAYMARCHER_NODE_IDS.has(nodeId);
}

/**
 * Display order of subgroup slugs per category (category slug -> ordered subgroup slugs).
 * Used for node panel section badges so order is stable. '' = default (no named subgroup).
 */
export const CATEGORY_SUBGROUP_ORDER: Record<string, string[]> = {
  inputs: ['system-input', ''],
  patterns: ['structured', ''],
  sdf: ['raymarcher', ''],
  shapes: ['derived', ''],
  math: ['functions', 'advanced', ''],
  distort: ['warp', ''],
  effects: ['stylize', ''],
};

/** Human-readable labels for subgroup slugs. Used for node panel badge tooltips. */
export const SUBGROUP_DISPLAY_LABELS: Record<string, string> = {
  '': 'Default',
  'system-input': 'System inputs',
  structured: 'Structured',
  'raymarcher': 'Raymarcher',
  derived: 'Scenes & surfaces',
  functions: 'Functions',
  advanced: 'Advanced',
  warp: 'Warp',
  stylize: 'Stylize',
};

/**
 * Get the sub-group slug for timeline/panel styling (e.g. 'system-input', 'structured', 'warp').
 * Returns '' when the node has no sub-group. Used for data-subgroup and matching icon box colors.
 */
export function getSubGroupSlug(nodeId: string, category: string): string {
  if (isSdfRaymarcherNode(nodeId, category)) return 'raymarcher';
  if (isSystemInputNode(nodeId, category)) return 'system-input';
  if (isStructuredPatternNode(nodeId, category)) return 'structured';
  if (isDerivedShapeNode(nodeId, category)) return 'derived';
  if (isWarpDistortNode(nodeId, category)) return 'warp';
  if (isFunctionsMathNode(nodeId, category)) return 'functions';
  if (isAdvancedMathNode(nodeId, category)) return 'advanced';
  if (isStylizeEffectsNode(nodeId, category)) return 'stylize';
  return '';
}

/**
 * Get the per-category token name for a base token (e.g. "param-cell-bg", "Inputs" -> "param-cell-bg-inputs").
 */
export function getCategoryTokenName(baseTokenName: string, category: string): string {
  const base = baseTokenName.startsWith('--') ? baseTokenName.slice(2) : baseTokenName;
  const suffix = getCategoryTokenSuffix(category);
  return `${base}-${suffix}`;
}

/**
 * Get a color from a per-category token, falling back to the global token then to fallback.
 */
export function getCategoryColor(baseTokenName: string, category: string, fallback: string): string {
  const tokenName = getCategoryTokenName(baseTokenName, category);
  const globalFallback = getCSSColor(baseTokenName, fallback);
  return getCSSColor(tokenName, globalFallback);
}

/**
 * Get a numeric value from a per-category token, falling back to the global token then to fallback.
 */
export function getCategoryVariableAsNumber(baseTokenName: string, category: string, fallback: number): number {
  const tokenName = getCategoryTokenName(baseTokenName, category);
  const globalFallback = getCSSVariableAsNumber(baseTokenName, fallback);
  return getCSSVariableAsNumber(tokenName, globalFallback);
}

/**
 * Get a string value from a per-category token, falling back to the global token then to fallback.
 */
export function getCategoryVariable(baseTokenName: string, category: string, fallback: string): string {
  const tokenName = getCategoryTokenName(baseTokenName, category);
  const globalFallback = getCSSVariable(baseTokenName, fallback);
  return getCSSVariable(tokenName, globalFallback);
}

/**
 * Parse rgba color from CSS variable
 * @param propertyName The CSS variable name
 * @param fallback Optional fallback rgba value
 * @returns Object with r, g, b, a values (0-255 for rgb, 0-1 for alpha)
 */
export function getCSSColorRGBA(propertyName: string, fallback: { r: number; g: number; b: number; a: number } = { r: 0, g: 0, b: 0, a: 1 }): { r: number; g: number; b: number; a: number } {
  const value = getCSSVariable(propertyName);
  if (!value) return fallback;
  
  // Handle rgba() format
  const rgbaMatch = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (rgbaMatch) {
    return {
      r: parseInt(rgbaMatch[1], 10),
      g: parseInt(rgbaMatch[2], 10),
      b: parseInt(rgbaMatch[3], 10),
      a: rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1
    };
  }
  
  // Handle hex format (6-digit or 8-digit with alpha)
  const hex = parseCSSColor(value);
  if (hex.startsWith('#')) {
    if (hex.length === 9) {
      // 8-digit hex with alpha: #RRGGBBAA
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      const a = parseInt(hex.slice(7, 9), 16) / 255; // Convert 0-255 to 0-1
      return { r, g, b, a };
    } else if (hex.length === 7) {
      // 6-digit hex without alpha: #RRGGBB
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return { r, g, b, a: 1 };
    }
  }
  
  return fallback;
}
