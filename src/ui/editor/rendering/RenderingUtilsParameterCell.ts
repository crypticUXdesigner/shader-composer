/**
 * Parameter cell and parameter port drawing for node UI.
 * Extracted from RenderingUtils to keep main file under ~450 lines.
 */

import { getCSSColor, getCSSColorRGBA, getCategoryVariableAsNumber, getCSSVariableAsNumber } from '../../../utils/cssTokens';
import { getCategoryStyleColor } from '../../../utils/categoryStyleMap';
import { drawRoundedRect } from './RenderingUtils';

/** State for parameter port drawing (hover, connecting, connected). */
export interface ParameterPortState {
  isHovered: boolean;
  isConnecting?: boolean;
  isConnected?: boolean;
}

/** Minimal metrics needed for parameter cell rendering (cell + label). */
export interface ParameterCellMetrics {
  cellX: number;
  cellY: number;
  cellWidth: number;
  cellHeight: number;
  labelX: number;
  labelY: number;
}

/** State passed to renderParameterCell (skipPorts, hover, connected). */
export interface ParameterCellRenderState {
  skipPorts: boolean;
  isHovered: boolean;
  isConnected: boolean;
}

/** Mode button data when showModeButton is true (symbol + connected state for colors). */
export interface ParameterCellModeOptions {
  symbol: string;
  isConnected: boolean;
}

export interface RenderParameterCellOptions {
  labelText: string;
  showModeButton?: boolean;
  mode?: ParameterCellModeOptions;
  modeButtonX?: number;
  modeButtonY?: number;
  skipPorts?: boolean;
  portType?: string;
  portX?: number;
  portY?: number;
  portScale?: number;
  category?: string;
}

const PORT_COLOR_TOKEN_MAP: Record<string, string> = {
  float: 'port-color-float',
  int: 'port-color-float',
  vec2: 'port-color-vec2',
  vec3: 'port-color-vec3',
  vec4: 'port-color-vec4',
};

const PORT_CONNECTED_COLOR_TOKEN_MAP: Record<string, string> = {
  float: 'port-connected-color-float',
  int: 'port-connected-color-float',
  vec2: 'port-connected-color-vec2',
  vec3: 'port-connected-color-vec3',
  vec4: 'port-connected-color-vec4',
};

/**
 * Draw the shared parameter cell shell: background, border, label, optional mode button, and port.
 */
