/**
 * Hit Test Manager
 * Handles all hit testing operations for detecting mouse interactions with canvas elements.
 */

import type { NodeGraph } from '../../../data-model/types';
import type { NodeSpec } from '../../../types/nodeSpec';
import type { NodeRenderMetrics } from '../NodeRenderer';
import { getCSSVariableAsNumber } from '../../../utils/cssTokens';
import type { ViewStateManager } from './ViewStateManager';
import { FREQ_MIN, FREQ_MAX, hzToNorm } from '../rendering/layout/elements/FrequencyRangeElement';
import {
  getParameterControlHitRegions,
  isPointInParameterRegions,
  getRemapHitRegions,
  testRemapHit,
  type ParameterGridPosition
} from './ParameterHitRegions';
import type { HitTestContext } from './hitTest/HitTestContext';
import { hitTestConnection as hitTestConnectionImpl } from './hitTest/HitTestConnection';
import { hitTestHeaderLabel as hitTestHeaderLabelImpl, hitTestParameterMode as hitTestParameterModeImpl, hitTestTypeLabel as hitTestTypeLabelImpl } from './hitTest/HitTestTypeLabel';
import { hitTestBezierControlPoint as hitTestBezierControlPointImpl } from './hitTest/HitTestBezier';
import { hitTestColorMapRowButtons as hitTestColorMapRowButtonsImpl, hitTestColorPicker as hitTestColorPickerImpl } from './hitTest/HitTestColor';

export interface HitTestManagerDependencies {
  graph: NodeGraph;
  nodeSpecs: Map<string, NodeSpec>;
  nodeMetrics: Map<string, NodeRenderMetrics>;
  screenToCanvas: (screenX: number, screenY: number) => { x: number; y: number };
  getViewState: () => { panX: number; panY: number; zoom: number };
  ctx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  viewStateManager: ViewStateManager;
  /** DOM-derived param port positions (key: nodeId:paramName). Use when available to match connection rendering. */
  getParamPortPositionsFromDOM?: () => Map<string, { x: number; y: number }>;
  /** DOM-derived header output port positions (key: nodeId:output:portName). Use when available for param connections. */
  getHeaderOutputPortPositionsFromDOM?: () => Map<string, { x: number; y: number }>;
  /** Rect for connection hit testing – use overlay rect when connections render to overlay so coords match. */
  getConnectionHitTestRect?: () => DOMRect;
}

/**
 * Manages hit testing for all canvas elements (nodes, ports, connections, parameters, etc.)
 */
export class HitTestManager {
  private graph: NodeGraph;
  private nodeSpecs: Map<string, NodeSpec>;
  private nodeMetrics: Map<string, NodeRenderMetrics>;
  private screenToCanvas: (screenX: number, screenY: number) => { x: number; y: number };
  private getViewState: () => { panX: number; panY: number; zoom: number };
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private viewStateManager: ViewStateManager;
  private getParamPortPositionsFromDOM?: () => Map<string, { x: number; y: number }>;
  private getHeaderOutputPortPositionsFromDOM?: () => Map<string, { x: number; y: number }>;
  private getConnectionHitTestRect?: () => DOMRect;

  constructor(dependencies: HitTestManagerDependencies) {
    this.graph = dependencies.graph;
    this.nodeSpecs = dependencies.nodeSpecs;
    this.nodeMetrics = dependencies.nodeMetrics;
    this.screenToCanvas = dependencies.screenToCanvas;
    this.getViewState = dependencies.getViewState;
    this.ctx = dependencies.ctx;
    this.canvas = dependencies.canvas;
    this.viewStateManager = dependencies.viewStateManager;
    this.getParamPortPositionsFromDOM = dependencies.getParamPortPositionsFromDOM;
    this.getHeaderOutputPortPositionsFromDOM = dependencies.getHeaderOutputPortPositionsFromDOM;
    this.getConnectionHitTestRect = dependencies.getConnectionHitTestRect;
  }

