/**
 * CanvasOverlayAndGuides - Holds overlay state (smart guides, selection rect, active tool) and drawing.
 * Extracted from NodeEditorCanvas (03A further refactor) to reduce its size.
 */

import type { ToolType } from '../../types/editor';
import {
  renderSelectionRectangle as renderSelectionRectImpl,
  renderSmartGuides as renderSmartGuidesImpl,
  type SmartGuides
} from './CanvasOverlayDrawing';
import type { SmartGuidesManager } from './canvas';
import type { ViewStateManager } from './canvas';

export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CanvasOverlayAndGuides {
  setCurrentGuides(guides: SmartGuides): void;
  getCurrentGuides(): SmartGuides;
  setSelectionRectangle(rect: SelectionRect | null): void;
  getSelectionRectangle(): SelectionRect | null;
  getActiveTool(): ToolType;
  setActiveTool(tool: ToolType, canvas: HTMLCanvasElement): void;
  renderSelectionRectangle(
    ctx: CanvasRenderingContext2D,
    getViewState: () => { zoom: number }
  ): void;
  renderSmartGuides(
    ctx: CanvasRenderingContext2D,
    viewStateManager: ViewStateManager,
    canvas: HTMLCanvasElement,
    smartGuidesManager: SmartGuidesManager
  ): void;
}

export function createCanvasOverlayAndGuides(): CanvasOverlayAndGuides {
  let currentSmartGuides: SmartGuides = { vertical: [], horizontal: [] };
  let selectionRectangle: SelectionRect | null = null;
  let activeTool: ToolType = 'cursor';

  return {
    setCurrentGuides(guides) {
      currentSmartGuides = guides;
    },
    getCurrentGuides() {
      return currentSmartGuides;
    },
    setSelectionRectangle(rect) {
      selectionRectangle = rect;
    },
    getSelectionRectangle() {
      return selectionRectangle;
    },
    getActiveTool() {
      return activeTool;
    },
    setActiveTool(tool, canvas) {
      activeTool = tool;
      if (tool === 'hand') {
        canvas.style.cursor = 'grab';
      } else if (tool === 'select') {
        canvas.style.cursor = 'crosshair';
      } else {
        canvas.style.cursor = 'default';
      }
    },
    renderSelectionRectangle(ctx, getViewState) {
      renderSelectionRectImpl(ctx, selectionRectangle, getViewState);
    },
    renderSmartGuides(ctx, viewStateManager, canvas, smartGuidesManager) {
      const viewState = viewStateManager.getState();
      renderSmartGuidesImpl(
        ctx,
        currentSmartGuides,
        viewState,
        canvas.getBoundingClientRect(),
        (c, g, v, r) => smartGuidesManager.renderGuides(c, g, v, r)
      );
    }
  };
}