export function renderParameterCell(
  ctx: CanvasRenderingContext2D,
  metrics: ParameterCellMetrics,
  state: ParameterCellRenderState,
  options: RenderParameterCellOptions
): void {
  const skipPorts = state.skipPorts ?? options.skipPorts ?? false;
  const isConnected = state.isConnected;
  const category = options.category;

  const cellBg = category != null
    ? getCategoryStyleColor(category, 'paramCellBg', getCSSColor('color-gray-30', '#050507'))
    : getCSSColor('param-cell-bg', getCSSColor('color-gray-30', '#050507'));
  const cellBgEnd = category != null
    ? getCategoryStyleColor(category, 'paramCellBgEnd', 'transparent')
    : getCSSColor('param-cell-bg-end', 'transparent');
  const cellBgConnected = category != null
    ? getCategoryStyleColor(category, 'paramCellBgConnected', getCSSColor('param-cell-bg-connected', '#ffffff60'))
    : getCSSColor('param-cell-bg-connected', getCSSColor('param-cell-bg-connected', '#ffffff60'));
  const cellBorderRadius = category != null
    ? getCategoryVariableAsNumber('param-cell-border-radius', category, 12)
    : getCSSVariableAsNumber('param-cell-border-radius', 6);

  if (isConnected) {
    ctx.fillStyle = cellBgConnected;
    drawRoundedRect(ctx, metrics.cellX, metrics.cellY, metrics.cellWidth, metrics.cellHeight, cellBorderRadius);
    ctx.fill();
  } else {
    const ew = (metrics.cellWidth * getCSSVariableAsNumber('param-cell-bg-gradient-ellipse-width', 100)) / 100;
    const eh = (metrics.cellHeight * getCSSVariableAsNumber('param-cell-bg-gradient-ellipse-height', 100)) / 100;
    const ex = metrics.cellX + (metrics.cellWidth * getCSSVariableAsNumber('param-cell-bg-gradient-ellipse-x', 50)) / 100;
    const ey = metrics.cellY + (metrics.cellHeight * getCSSVariableAsNumber('param-cell-bg-gradient-ellipse-y', 50)) / 100;
    ctx.save();
    drawRoundedRect(ctx, metrics.cellX, metrics.cellY, metrics.cellWidth, metrics.cellHeight, cellBorderRadius);
    ctx.clip();
    ctx.translate(ex, ey);
    ctx.scale(ew / 2, eh / 2);
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    gradient.addColorStop(0, cellBg);
    gradient.addColorStop(1, cellBgEnd);
    ctx.fillStyle = gradient;
    ctx.fillRect(-2, -2, 4, 4);
    ctx.restore();
  }

  const borderColor = getCSSColor(
    isConnected ? 'param-cell-border-connected' : 'param-cell-border',
    getCSSColor('color-gray-70', '#282b31')
  );
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1;
  drawRoundedRect(ctx, metrics.cellX, metrics.cellY, metrics.cellWidth, metrics.cellHeight, cellBorderRadius);
  ctx.stroke();

  if (
    !skipPorts &&
    options.portType != null &&
    options.portX != null &&
    options.portY != null &&
    options.portScale != null
  ) {
    drawParameterPort(ctx, options.portX, options.portY, options.portType, {
      isHovered: state.isHovered,
      isConnected: state.isConnected
    }, options.portScale);
  }

  const labelFontSize = getCSSVariableAsNumber('param-label-font-size', 18);
  const labelFontWeight = getCSSVariableAsNumber('param-label-font-weight', 600);
  const labelColor = category != null
    ? getCategoryStyleColor(category, 'paramLabelColor', getCSSColor('color-gray-110', '#a3aeb5'))
    : getCSSColor('param-label-color', getCSSColor('color-gray-110', '#a3aeb5'));
  ctx.font = `${labelFontWeight} ${labelFontSize}px "Space Grotesk", sans-serif`;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';
  ctx.fillStyle = labelColor;
  ctx.fillText(options.labelText, metrics.labelX, metrics.labelY);

  if (
    options.showModeButton &&
    options.mode != null &&
    options.modeButtonX != null &&
    options.modeButtonY != null
  ) {
    const modeButtonSize = getCSSVariableAsNumber('param-mode-button-size', 20);
    const modeButtonBg = getCSSColor('param-mode-button-bg', getCSSColor('color-gray-50', '#111317'));
    ctx.fillStyle = modeButtonBg;
    ctx.beginPath();
    ctx.arc(options.modeButtonX, options.modeButtonY, modeButtonSize / 2, 0, Math.PI * 2);
    ctx.fill();
    const modeButtonColorToken = options.mode.isConnected
      ? 'param-mode-button-color-connected'
      : 'param-mode-button-color-static';
    ctx.fillStyle = getCSSColor(
      modeButtonColorToken,
      options.mode.isConnected
        ? getCSSColor('color-gray-130', '#ebeff0')
        : getCSSColor('color-gray-60', '#5a5f66')
    );
    const modeButtonFontSize = getCSSVariableAsNumber('param-mode-button-font-size', 18);
    const modeButtonFontWeight = getCSSVariableAsNumber('param-mode-button-font-weight', 500);
    const modeButtonTextOffsetY = getCSSVariableAsNumber('param-mode-button-text-offset-y', 0);
    ctx.font = `${modeButtonFontWeight} ${modeButtonFontSize}px "Space Grotesk", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      options.mode.symbol,
      options.modeButtonX,
      options.modeButtonY + modeButtonTextOffsetY
    );
  }

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

/**
 * Draw the shared parameter port primitive (highlight + circle, optional border).
 */
export function drawParameterPort(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  type: string,
  state: ParameterPortState,
  scale: number
): void {
  const radius = getCSSVariableAsNumber('port-radius', 4) * scale;
  const opacity = 1.0;

  if (state.isHovered || state.isConnecting) {
    const highlightRadius = radius * 3.5;
    if (state.isConnecting) {
      const c = getCSSColorRGBA('port-dragging-color', { r: 0, g: 255, b: 136, a: 1 });
      const outerOpacity = getCSSVariableAsNumber('port-dragging-outer-opacity', 0.6) * opacity;
      ctx.fillStyle = `rgba(${c.r}, ${c.g}, ${c.b}, ${outerOpacity})`;
    } else {
      const c = getCSSColorRGBA('port-hover-color', { r: 33, g: 150, b: 243, a: 1 });
      const outerOpacity = getCSSVariableAsNumber('port-hover-outer-opacity', 0.3) * opacity;
      ctx.fillStyle = `rgba(${c.r}, ${c.g}, ${c.b}, ${outerOpacity})`;
    }
    ctx.beginPath();
    ctx.arc(x, y, highlightRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  if (state.isHovered || state.isConnecting) {
    if (state.isConnecting) {
      const c = getCSSColorRGBA('port-dragging-color', { r: 0, g: 255, b: 136, a: 1 });
      ctx.fillStyle = `rgba(${c.r}, ${c.g}, ${c.b}, ${opacity})`;
    } else {
      const c = getCSSColorRGBA('port-hover-color', { r: 33, g: 150, b: 243, a: 1 });
      ctx.fillStyle = `rgba(${c.r}, ${c.g}, ${c.b}, ${opacity})`;
    }
  } else if (state.isConnected) {
    const connectedTokenName = PORT_CONNECTED_COLOR_TOKEN_MAP[type] ?? 'port-connected-color-default';
    const colorRGBA = getCSSColorRGBA(connectedTokenName, { r: 81, g: 89, b: 97, a: 1 });
    ctx.fillStyle = `rgba(${colorRGBA.r}, ${colorRGBA.g}, ${colorRGBA.b}, ${opacity})`;
  } else {
    const tokenName = PORT_COLOR_TOKEN_MAP[type] ?? 'port-color-default';
    const colorRGBA = getCSSColorRGBA(tokenName, { r: 102, g: 102, b: 102, a: 1 });
    ctx.fillStyle = `rgba(${colorRGBA.r}, ${colorRGBA.g}, ${colorRGBA.b}, ${opacity})`;
  }

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  const borderWidth = getCSSVariableAsNumber('port-border-width', 0);
  if (borderWidth > 0) {
    const borderRGBA = getCSSColorRGBA('port-border-color', { r: 255, g: 255, b: 255, a: 1 });
    ctx.strokeStyle = `rgba(${borderRGBA.r}, ${borderRGBA.g}, ${borderRGBA.b}, ${borderRGBA.a * opacity})`;
    ctx.lineWidth = borderWidth;
    ctx.beginPath();
    ctx.arc(x, y, radius + borderWidth / 2, 0, Math.PI * 2);
    ctx.stroke();
  }
}
