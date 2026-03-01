/**
 * Registers all canvas interaction handlers with the InteractionManager.
 * Extracted from NodeEditorCanvas.setupInteractionHandlers to reduce file size.
 */

import { InteractionManager } from '../../interactions/InteractionManager';
import { InteractionType } from '../../interactions/InteractionTypes';
import type { HandlerContext } from '../../interactions/HandlerContext';
import {
  NodeDragHandler,
  PortConnectHandler,
  ParameterDragHandler,
  BezierControlDragHandler,
  ConnectionSelectHandler,
  CanvasZoomHandler,
  HandToolHandler,
  SelectionToolHandler,
  CanvasPanHandler
} from '../../interactions/handlers';

export function registerCanvasInteractionHandlers(
  manager: InteractionManager,
  context: HandlerContext
): void {
  manager.register(InteractionType.NodeDrag, new NodeDragHandler(context));
  manager.register(InteractionType.PortConnect, new PortConnectHandler(context));
  manager.register(InteractionType.ParameterDrag, new ParameterDragHandler(context));
  manager.register(InteractionType.BezierControlDrag, new BezierControlDragHandler(context));
  manager.register(InteractionType.NodeSelect, new ConnectionSelectHandler(context));
  manager.register(InteractionType.CanvasZoom, new CanvasZoomHandler(context));
  manager.register(InteractionType.CanvasPan, new HandToolHandler(context));
  manager.register(InteractionType.RectangleSelection, new SelectionToolHandler(context));
  manager.register(InteractionType.CanvasPan, new CanvasPanHandler(context));
}
