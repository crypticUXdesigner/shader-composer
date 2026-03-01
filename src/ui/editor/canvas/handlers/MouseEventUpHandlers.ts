/**
 * Mouse up handlers: end interactions, clear guides, complete connection, reset state.
 * Used by MouseEventHandler.handleMouseUp.
 */

import { InteractionType } from '../../../interactions/InteractionTypes';
import { RenderLayer } from '../../rendering/RenderState';
import type { MouseEventHandlerDependencies } from './MouseEventHandler';
import type { MouseEventMoveContext } from './MouseEventHandlerTypes';

/**
 * End all interaction types, stop edge scroll, clear smart guides, mark overlay dirty, request render.
 */
export function endAllInteractionsAndClearGuides(deps: MouseEventHandlerDependencies, e: MouseEvent): void {
  if (deps.interactionManager) {
    const eventTypes = [
      InteractionType.NodeDrag,
      InteractionType.ParameterDrag,
      InteractionType.BezierControlDrag,
      InteractionType.PortConnect,
      InteractionType.CanvasPan,
      InteractionType.RectangleSelection
    ];
    for (const eventType of eventTypes) {
      const event = deps.createInteractionEvent(eventType, e);
      deps.interactionManager.end(event);
    }
  }
  deps.edgeScrollManager.stop();
  deps.setSmartGuides({ vertical: [], horizontal: [] });
  deps.renderState.markLayerDirty(RenderLayer.Overlays);
  deps.handlerContext.requestRender();
}

/**
 * If currently connecting, resolve target port (release hit, then hoveredPort, then last cursor position) and complete or cancel connection; clear connection state.
 * Runs before endAllInteractionsAndClearGuides so state.connection.isConnecting and hoveredPort are still set.
 */
export function completeConnectionOnMouseUp(ctx: MouseEventMoveContext, e: MouseEvent): void {
  const state = ctx.getState();
  if (!state.connection.isConnecting) return;

  const conn = state.connection;
  const startNodeId = conn.connectionStartNodeId;
  const startPort = conn.connectionStartPort;
  const startIsOutput = conn.connectionStartIsOutput;
  if (!startNodeId || !startPort) {
    ctx.setState({ connection: { isConnecting: false, connectionStartNodeId: null, connectionStartPort: null, connectionStartParameter: null, hoveredPort: null } });
    ctx.deps.canvas.style.cursor = (ctx.deps.getIsSpacePressed?.() ?? ctx.deps.isSpacePressed) ? 'grab' : 'default';
    ctx.deps.handlerContext.render();
    return;
  }

  const portHitAtRelease = ctx.deps.hitTestManager.hitTestPort(e.clientX, e.clientY);
  const validDirection = (p: { isOutput: boolean }) =>
    (startIsOutput && !p.isOutput) || (!startIsOutput && p.isOutput);
  const portHitAtLastMove = ctx.deps.hitTestManager.hitTestPort(conn.connectionMouseX, conn.connectionMouseY);

  const targetPort =
    portHitAtRelease && portHitAtRelease.nodeId !== startNodeId && validDirection(portHitAtRelease)
      ? portHitAtRelease
      : conn.hoveredPort && conn.hoveredPort.nodeId !== startNodeId && validDirection(conn.hoveredPort)
        ? conn.hoveredPort
        : portHitAtLastMove &&
            portHitAtLastMove.nodeId !== startNodeId &&
            validDirection(portHitAtLastMove)
          ? portHitAtLastMove
          : null;

  if (targetPort) {
    const onConnectionCreated = ctx.deps.getOnConnectionCreated?.() ?? ctx.deps.onConnectionCreated;
    if (startIsOutput && !targetPort.isOutput) {
      if (targetPort.parameter) {
        onConnectionCreated?.(startNodeId, startPort, targetPort.nodeId, undefined, targetPort.parameter);
      } else {
        onConnectionCreated?.(startNodeId, startPort, targetPort.nodeId, targetPort.port);
      }
    } else if (!startIsOutput && targetPort.isOutput) {
      onConnectionCreated?.(targetPort.nodeId, targetPort.port, startNodeId, startPort);
    }
  }

  ctx.setState({
    connection: {
      isConnecting: false,
      connectionStartNodeId: null,
      connectionStartPort: null,
      connectionStartParameter: null,
      hoveredPort: null
    }
  });
  ctx.deps.canvas.style.cursor = (ctx.deps.getIsSpacePressed?.() ?? ctx.deps.isSpacePressed) ? 'grab' : 'default';
  ctx.deps.handlerContext.render();
}

/**
 * Reset pan and interaction state to idle.
 */
export function resetInteractionState(ctx: { setState: (u: import('./MouseEventHandlerTypes').MouseEventStateUpdates) => void }): void {
  ctx.setState({
    pan: {
      isPanning: false,
      potentialBackgroundPan: false
    },
    interaction: {
      isDraggingNode: false,
      draggingNodeId: null,
      draggingNodeInitialPos: null,
      selectedNodesInitialPositions: new Map(),
      isDraggingParameter: false,
      draggingParameterNodeId: null,
      draggingParameterName: null,
      dragParamStartX: 0,
      dragParamStartY: 0,
      dragParamStartValue: 0,
      draggingFrequencyBand: null,
      isDraggingBezierControl: false,
      draggingBezierNodeId: null,
      draggingBezierControlIndex: null,
      dragBezierStartValues: null,
      potentialNodeDrag: false,
      potentialNodeDragId: null
    }
  });
}
