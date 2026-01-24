// Icon utility helper
// Provides a simple way to render Lucide icons as SVG elements

import { createElement } from 'lucide';
import { 
  GripVertical, 
  X, 
  RotateCw, 
  Plus, 
  Sparkles,
  Eye,
  EyeOff,
  Power,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Maximize2,
  Minimize2,
  Play,
  Pause
} from 'lucide';

export type IconName = 
  | 'grip-vertical'
  | 'x'
  | 'rotate-cw'
  | 'plus'
  | 'sparkles'
  | 'eye'
  | 'eye-off'
  | 'power'
  | 'chevron-down'
  | 'chevron-right'
  | 'chevron-left'
  | 'maximize-2'
  | 'minimize-2'
  | 'play'
  | 'pause';

const iconMap: Record<IconName, any> = {
  'grip-vertical': GripVertical,
  'x': X,
  'rotate-cw': RotateCw,
  'plus': Plus,
  'sparkles': Sparkles,
  'eye': Eye,
  'eye-off': EyeOff,
  'power': Power,
  'chevron-down': ChevronDown,
  'chevron-right': ChevronRight,
  'chevron-left': ChevronLeft,
  'maximize-2': Maximize2,
  'minimize-2': Minimize2,
  'play': Play,
  'pause': Pause,
};

/**
 * Creates an icon element that can be inserted into DOM
 * @param name Icon name
 * @param size Icon size in pixels (default: 16)
 * @param color Icon color (default: currentColor)
 * @param className Optional CSS class name
 * @returns SVG element
 */
export function createIconElement(
  name: IconName,
  size: number = 16,
  color: string = 'currentColor',
  className?: string
): SVGElement {
  const IconComponent = iconMap[name];
  if (!IconComponent) {
    throw new Error(`Unknown icon: ${name}`);
  }

  // Use Lucide's createElement to create the icon
  const iconElement = createElement(IconComponent, {
    size: size,
    color: color,
    ...(className ? { class: className } : {}),
    'stroke-width': 2,
  });

  // Ensure SVG has explicit width and height attributes and proper styling
  if (!iconElement.getAttribute('width')) {
    iconElement.setAttribute('width', String(size));
  }
  if (!iconElement.getAttribute('height')) {
    iconElement.setAttribute('height', String(size));
  }
  if (!iconElement.getAttribute('viewBox')) {
    iconElement.setAttribute('viewBox', '0 0 24 24');
  }
  
  // Set inline styles to ensure visibility
  iconElement.style.width = `${size}px`;
  iconElement.style.height = `${size}px`;
  iconElement.style.display = 'block';
  iconElement.style.flexShrink = '0';
  iconElement.style.verticalAlign = 'middle';
  iconElement.style.pointerEvents = 'none'; // Allow clicks to pass through to parent button

  return iconElement;
}

/**
 * Icon identifiers for node categories and node-specific icons
 */
export type NodeIconIdentifier = 
  | 'audio-waveform'
  | 'grid'
  | 'circle'
  | 'calculator'
  | 'settings'
  | 'move'
  | 'layers'
  | 'square'
  | 'sparkles'
  | 'monitor'
  | 'time-clock'
  | 'wave'
  | 'sphere'
  | 'noise'
  | 'hexagon'
  | 'ring'
  | 'rotate'
  | 'blur-circle'
  | 'glow'
  | 'kaleidoscope'
  | 'twist'
  | 'particle'
  | 'gradient'
  | 'rgb-split'
  | 'scanline'
  | 'glitch-block'
  | 'plus'
  | 'minus'
  | 'multiply-x'
  | 'divide'
  | 'power'
  | 'sqrt'
  | 'trig-wave'
  | 'arrow-right'
  | 'resize'
  | 'ruler'
  | 'vector-dot'
  | 'vector-cross'
  | 'normalize'
  | 'reflect'
  | 'refract'
  | 'constant'
  | 'bezier'
  | 'color-palette'
  | 'normal-map'
  | 'light'
  | 'dither'
  | 'tone-curve'
  | 'compare'
  | 'select'
  | 'color-wheel';

/**
 * Gets a CSS custom property value as a number (for ratios) or string
 * @param propertyName CSS custom property name (e.g., '--icon-stroke-width')
 * @param fallback Fallback value if property is not found
 * @returns Parsed numeric value or fallback
 */