  /**
   * Update dependencies (called when graph or metrics change)
   */
  updateDependencies(dependencies: Partial<HitTestManagerDependencies>): void {
    if (dependencies.graph !== undefined) this.graph = dependencies.graph;
    if (dependencies.nodeSpecs !== undefined) this.nodeSpecs = dependencies.nodeSpecs;
    if (dependencies.nodeMetrics !== undefined) this.nodeMetrics = dependencies.nodeMetrics;
    if (dependencies.screenToCanvas !== undefined) this.screenToCanvas = dependencies.screenToCanvas;
    if (dependencies.getViewState !== undefined) this.getViewState = dependencies.getViewState;
    if (dependencies.ctx !== undefined) this.ctx = dependencies.ctx;
    if (dependencies.canvas !== undefined) this.canvas = dependencies.canvas;
    if (dependencies.viewStateManager !== undefined) this.viewStateManager = dependencies.viewStateManager;
    if (dependencies.getParamPortPositionsFromDOM !== undefined) this.getParamPortPositionsFromDOM = dependencies.getParamPortPositionsFromDOM;
    if (dependencies.getHeaderOutputPortPositionsFromDOM !== undefined) this.getHeaderOutputPortPositionsFromDOM = dependencies.getHeaderOutputPortPositionsFromDOM;
    if (dependencies.getConnectionHitTestRect !== undefined) this.getConnectionHitTestRect = dependencies.getConnectionHitTestRect;
  }

  /**
   * Hit test for nodes
   * Returns node ID if mouse is over a node, null otherwise
   */
  hitTestNode(mouseX: number, mouseY: number): string | null {
    const canvasPos = this.screenToCanvas(mouseX, mouseY);
    
    // Check nodes in reverse order (top to bottom)
    for (let i = this.graph.nodes.length - 1; i >= 0; i--) {
      const node = this.graph.nodes[i];
      const metrics = this.nodeMetrics.get(node.id);
      if (!metrics) continue;
      
      if (
        canvasPos.x >= node.position.x &&
        canvasPos.x <= node.position.x + metrics.width &&
        canvasPos.y >= node.position.y &&
        canvasPos.y <= node.position.y + metrics.height
      ) {
        return node.id;
      }
    }
    
    return null;
  }

  /**
   * Hit test for ports (input/output/parameter)
   * Returns port information if mouse is over a port, null otherwise.
   * Parameter ports use DOM-based hit test (elementFromPoint) since DOM layout differs from canvas metrics.
   */
  hitTestPort(mouseX: number, mouseY: number): { nodeId: string, port: string, isOutput: boolean, parameter?: string, snapPosition?: { x: number; y: number } } | null {
    const canvasPos = this.screenToCanvas(mouseX, mouseY);
    const portRadius = getCSSVariableAsNumber('port-radius', 12); // Visual radius (matches CSS)
    const hitMargin = 10; // Increased from 4 to 10 for easier interaction
    const hitRadius = portRadius + hitMargin;
    // Parameter ports are smaller (param-port-size ~6px) – use generous hit area for easy snap
    const paramPortHitRadius = getCSSVariableAsNumber('param-port-size', 6) + 20;

    // DOM-based hit test for parameter ports (DOM layout differs from canvas metrics)
    const domEl = document.elementFromPoint(mouseX, mouseY);
    const paramPortEl = domEl?.closest?.('.param-port[data-node-id][data-param-name]') as HTMLElement | null;
    if (paramPortEl) {
      const nodeId = paramPortEl.getAttribute('data-node-id');
      const paramName = paramPortEl.getAttribute('data-param-name');
      if (nodeId && paramName) {
        const portCircle = paramPortEl.querySelector('.port-circle') as HTMLElement | null;
        const rect = portCircle ? portCircle.getBoundingClientRect() : paramPortEl.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const snapPos = this.screenToCanvas(centerX, centerY);
        return { nodeId, port: '', isOutput: false, parameter: paramName, snapPosition: snapPos };
      }
    }

    // DOM-based hit test for header input/output ports (same as param ports: DOM is source of truth for hit)
    const headerPortEl = domEl?.closest?.('.port.input-port[data-port-key], .port.output-port[data-port-key]') as HTMLElement | null;
    if (headerPortEl) {
      const nodeEl = headerPortEl.closest?.('.node[data-node-id]') as HTMLElement | null;
      const portKey = headerPortEl.getAttribute('data-port-key');
      const nodeId = nodeEl?.getAttribute('data-node-id');
      if (nodeId && portKey) {
        const isOutput = portKey.startsWith('output:');
        const port = isOutput ? portKey.slice(7) : portKey.slice(6);
        return { nodeId, port, isOutput };
      }
    }

    for (const node of this.graph.nodes) {
      const spec = this.nodeSpecs.get(node.type);
      const metrics = this.nodeMetrics.get(node.id);
      if (!spec || !metrics) continue;

      // Check parameter input ports (for float parameters only)
      for (const [paramName, paramPortPos] of metrics.parameterInputPortPositions.entries()) {
        const paramSpec = spec.parameters[paramName];
        if (paramSpec && paramSpec.type === 'float') {
          const dx = canvasPos.x - paramPortPos.x;
          const dy = canvasPos.y - paramPortPos.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < paramPortHitRadius) {
            return { nodeId: node.id, port: '', isOutput: false, parameter: paramName };
          }
        }
      }
      
      // Check input ports
      for (const port of spec.inputs) {
        const pos = metrics.portPositions.get(`input:${port.name}`);
        if (pos) {
          const dx = canvasPos.x - pos.x;
          const dy = canvasPos.y - pos.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < hitRadius) {
            return { nodeId: node.id, port: port.name, isOutput: false };
          }
        }
      }
      