function getIconToken(propertyName: string, fallback: number): number {
  if (typeof document === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(propertyName)
    .trim();
  if (!value) return fallback;
  
  // Remove 'px' suffix if present and parse as number
  const numValue = parseFloat(value.replace('px', ''));
  return isNaN(numValue) ? fallback : numValue;
}

/**
 * Gets icon style tokens from CSS custom properties
 * Returns standardized ratios and values for consistent icon rendering
 */
function getIconStyle(size: number) {
  // Get numeric ratios from CSS tokens (these are unitless ratios)
  const ratios = {
    base: getIconToken('--icon-size-base', 1),
    large: getIconToken('--icon-size-large', 0.9),
    medium: getIconToken('--icon-size-medium', 0.8),
    small: getIconToken('--icon-size-small', 0.6),
    tiny: getIconToken('--icon-size-tiny', 0.4),
    half: getIconToken('--icon-spacing-half', 0.5),
    quarter: getIconToken('--icon-spacing-quarter', 0.25),
    eighth: getIconToken('--icon-spacing-eighth', 0.125),
    primary: getIconToken('--icon-element-primary', 0.8),
    secondary: getIconToken('--icon-element-secondary', 0.6),
    tertiary: getIconToken('--icon-element-tertiary', 0.4),
    accent: getIconToken('--icon-element-accent', 0.3),
    gridSpacing: getIconToken('--icon-grid-spacing', 0.25),
    arrowSize: getIconToken('--icon-arrow-size', 0.5),
    arrowWidth: getIconToken('--icon-arrow-width', 0.3),
    circleOuter: getIconToken('--icon-circle-outer', 0.8),
    circleInner: getIconToken('--icon-circle-inner', 0.5),
    circleCenter: getIconToken('--icon-circle-center', 0.3),
    lineLength: getIconToken('--icon-line-length', 0.7),
    lineOffset: getIconToken('--icon-line-offset', 0.15),
  };

  // Get stroke width (in pixels)
  const strokeWidth = getIconToken('--icon-stroke-width', 2);
  
  return {
    size,
    halfSize: size * ratios.half,
    quarterSize: size * ratios.quarter,
    eighthSize: size * ratios.eighth,
    strokeWidth,
    ratios,
    // Computed sizes for convenience
    primary: size * ratios.primary,
    secondary: size * ratios.secondary,
    tertiary: size * ratios.tertiary,
    accent: size * ratios.accent,
    large: size * ratios.large,
    medium: size * ratios.medium,
    small: size * ratios.small,
    tiny: size * ratios.tiny,
  };
}

/**
 * Renders an icon on a canvas context
 * @param ctx Canvas rendering context
 * @param iconName Icon identifier
 * @param x Center X position
 * @param y Center Y position
 * @param size Icon size in pixels
 * @param color Icon color
 */
export function renderIconOnCanvas(
  ctx: CanvasRenderingContext2D,
  iconName: NodeIconIdentifier | string,
  x: number,
  y: number,
  size: number,
  color: string
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  
  const style = getIconStyle(size);
  ctx.lineWidth = style.strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  const { halfSize, quarterSize, ratios } = style;
  
  switch (iconName) {
    case 'audio-waveform':
      // Draw waveform pattern
      ctx.beginPath();
      ctx.moveTo(-halfSize * ratios.small, 0);
      ctx.lineTo(-halfSize * ratios.tertiary, -quarterSize);
      ctx.lineTo(0, quarterSize * ratios.half);
      ctx.lineTo(halfSize * ratios.tertiary, -quarterSize * ratios.half);
      ctx.lineTo(halfSize * ratios.small, quarterSize);
      ctx.stroke();
      break;
      
    case 'grid':
      // Draw grid pattern
      const gridSpacing = size * ratios.gridSpacing;
      ctx.beginPath();
      for (let i = -halfSize; i <= halfSize; i += gridSpacing) {
        ctx.moveTo(i, -halfSize);
        ctx.lineTo(i, halfSize);
        ctx.moveTo(-halfSize, i);
        ctx.lineTo(halfSize, i);
      }
      ctx.stroke();
      break;
      
    case 'circle':
      // Draw circle
      ctx.beginPath();
      ctx.arc(0, 0, halfSize * ratios.primary, 0, Math.PI * 2);
      ctx.stroke();
      break;
      
    case 'calculator':
      // Draw calculator (rectangle with buttons)
      const calcSize = size * ratios.secondary;
      ctx.strokeRect(-calcSize * ratios.half, -calcSize * ratios.half, calcSize, calcSize);
      // Draw button grid
      const btnSize = size / 6;
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          ctx.fillRect(
            -calcSize * ratios.half + btnSize * (col + ratios.half),
            -calcSize * ratios.half + btnSize * (row + ratios.half),
            btnSize * ratios.small,
            btnSize * ratios.small
          );
        }
      }
      break;
      
    case 'settings':
      // Draw gear icon
      ctx.beginPath();
      const gearRadius = halfSize * ratios.secondary;
      const teeth = 8;
      for (let i = 0; i < teeth * 2; i++) {
        const angle = (i * Math.PI) / teeth;
        const radius = i % 2 === 0 ? gearRadius : gearRadius * ratios.secondary;
        const px = Math.cos(angle) * radius;
        const py = Math.sin(angle) * radius;
        if (i === 0) {
          ctx.moveTo(px, py);
        } else {
          ctx.lineTo(px, py);
        }
      }
      ctx.closePath();
      ctx.stroke();
      // Inner circle
      ctx.beginPath();
      ctx.arc(0, 0, gearRadius * ratios.tertiary, 0, Math.PI * 2);
      ctx.stroke();
      break;
      
    case 'move':
      // Draw move arrows (4-directional)
      const arrowSize = halfSize * ratios.arrowSize;
      ctx.beginPath();
      // Up
      ctx.moveTo(0, -halfSize);
      ctx.lineTo(-arrowSize * ratios.half, -halfSize + arrowSize);
      ctx.lineTo(arrowSize * ratios.half, -halfSize + arrowSize);
      ctx.closePath();
      ctx.fill();
      // Down
      ctx.beginPath();
      ctx.moveTo(0, halfSize);
      ctx.lineTo(-arrowSize * ratios.half, halfSize - arrowSize);
      ctx.lineTo(arrowSize * ratios.half, halfSize - arrowSize);
      ctx.closePath();
      ctx.fill();
      // Left
      ctx.beginPath();
      ctx.moveTo(-halfSize, 0);
      ctx.lineTo(-halfSize + arrowSize, -arrowSize * ratios.half);
      ctx.lineTo(-halfSize + arrowSize, arrowSize * ratios.half);
      ctx.closePath();
      ctx.fill();
      // Right
      ctx.beginPath();
      ctx.moveTo(halfSize, 0);
      ctx.lineTo(halfSize - arrowSize, -arrowSize * ratios.half);
      ctx.lineTo(halfSize - arrowSize, arrowSize * ratios.half);
      ctx.closePath();
      ctx.fill();
      break;
      
    case 'layers':
      // Draw stacked layers
      const layerSize = size * ratios.secondary;
      const layerHeight = size * ratios.half;
      for (let i = 0; i < 3; i++) {
        const offset = i * 2;
        ctx.strokeRect(
          -layerSize * ratios.half + offset,
          -layerHeight * ratios.half + offset,
          layerSize,
          layerHeight
        );
      }
      break;
      
    case 'square':
      // Draw square
      const squareSize = size * ratios.primary;
      ctx.strokeRect(-squareSize * ratios.half, -squareSize * ratios.half, squareSize, squareSize);
      break;
      
    case 'sparkles':
      // Draw sparkle pattern
      const sparkleSize = halfSize * ratios.small;
      for (let i = 0; i < 4; i++) {
        const angle = (i * Math.PI) / 2;
        const px = Math.cos(angle) * sparkleSize;
        const py = Math.sin(angle) * sparkleSize;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px * ratios.half, py * ratios.half);
        ctx.moveTo(px, py);
        ctx.lineTo(px * 1.2, py * 1.2);
        ctx.stroke();
      }
      // Center circle
      ctx.beginPath();
      ctx.arc(0, 0, sparkleSize * ratios.tertiary, 0, Math.PI * 2);
      ctx.fill();
      break;
      
    case 'monitor':
      // Draw monitor/screen
      const monitorWidth = size * ratios.secondary;
      const monitorHeight = size * ratios.small;
      ctx.strokeRect(-monitorWidth * ratios.half, -monitorHeight * ratios.half, monitorWidth, monitorHeight);
      // Stand
      ctx.beginPath();
      ctx.moveTo(-halfSize * ratios.tertiary, monitorHeight * ratios.half);
      ctx.lineTo(halfSize * ratios.tertiary, monitorHeight * ratios.half);
      ctx.lineTo(halfSize * ratios.half, halfSize * ratios.primary);
      ctx.lineTo(-halfSize * ratios.half, halfSize * ratios.primary);
      ctx.closePath();
      ctx.stroke();
      break;
      
    case 'time-clock':
      // Draw clock
      ctx.beginPath();
      ctx.arc(0, 0, halfSize * ratios.primary, 0, Math.PI * 2);
      ctx.stroke();
      // Hour hand
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -halfSize * ratios.tertiary);
      ctx.stroke();
      // Minute hand
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(halfSize * ratios.tertiary, -halfSize * ratios.tertiary);
      ctx.stroke();
      // Center dot
      ctx.beginPath();
      ctx.arc(0, 0, style.strokeWidth, 0, Math.PI * 2);
      ctx.fill();
      break;
      
    case 'wave':
      // Draw sine wave
      ctx.beginPath();
      const waveLength = size * ratios.primary;
      const waveHeight = halfSize * ratios.half;
      const steps = 20;
      for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * Math.PI * 2;
        const px = (i / steps - ratios.half) * waveLength;
        const py = Math.sin(t) * waveHeight;
        if (i === 0) {
          ctx.moveTo(px, py);
        } else {
          ctx.lineTo(px, py);
        }
      }
      ctx.stroke();
      break;
      
    case 'sphere':
      // Draw 3D sphere with shading
      ctx.beginPath();
      ctx.arc(0, 0, halfSize * ratios.primary, 0, Math.PI * 2);
      ctx.stroke();
      // Highlight circle
      ctx.beginPath();
      ctx.arc(-quarterSize * ratios.half, -quarterSize * ratios.half, quarterSize * ratios.small, 0, Math.PI * 2);
      ctx.fill();
      break;
      
    case 'noise':
      // Draw noise pattern (random dots)
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        const radius = halfSize * (ratios.tertiary + (i % 3) * ratios.eighth);
        const px = Math.cos(angle) * radius;
        const py = Math.sin(angle) * radius;
        ctx.beginPath();
        ctx.arc(px, py, style.strokeWidth * ratios.half, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
      
    case 'hexagon':
      // Draw hexagon
      ctx.beginPath();
      const hexRadius = halfSize * ratios.secondary;
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3;
        const px = Math.cos(angle) * hexRadius;
        const py = Math.sin(angle) * hexRadius;
        if (i === 0) {
          ctx.moveTo(px, py);
        } else {
          ctx.lineTo(px, py);
        }
      }
      ctx.closePath();
      ctx.stroke();
      break;
      
    case 'ring':
      // Draw concentric rings
      for (let i = 0; i < 3; i++) {
        const radius = halfSize * (ratios.tertiary + i * ratios.eighth);
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
      
    case 'rotate':
      // Draw rotation arrow (circular arrow)
      const rotateRadius = halfSize * ratios.small;
      ctx.beginPath();
      ctx.arc(0, 0, rotateRadius, -Math.PI * 0.3, Math.PI * 1.3);
      ctx.stroke();
      // Arrow head
      ctx.beginPath();
      ctx.moveTo(halfSize * ratios.tertiary, -halfSize * ratios.tertiary);
      ctx.lineTo(halfSize * ratios.small, -halfSize * ratios.eighth);
      ctx.lineTo(halfSize * ratios.tertiary, -halfSize * ratios.eighth);
      ctx.lineTo(halfSize * ratios.tertiary, -halfSize * ratios.eighth * 0.5);
      ctx.lineTo(halfSize * ratios.eighth, -halfSize * ratios.eighth * 0.5);
      ctx.lineTo(halfSize * ratios.eighth, -halfSize * ratios.tertiary);
      ctx.closePath();
      ctx.fill();
      break;
      
    case 'blur-circle':
      // Draw blurred circle (multiple overlapping circles)
      for (let i = 0; i < 3; i++) {
        const offset = i * 1.5;
        ctx.beginPath();
        ctx.arc(offset, 0, halfSize * (ratios.half - i * ratios.eighth), 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
      
    case 'glow':
      // Draw glow effect (radiating lines)
      const glowRadius = halfSize * ratios.tertiary;
      ctx.beginPath();
      ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
      ctx.fill();
      // Radiating lines
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4;
        ctx.beginPath();
        ctx.moveTo(
          Math.cos(angle) * glowRadius,
          Math.sin(angle) * glowRadius
        );
        ctx.lineTo(
          Math.cos(angle) * halfSize * ratios.primary,
          Math.sin(angle) * halfSize * ratios.primary
        );
        ctx.stroke();
      }
      break;
      
    case 'kaleidoscope':
      // Draw kaleidoscope pattern (mirrored triangles)
      ctx.beginPath();
      // Triangle 1
      ctx.moveTo(0, -halfSize * ratios.secondary);
      ctx.lineTo(-halfSize * ratios.small, halfSize * ratios.tertiary);
      ctx.lineTo(halfSize * ratios.small, halfSize * ratios.tertiary);
      ctx.closePath();
      ctx.stroke();
      // Triangle 2 (mirrored)
      ctx.beginPath();
      ctx.moveTo(0, halfSize * ratios.secondary);
      ctx.lineTo(-halfSize * ratios.small, -halfSize * ratios.tertiary);
      ctx.lineTo(halfSize * ratios.small, -halfSize * ratios.tertiary);
      ctx.closePath();
      ctx.stroke();
      break;
      
    case 'twist':
      // Draw twist/spiral
      ctx.beginPath();
      const spiralRadius = halfSize * ratios.primary;
      for (let i = 0; i <= 30; i++) {
        const t = (i / 30) * Math.PI * 4;
        const radius = (i / 30) * spiralRadius;
        const px = Math.cos(t) * radius;
        const py = Math.sin(t) * radius;
        if (i === 0) {
          ctx.moveTo(px, py);
        } else {
          ctx.lineTo(px, py);
        }
      }
      ctx.stroke();
      break;
      
    case 'particle':
      // Draw particle system (multiple small circles)
      const particleRadius = halfSize * ratios.half;
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        const px = Math.cos(angle) * particleRadius;
        const py = Math.sin(angle) * particleRadius;
        ctx.beginPath();
        ctx.arc(px, py, style.strokeWidth, 0, Math.PI * 2);
        ctx.fill();
      }
      // Center particle
      ctx.beginPath();
      ctx.arc(0, 0, style.strokeWidth * 1.25, 0, Math.PI * 2);
      ctx.fill();
      break;
      
    case 'gradient':
      // Draw gradient (horizontal bars)
      for (let i = 0; i < 4; i++) {
        const y = -halfSize + (i / 3) * size;
        ctx.beginPath();
        ctx.moveTo(-halfSize, y);
        ctx.lineTo(halfSize, y);
        ctx.stroke();
      }
      break;
      
    case 'rgb-split':
      // Draw RGB separation (three offset rectangles)
      const rgbSize = size * ratios.half;
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
      ctx.strokeRect(-halfSize * ratios.small, -halfSize * ratios.half, rgbSize, rgbSize);
      ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
      ctx.strokeRect(-halfSize * ratios.tertiary, -halfSize * ratios.half, rgbSize, rgbSize);
      ctx.strokeStyle = 'rgba(0, 0, 255, 0.5)';
      ctx.strokeRect(0, -halfSize * ratios.half, rgbSize, rgbSize);
      ctx.strokeStyle = color; // Reset to original color
      break;
      
    case 'scanline':
      // Draw scanlines (horizontal lines)
      for (let i = -1; i <= 1; i++) {
        const y = i * quarterSize;
        ctx.beginPath();
        ctx.moveTo(-halfSize, y);
        ctx.lineTo(halfSize, y);
        ctx.stroke();
      }
      break;
      
    case 'glitch-block':
      // Draw glitch blocks (offset rectangles)
      const blockSize = quarterSize * 2;
      ctx.strokeRect(-halfSize * ratios.small, -halfSize * ratios.small, blockSize, blockSize);
      ctx.strokeRect(-halfSize * ratios.eighth, -halfSize * ratios.tertiary, blockSize, blockSize);
      ctx.strokeRect(halfSize * ratios.eighth, -halfSize * ratios.secondary, blockSize, blockSize);
      break;
      
    case 'plus':
      // Draw plus sign
      const plusLength = halfSize * ratios.small;
      ctx.beginPath();
      ctx.moveTo(0, -plusLength);
      ctx.lineTo(0, plusLength);
      ctx.moveTo(-plusLength, 0);
      ctx.lineTo(plusLength, 0);
      ctx.stroke();
      break;
      
    case 'minus':
      // Draw minus sign
      const minusLength = halfSize * ratios.small;
      ctx.beginPath();
      ctx.moveTo(-minusLength, 0);
      ctx.lineTo(minusLength, 0);
      ctx.stroke();
      break;
      
    case 'multiply-x':
      // Draw X/multiply symbol
      const xSize = halfSize * ratios.small;
      ctx.beginPath();
      ctx.moveTo(-xSize, -xSize);
      ctx.lineTo(xSize, xSize);
      ctx.moveTo(xSize, -xSize);
      ctx.lineTo(-xSize, xSize);
      ctx.stroke();
      break;
      
    case 'divide':
      // Draw division symbol (÷)
      const divLength = halfSize * ratios.small;
      ctx.beginPath();
      ctx.moveTo(-divLength, 0);
      ctx.lineTo(divLength, 0);
      ctx.stroke();
      // Dots
      ctx.beginPath();
      ctx.arc(-halfSize * ratios.tertiary, -halfSize * ratios.tertiary, style.strokeWidth * ratios.half, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(halfSize * ratios.tertiary, halfSize * ratios.tertiary, style.strokeWidth * ratios.half, 0, Math.PI * 2);
      ctx.fill();
      break;
      
    case 'power':
      // Draw power/exponent symbol (x^y)
      ctx.beginPath();
      ctx.moveTo(-halfSize * ratios.half, halfSize * ratios.tertiary);
      ctx.lineTo(0, -halfSize * ratios.small);
      ctx.lineTo(halfSize * ratios.half, halfSize * ratios.tertiary);
      ctx.stroke();
      break;
      
    case 'sqrt':
      // Draw square root symbol (√)
      ctx.beginPath();
      ctx.moveTo(-halfSize * ratios.tertiary, -halfSize * ratios.half);
      ctx.lineTo(-halfSize * ratios.eighth, -halfSize * ratios.eighth);
      ctx.lineTo(0, halfSize * ratios.tertiary);
      ctx.lineTo(halfSize * ratios.half, -halfSize * ratios.tertiary);
      ctx.stroke();
      // Horizontal line
      ctx.beginPath();
      ctx.moveTo(halfSize * ratios.half, -halfSize * ratios.tertiary);
      ctx.lineTo(halfSize * ratios.secondary, -halfSize * ratios.tertiary);
      ctx.stroke();
      break;
      
    case 'trig-wave':
      // Draw sine wave for trigonometry
      ctx.beginPath();
      const trigWaveLength = size * ratios.primary;
      const trigWaveHeight = halfSize * ratios.tertiary;
      const trigSteps = 16;
      for (let i = 0; i <= trigSteps; i++) {
        const t = (i / trigSteps) * Math.PI * 2;
        const px = (i / trigSteps - ratios.half) * trigWaveLength;
        const py = Math.sin(t) * trigWaveHeight;
        if (i === 0) {
          ctx.moveTo(px, py);
        } else {
          ctx.lineTo(px, py);
        }
      }
      ctx.stroke();
      break;
      
    case 'arrow-right':
      // Draw right arrow for translate
      const arrowLength = halfSize * ratios.lineLength;
      ctx.beginPath();
      ctx.moveTo(-arrowLength, 0);
      ctx.lineTo(halfSize * ratios.tertiary, 0);
      ctx.stroke();
      // Arrow head
      ctx.beginPath();
      ctx.moveTo(halfSize * ratios.tertiary, 0);
      ctx.lineTo(halfSize * ratios.eighth, -quarterSize * ratios.small);
      ctx.lineTo(halfSize * ratios.eighth, quarterSize * ratios.small);
      ctx.closePath();
      ctx.fill();
      break;
      
    case 'resize':
      // Draw resize/scale icon (corner arrows)
      ctx.beginPath();
      // Top-left corner
      ctx.moveTo(-halfSize * ratios.small, -halfSize * ratios.tertiary);
      ctx.lineTo(-halfSize * ratios.primary, -halfSize * ratios.tertiary);
      ctx.moveTo(-halfSize * ratios.small, -halfSize * ratios.tertiary);
      ctx.lineTo(-halfSize * ratios.small, -halfSize * ratios.half);
      // Bottom-right corner
      ctx.moveTo(halfSize * ratios.small, halfSize * ratios.tertiary);
      ctx.lineTo(halfSize * ratios.primary, halfSize * ratios.tertiary);
      ctx.moveTo(halfSize * ratios.small, halfSize * ratios.tertiary);
      ctx.lineTo(halfSize * ratios.small, halfSize * ratios.half);
      ctx.stroke();
      break;
      
    case 'ruler':
      // Draw ruler/measure icon
      const rulerWidth = size * ratios.secondary;
      const rulerHeight = quarterSize * ratios.half;
      ctx.strokeRect(-rulerWidth * ratios.half, -quarterSize, rulerWidth, rulerHeight);
      // Tick marks
      for (let i = 0; i < 5; i++) {
        const x = -rulerWidth * ratios.half + (i / 4) * rulerWidth;
        ctx.beginPath();
        ctx.moveTo(x, -quarterSize);
        ctx.lineTo(x, -quarterSize * ratios.secondary);
        ctx.stroke();
      }
      break;
      
    case 'vector-dot':
      // Draw dot product (two vectors with dot)
      ctx.beginPath();
      ctx.moveTo(-halfSize * ratios.small, -halfSize * ratios.tertiary);
      ctx.lineTo(0, 0);
      ctx.moveTo(0, 0);
      ctx.lineTo(halfSize * ratios.small, halfSize * ratios.tertiary);
      ctx.stroke();
      // Dot at center
      ctx.beginPath();
      ctx.arc(0, 0, style.strokeWidth * 1.25, 0, Math.PI * 2);
      ctx.fill();
      break;
      
    case 'vector-cross':
      // Draw cross product (X with arrow)
      const crossSize = halfSize * ratios.half;
      ctx.beginPath();
      ctx.moveTo(-crossSize, -crossSize);
      ctx.lineTo(crossSize, crossSize);
      ctx.moveTo(crossSize, -crossSize);
      ctx.lineTo(-crossSize, crossSize);
      ctx.stroke();
      // Arrow indicators
      ctx.beginPath();
      ctx.moveTo(halfSize * ratios.tertiary, -halfSize * ratios.tertiary);
      ctx.lineTo(crossSize, -crossSize);
      ctx.lineTo(halfSize * ratios.tertiary, -halfSize * ratios.tertiary);
      ctx.closePath();
      ctx.fill();
      break;
      
    case 'normalize':
      // Draw normalize icon (unit vector arrow)
      ctx.beginPath();
      ctx.moveTo(-halfSize * ratios.half, 0);
      ctx.lineTo(halfSize * ratios.tertiary, 0);
      ctx.stroke();
      // Arrow head
      ctx.beginPath();
      ctx.moveTo(halfSize * ratios.tertiary, 0);
      ctx.lineTo(halfSize * ratios.eighth, -quarterSize * ratios.half);
      ctx.lineTo(halfSize * ratios.eighth, quarterSize * ratios.half);
      ctx.closePath();
      ctx.fill();
      // Unit circle indicator
      ctx.beginPath();
      ctx.arc(-halfSize * ratios.eighth, 0, quarterSize * ratios.tertiary, 0, Math.PI * 2);
      ctx.stroke();
      break;
      
    case 'reflect':
      // Draw reflection (arrow bouncing off surface)
      ctx.beginPath();
      // Incoming arrow
      ctx.moveTo(-halfSize * ratios.small, -halfSize * ratios.tertiary);
      ctx.lineTo(0, 0);
      // Reflected arrow
      ctx.moveTo(0, 0);
      ctx.lineTo(-halfSize * ratios.small, halfSize * ratios.tertiary);
      ctx.stroke();
      // Surface line
      ctx.beginPath();
      ctx.moveTo(-halfSize * ratios.primary, 0);
      ctx.lineTo(halfSize * ratios.tertiary, 0);
      ctx.stroke();
      break;
      
    case 'refract':
      // Draw refraction (light bending)
      ctx.beginPath();
      // Incoming ray
      ctx.moveTo(-halfSize * ratios.small, -halfSize * ratios.tertiary);
      ctx.lineTo(0, 0);
      // Refracted ray (bent)
      ctx.moveTo(0, 0);
      ctx.lineTo(halfSize * ratios.half, halfSize * ratios.tertiary);
      ctx.stroke();
      // Surface line
      ctx.beginPath();
      ctx.moveTo(-halfSize * ratios.primary, 0);
      ctx.lineTo(halfSize * ratios.small, 0);
      ctx.stroke();
      break;
      
    case 'constant':
      // Draw constant/number icon
      ctx.beginPath();
      ctx.arc(0, 0, halfSize * ratios.small, 0, Math.PI * 2);
      ctx.stroke();
      // Number "1" inside
      ctx.beginPath();
      ctx.moveTo(-quarterSize * ratios.tertiary, -halfSize * ratios.tertiary);
      ctx.lineTo(-quarterSize * ratios.tertiary, halfSize * ratios.tertiary);
      ctx.lineTo(quarterSize * ratios.tertiary, halfSize * ratios.eighth);
      ctx.stroke();
      break;
      
    case 'bezier':
      // Draw bezier curve
      ctx.beginPath();
      // Control points
      const cp1x = -halfSize * ratios.small;
      const cp1y = -halfSize * ratios.tertiary;
      const cp2x = halfSize * ratios.small;
      const cp2y = halfSize * ratios.tertiary;
      // Start and end points
      ctx.moveTo(-halfSize * ratios.secondary, 0);
      // Approximate bezier curve with quadratic curve
      ctx.quadraticCurveTo(cp1x, cp1y, 0, 0);
      ctx.quadraticCurveTo(cp2x, cp2y, halfSize * ratios.secondary, 0);
      ctx.stroke();
      // Control point indicators
      ctx.beginPath();
      ctx.arc(cp1x, cp1y, style.strokeWidth * ratios.half, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cp2x, cp2y, style.strokeWidth * ratios.half, 0, Math.PI * 2);
      ctx.fill();
      break;
      
    case 'color-palette':
      // Draw color palette
      ctx.beginPath();
      ctx.arc(0, 0, halfSize * ratios.secondary, 0, Math.PI * 2);
      ctx.stroke();
      // Color swatches
      for (let i = 0; i < 4; i++) {
        const angle = (i * Math.PI * 2) / 4;
        const px = Math.cos(angle) * halfSize * ratios.tertiary;
        const py = Math.sin(angle) * halfSize * ratios.tertiary;
        ctx.beginPath();
        ctx.arc(px, py, quarterSize * ratios.tertiary, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
      
    case 'normal-map':
      // Draw normal map indicator (3D arrow)
      ctx.beginPath();
      // Arrow pointing up-right
      ctx.moveTo(-halfSize * ratios.tertiary, halfSize * ratios.tertiary);
      ctx.lineTo(0, -halfSize * ratios.tertiary);
      ctx.lineTo(halfSize * ratios.eighth, -halfSize * ratios.eighth);
      ctx.lineTo(halfSize * ratios.tertiary, -halfSize * ratios.tertiary);
      ctx.lineTo(0, -halfSize * ratios.tertiary);
      ctx.closePath();
      ctx.stroke();
      break;
      
    case 'light':
      // Draw light bulb
      const bulbRadius = halfSize * ratios.half;
      ctx.beginPath();
      // Bulb shape
      ctx.arc(0, -quarterSize, bulbRadius, 0, Math.PI * 2);
      ctx.stroke();
      // Base
      ctx.beginPath();
      ctx.moveTo(-quarterSize * ratios.half, quarterSize * ratios.tertiary);
      ctx.lineTo(-quarterSize * ratios.tertiary, quarterSize * ratios.half);
      ctx.lineTo(quarterSize * ratios.tertiary, quarterSize * ratios.half);
      ctx.lineTo(quarterSize * ratios.half, quarterSize * ratios.tertiary);
      ctx.stroke();
      // Light rays
      for (let i = 0; i < 4; i++) {
        const angle = (i * Math.PI) / 2;
        ctx.beginPath();
        ctx.moveTo(
          Math.cos(angle) * bulbRadius,
          -quarterSize + Math.sin(angle) * bulbRadius
        );
        ctx.lineTo(
          Math.cos(angle) * halfSize * ratios.secondary,
          -quarterSize + Math.sin(angle) * halfSize * ratios.secondary
        );
        ctx.stroke();
      }
      break;
      
    case 'dither':
      // Draw dither pattern (checkerboard-like)
      const ditherSize = size * ratios.gridSpacing;
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 4; col++) {
          if ((row + col) % 2 === 0) {
            ctx.fillRect(
              -halfSize + col * ditherSize,
              -halfSize + row * ditherSize,
              ditherSize,
              ditherSize
            );
          }
        }
      }
      break;
      
    case 'tone-curve':
      // Draw tone curve (S-curve)
      ctx.beginPath();
      const curveSteps = 20;
      const curveSize = size * ratios.primary;
      for (let i = 0; i <= curveSteps; i++) {
        const t = i / curveSteps;
        // S-curve: smoothstep-like
        const s = t * t * (3 - 2 * t);
        const px = (t - ratios.half) * curveSize;
        const py = (ratios.half - s) * curveSize;
        if (i === 0) {
          ctx.moveTo(px, py);
        } else {
          ctx.lineTo(px, py);
        }
      }
      ctx.stroke();
      break;
      
    case 'compare':
      // Draw comparison operator (< >)
      ctx.beginPath();
      // Less than
      ctx.moveTo(-halfSize * ratios.tertiary, 0);
      ctx.lineTo(-halfSize * ratios.small, -quarterSize * ratios.half);
      ctx.lineTo(-halfSize * ratios.small, quarterSize * ratios.half);
      ctx.closePath();
      ctx.fill();
      // Greater than
      ctx.beginPath();
      ctx.moveTo(halfSize * ratios.tertiary, 0);
      ctx.lineTo(halfSize * ratios.small, -quarterSize * ratios.half);
      ctx.lineTo(halfSize * ratios.small, quarterSize * ratios.half);
      ctx.closePath();
      ctx.fill();
      break;
      
    case 'select':
      // Draw select/switch icon (toggle switch)
      ctx.beginPath();
      ctx.arc(0, 0, halfSize * ratios.half, 0, Math.PI * 2);
      ctx.stroke();
      // Switch indicator
      ctx.beginPath();
      ctx.moveTo(-halfSize * ratios.tertiary, 0);
      ctx.lineTo(halfSize * ratios.tertiary, 0);
      ctx.stroke();
      // Dot on one side
      ctx.beginPath();
      ctx.arc(halfSize * ratios.eighth, 0, style.strokeWidth, 0, Math.PI * 2);
      ctx.fill();
      break;
      
    case 'color-wheel':
      // Draw color wheel (circle divided into color segments)
      const wheelRadius = halfSize * ratios.primary;
      const segments = 8; // Number of color segments
      
      // Draw outer circle
      ctx.beginPath();
      ctx.arc(0, 0, wheelRadius, 0, Math.PI * 2);
      ctx.stroke();
      
      // Draw radial lines to create segments
      for (let i = 0; i < segments; i++) {
        const angle = (i * Math.PI * 2) / segments;
        const px = Math.cos(angle) * wheelRadius;
        const py = Math.sin(angle) * wheelRadius;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(px, py);
        ctx.stroke();
      }
      
      // Draw inner circle to show it's a color picker
      ctx.beginPath();
      ctx.arc(0, 0, wheelRadius * ratios.tertiary, 0, Math.PI * 2);
      ctx.stroke();
      break;
      
    default:
      // Default: draw a simple circle
      ctx.beginPath();
      ctx.arc(0, 0, halfSize * ratios.primary, 0, Math.PI * 2);
      ctx.stroke();
      break;
  }
  
  ctx.restore();
}