      // Check output ports
      for (const port of spec.outputs) {
        const pos = metrics.portPositions.get(`output:${port.name}`);
        if (pos) {
          const dx = canvasPos.x - pos.x;
          const dy = canvasPos.y - pos.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < hitRadius) {
            return { nodeId: node.id, port: port.name, isOutput: true };
          }
        }
      }
    }
    
    return null;
  }

  /**
   * Hit test for connections
   * Returns connection ID if mouse is over a connection, null otherwise
   */
  hitTestConnection(mouseX: number, mouseY: number): string | null {
    return hitTestConnectionImpl(this.getHitTestContext(), mouseX, mouseY);
  }

  private getHitTestContext(): HitTestContext {
    return {
      graph: this.graph,
      nodeSpecs: this.nodeSpecs,
      nodeMetrics: this.nodeMetrics,
      screenToCanvas: this.screenToCanvas,
      getViewState: this.getViewState,
      ctx: this.ctx,
      canvas: this.canvas,
      viewStateManager: this.viewStateManager,
      getParamPortPositionsFromDOM: this.getParamPortPositionsFromDOM,
      getHeaderOutputPortPositionsFromDOM: this.getHeaderOutputPortPositionsFromDOM,
      getConnectionHitTestRect: this.getConnectionHitTestRect
    };
  }

  /**
   * Hit test for range editor slider handles and input row.
   * Uses getRemapHitRegions / testRemapHit (same token/layout as RemapRangeElement).
   */
  hitTestRangeEditorSlider(mouseX: number, mouseY: number): { nodeId: string, paramName: string } | null {
    const canvasPos = this.screenToCanvas(mouseX, mouseY);
    const viewState = this.getViewState();

    for (const node of this.graph.nodes) {
      const spec = this.nodeSpecs.get(node.type);
      const metrics = this.nodeMetrics.get(node.id);
      if (!spec || !metrics) continue;

      const rangeParams = ['inMin', 'inMax', 'outMin', 'outMax'];
      const hasRangeParams = rangeParams.every((p) => spec.parameters[p]?.type === 'float');
      if (!hasRangeParams) continue;

      let remapRangeElementMetrics: { x: number; y: number; width: number; height: number } | null = null;
      if (metrics.elementMetrics) {
        for (const [elementKey, elementMetrics] of metrics.elementMetrics.entries()) {
          if (elementKey.startsWith('remap-range-')) {
            remapRangeElementMetrics = elementMetrics as { x: number; y: number; width: number; height: number };
            break;
          }
        }
      }
      if (!remapRangeElementMetrics) continue;

      const result = getRemapHitRegions(node, spec, remapRangeElementMetrics, viewState.zoom);
      const paramName = testRemapHit(canvasPos.x, canvasPos.y, result);
      if (paramName != null) {
        return { nodeId: node.id, paramName };
      }
    }
    return null;
  }

  /**
   * Hit test for frequency-range elements (slider + start/end inputs).
   * Returns hit with frequencyBand when over a frequency-range control.
   */
  hitTestFrequencyRange(mouseX: number, mouseY: number): {
    nodeId: string;
    paramName: string;
    frequencyBand: { bandIndex: number; field: 'start' | 'end' | 'sliderLow' | 'sliderHigh' };
    scale: 'linear' | 'audio';
  } | null {
    const canvasPos = this.screenToCanvas(mouseX, mouseY);
    const pd = getCSSVariableAsNumber('embed-slot-pd', 12);
    const gap = pd;
    const labelFontSize = getCSSVariableAsNumber('frequency-range-label-font-size', 18);
    const labelHeight = labelFontSize + 2;
    const scaleHeightToken = getCSSVariableAsNumber('frequency-range-scale-height', 22);
    const spectrumHeightToken = getCSSVariableAsNumber('frequency-range-spectrum-height', 28);
    const sliderHeight = getCSSVariableAsNumber('frequency-range-slider-height', 16);
    const inputRowHeight = getCSSVariableAsNumber('frequency-range-input-row-height', 28);
    const valueFontSize = getCSSVariableAsNumber('knob-value-font-size', 18);
    const valuePaddingH = getCSSVariableAsNumber('knob-value-padding-horizontal', 8);
    const handleRadius = 10;

    for (const node of this.graph.nodes) {
      const spec = this.nodeSpecs.get(node.type);
      const metrics = this.nodeMetrics.get(node.id);
      if (!spec || !metrics?.elementMetrics) continue;

      const layout = spec.parameterLayout?.elements;
      if (!layout) continue;

      for (let i = 0; i < layout.length; i++) {
        const el = layout[i] as { type?: string; parameter?: string; bandIndex?: number; scale?: 'linear' | 'audio' };
        if (el?.type !== 'frequency-range' || el.parameter == null) continue;

        const bandIndex = el.bandIndex ?? 0;
        const key = `frequency-range-${i}-${bandIndex}`;
        const em = metrics.elementMetrics.get(key);
        if (!em || em.width == null || em.height == null) continue;

        const param = node.parameters[el.parameter];
        const bands = Array.isArray(param) ? param : (spec.parameters[el.parameter]?.default as number[][]) ?? [];
        const band = bands[bandIndex];
        const arr = Array.isArray(band) && band.length >= 2 ? band : [FREQ_MIN, FREQ_MAX];
        const minHz = Math.max(FREQ_MIN, Math.min(FREQ_MAX, Number(arr[0]) ?? FREQ_MIN));
        const maxHz = Math.max(FREQ_MIN, Math.min(FREQ_MAX, Number(arr[1]) ?? FREQ_MAX));
        const scale = el.scale ?? 'linear';
        const minNorm = Math.max(0, Math.min(1, hzToNorm(minHz, scale)));
        const maxNorm = Math.max(0, Math.min(1, hzToNorm(maxHz, scale)));
        const scaleBlockHeight = scale === 'audio' ? (spectrumHeightToken + gap + scaleHeightToken + gap) : 0;

        const x = em.x;
        const y = em.y;
        const w = em.width;
        const contentWidth = w - pd * 2;
        const sliderX = x + pd;
        const sliderY = y + pd + labelHeight + gap + scaleBlockHeight;
        const rowY = sliderY + sliderHeight + gap;
        const rowLeft = x + pd;
        const rowRight = x + w - pd;

        if (canvasPos.y >= rowY && canvasPos.y <= rowY + inputRowHeight) {
          this.ctx.font = `${valueFontSize}px "JetBrains Mono", monospace`;
          const startW = this.ctx.measureText(minHz.toFixed(0)).width + valuePaddingH * 2;
          const endW = this.ctx.measureText(maxHz.toFixed(0)).width + valuePaddingH * 2;
          if (canvasPos.x >= rowLeft && canvasPos.x <= rowLeft + startW) {
            return { nodeId: node.id, paramName: el.parameter, frequencyBand: { bandIndex, field: 'start' }, scale };
          }
          if (canvasPos.x >= rowRight - endW && canvasPos.x <= rowRight) {
            return { nodeId: node.id, paramName: el.parameter, frequencyBand: { bandIndex, field: 'end' }, scale };
          }
        }

        if (canvasPos.y >= sliderY && canvasPos.y <= sliderY + sliderHeight && canvasPos.x >= sliderX && canvasPos.x <= sliderX + contentWidth) {
          const lowX = sliderX + minNorm * contentWidth;
          const highX = sliderX + maxNorm * contentWidth;
          const dLow = Math.abs(canvasPos.x - lowX);
          const dHigh = Math.abs(canvasPos.x - highX);
          if (dLow <= handleRadius && dLow <= dHigh) {
            return { nodeId: node.id, paramName: el.parameter, frequencyBand: { bandIndex, field: 'sliderLow' }, scale };
          }
          if (dHigh <= handleRadius && dHigh <= dLow) {
            return { nodeId: node.id, paramName: el.parameter, frequencyBand: { bandIndex, field: 'sliderHigh' }, scale };
          }
        }
      }
    }
    return null;
  }

  hitTestColorMapRowButtons(mouseX: number, mouseY: number): { nodeId: string; elementIndex: number; button: 'swap' | 'reverseHue' } | null {
    return hitTestColorMapRowButtonsImpl(this.getHitTestContext(), mouseX, mouseY);
  }

  hitTestColorPicker(mouseX: number, mouseY: number): { nodeId: string; elementIndex: number; pickerIndex?: number } | null {
    return hitTestColorPickerImpl(this.getHitTestContext(), mouseX, mouseY);
  }

  /**
   * Hit test for parameters
   * Returns parameter information if mouse is over a parameter, null otherwise
   */
  hitTestParameter(mouseX: number, mouseY: number): {
    nodeId: string;
    paramName: string;
    isString?: boolean;
    isModeButton?: boolean;
    frequencyBand?: { bandIndex: number; field: 'start' | 'end' | 'sliderLow' | 'sliderHigh' };
    scale?: 'linear' | 'audio';
  } | null {
    const freqRangeHit = this.hitTestFrequencyRange(mouseX, mouseY);
    if (freqRangeHit) {
      return {
        nodeId: freqRangeHit.nodeId,
        paramName: freqRangeHit.paramName,
        isString: false,
        frequencyBand: freqRangeHit.frequencyBand,
        scale: freqRangeHit.scale
      };
    }
    const rangeSliderHit = this.hitTestRangeEditorSlider(mouseX, mouseY);
    if (rangeSliderHit) {
      return { nodeId: rangeSliderHit.nodeId, paramName: rangeSliderHit.paramName, isString: false };
    }

    const canvasPos = this.screenToCanvas(mouseX, mouseY);
    
    // Iterate nodes in reverse order (front to back) so we hit the topmost node first
    for (let i = this.graph.nodes.length - 1; i >= 0; i--) {
      const node = this.graph.nodes[i];
      const spec = this.nodeSpecs.get(node.type);
      const metrics = this.nodeMetrics.get(node.id);
      if (!spec || !metrics) continue;
      
      const hasPort = (paramName: string) =>
        !spec.parameterLayout?.parametersWithoutPorts?.includes(paramName);

      for (const [paramName, gridPos] of metrics.parameterGridPositions.entries()) {
        const paramSpec = spec.parameters[paramName];
        if (!paramSpec) continue;

        // Test mode button first (same position as render: portX, knobY) so it's clickable
        // before the larger knob hit region. Only for float params that have a port.
        // gridPos is in canvas space (slot offset applied in ParameterLayoutManager).
        if (paramSpec.type === 'float' && hasPort(paramName)) {
          const modeButtonSize = getCSSVariableAsNumber('param-mode-button-size', 20);
          const modeButtonRadius = modeButtonSize / 2;
          const r2 = modeButtonRadius * modeButtonRadius;
          const dx = canvasPos.x - gridPos.portX;
          const dy = canvasPos.y - gridPos.knobY;
          if (dx * dx + dy * dy <= r2) {
            return { nodeId: node.id, paramName, isString: false, isModeButton: true };
          }
        }

        // Parameter and remap hit regions are derived from the same token/size inputs as
        // rendering (see value-box, parameter-cell, port, remap layout in ParameterHitRegions).
        const regions = getParameterControlHitRegions(
          spec,
          paramName,
          gridPos as ParameterGridPosition
        );
        if (regions != null && isPointInParameterRegions(canvasPos.x, canvasPos.y, regions)) {
          return { nodeId: node.id, paramName, isString: false };
        }

        // String params use full cell hit (no control regions from registry)
        if (paramSpec.type === 'string') {
          if (
            canvasPos.x >= gridPos.cellX &&
            canvasPos.x <= gridPos.cellX + gridPos.cellWidth &&
            canvasPos.y >= gridPos.cellY &&
            canvasPos.y <= gridPos.cellY + gridPos.cellHeight
          ) {
            return { nodeId: node.id, paramName, isString: true };
          }
        }
      }
    }

    return null;
  }

  hitTestBezierControlPoint(mouseX: number, mouseY: number): { nodeId: string; paramNames: [string, string, string, string]; controlIndex: number } | null {
    return hitTestBezierControlPointImpl(this.getHitTestContext(), mouseX, mouseY);
  }

  hitTestHeaderLabel(mouseX: number, mouseY: number): { nodeId: string } | null {
    return hitTestHeaderLabelImpl(this.getHitTestContext(), mouseX, mouseY);
  }

  hitTestParameterMode(mouseX: number, mouseY: number): { nodeId: string; paramName: string } | null {
    return hitTestParameterModeImpl(this.getHitTestContext(), mouseX, mouseY);
  }

  hitTestTypeLabel(mouseX: number, mouseY: number): ReturnType<typeof hitTestTypeLabelImpl> {
    return hitTestTypeLabelImpl(this.getHitTestContext(), mouseX, mouseY);
  }
}
