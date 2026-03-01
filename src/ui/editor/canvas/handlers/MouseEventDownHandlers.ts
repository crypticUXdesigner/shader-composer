/**
 * Mouse down handler sequence: type label, param mode, tools, color/param/port/node/connection/pan.
 * Returns true if the event was handled (caller should return). Used by MouseEventHandler.handleMouseDown.
 */

import type { ParameterInputMode } from '../../../../types/nodeSpec';
import { InteractionType } from '../../../interactions/InteractionTypes';
import { isEnumParameter } from '../../../../utils/parameterEnumMappings';
import { FREQ_MIN, FREQ_MAX } from '../../rendering/layout/elements/FrequencyRangeElement';
import type { MouseEventMoveContext } from './MouseEventHandlerTypes';

export function runMouseDownHandlers(ctx: MouseEventMoveContext, e: MouseEvent): boolean {
  const graph = ctx.deps.getGraph?.() ?? ctx.deps.graph;
  const getActiveTool = () => ctx.deps.getActiveTool?.() ?? ctx.deps.activeTool;
  const getIsSpacePressed = () => ctx.deps.getIsSpacePressed?.() ?? ctx.deps.isSpacePressed;

  if (ctx.deps.uiElementManager.isAnyUIActive() && e.target === ctx.deps.canvas) {
    ctx.deps.uiElementManager.hideAllExceptSignalPicker();
  }
  const mouseX = e.clientX;
  const mouseY = e.clientY;

  const connForward = (e as MouseEvent & { _connectionClickForward?: string })._connectionClickForward;
  if (connForward && ctx.deps.interactionManager && getActiveTool() === 'cursor') {
    const event = ctx.deps.createInteractionEvent(InteractionType.NodeSelect, e, connForward);
    if (ctx.deps.interactionManager.start(event)) return true;
  }

  const typeLabelHit = ctx.deps.hitTestManager.hitTestTypeLabel(mouseX, mouseY);
  if (typeLabelHit && !getIsSpacePressed() && getActiveTool() === 'cursor') {
    e.preventDefault();
    e.stopPropagation();
    ctx.deps.onTypeLabelClick?.(typeLabelHit.portType, typeLabelHit.screenX, typeLabelHit.screenY, typeLabelHit.typeLabelBounds);
    return true;
  }

  const paramHitForMode = ctx.deps.hitTestManager.hitTestParameter(mouseX, mouseY);
  if (paramHitForMode?.isModeButton && !getIsSpacePressed()) {
    const node = graph.nodes.find(n => n.id === paramHitForMode.nodeId);
    const spec = ctx.deps.nodeSpecs.get(node?.type ?? '');
    if (node && spec) {
      const paramSpec = spec.parameters[paramHitForMode.paramName];
      if (paramSpec && paramSpec.type === 'float') {
        const modes: ParameterInputMode[] = ['override', 'add', 'subtract', 'multiply'];
        const currentMode = node.parameterInputModes?.[paramHitForMode.paramName] ?? paramSpec.inputMode ?? 'override';
        const nextMode = modes[(modes.indexOf(currentMode) + 1) % modes.length];
        if (!node.parameterInputModes) node.parameterInputModes = {};
        node.parameterInputModes[paramHitForMode.paramName] = nextMode;
        ctx.deps.onParameterInputModeChanged?.(paramHitForMode.nodeId, paramHitForMode.paramName, nextMode);
        ctx.deps.handlerContext.render();
        return true;
      }
    }
  }

  if (ctx.deps.interactionManager && getActiveTool() === 'select') {
    const event = ctx.deps.createInteractionEvent(InteractionType.RectangleSelection, e);
    if (ctx.deps.interactionManager.start(event)) {
      ctx.deps.attachDocumentListeners();
      return true;
    }
  }
  if (ctx.deps.interactionManager && getActiveTool() === 'hand') {
    const event = ctx.deps.createInteractionEvent(InteractionType.CanvasPan, e);
    if (ctx.deps.interactionManager.start(event)) {
      ctx.deps.attachDocumentListeners();
      return true;
    }
  }
  if (ctx.deps.interactionManager && getActiveTool() === 'cursor') {
    const bezierHit = ctx.deps.hitTestManager.hitTestBezierControlPoint(mouseX, mouseY);
    if (bezierHit && !getIsSpacePressed()) {
      const event = ctx.deps.createInteractionEvent(InteractionType.BezierControlDrag, e, bezierHit);
      if (ctx.deps.interactionManager.start(event)) return true;
    }
  }

  if (ctx.deps.uiElementManager.isEnumDropdownVisible()) return false;
  if (ctx.deps.uiElementManager.isColorPickerVisible()) return false;

  if (getActiveTool() === 'cursor' && ctx.deps.onParameterChanged) {
    const buttonHit = ctx.deps.hitTestManager.hitTestColorMapRowButtons(mouseX, mouseY);
    if (buttonHit) {
      e.preventDefault();
      e.stopPropagation();
      const node = graph.nodes.find(n => n.id === buttonHit.nodeId);
      const spec = ctx.deps.nodeSpecs.get(node?.type ?? '');
      const layout = spec?.parameterLayout?.elements;
      const el = layout?.[buttonHit.elementIndex] as { type?: string; pickers?: [[string, string, string], [string, string, string]] } | undefined;
      if (node && spec && el?.pickers?.length === 2) {
        if (buttonHit.button === 'swap') {
          const [[sL, sC, sH], [eL, eC, eH]] = el.pickers;
          const getVal = (p: string) => (node.parameters[p] ?? spec.parameters[p]?.default ?? 0) as number;
          const startL = getVal(sL), startC = getVal(sC), startH = getVal(sH);
          const endL = getVal(eL), endC = getVal(eC), endH = getVal(eH);
          ctx.deps.onParameterChanged?.(buttonHit.nodeId, sL, endL);
          ctx.deps.onParameterChanged?.(buttonHit.nodeId, sC, endC);
          ctx.deps.onParameterChanged?.(buttonHit.nodeId, sH, endH);
          ctx.deps.onParameterChanged?.(buttonHit.nodeId, eL, startL);
          ctx.deps.onParameterChanged?.(buttonHit.nodeId, eC, startC);
          ctx.deps.onParameterChanged?.(buttonHit.nodeId, eH, startH);
        } else {
          const current = (node.parameters.reverseHue ?? spec.parameters?.reverseHue?.default ?? 0) as number;
          ctx.deps.onParameterChanged?.(buttonHit.nodeId, 'reverseHue', current > 0 ? 0 : 1);
        }
        ctx.deps.handlerContext.render();
      }
      return true;
    }
  }

  if (getActiveTool() === 'cursor' && ctx.deps.handleColorPickerClick) {
    const colorPickerHit = ctx.deps.hitTestManager.hitTestColorPicker(mouseX, mouseY);
    if (colorPickerHit) {
      e.preventDefault();
      e.stopPropagation();
      ctx.deps.handleColorPickerClick(colorPickerHit.nodeId, mouseX, mouseY);
      return true;
    }
  }

  if (ctx.deps.interactionManager && getActiveTool() === 'cursor') {
    const paramHit = ctx.deps.hitTestManager.hitTestParameter(mouseX, mouseY);
    if (paramHit && !getIsSpacePressed()) {
      if (paramHit.isString) {
        ctx.deps.handleFileParameterClick(paramHit.nodeId, paramHit.paramName, mouseX, mouseY);
        return true;
      }
      if (paramHit.frequencyBand != null && paramHit.scale != null) {
        const node = graph.nodes.find(n => n.id === paramHit.nodeId);
        if (!node) return false;
        const raw = node.parameters[paramHit.paramName];
        const bands: number[][] = Array.isArray(raw)
          ? (raw as number[][]).map(b => (Array.isArray(b) && b.length >= 2 ? [Number(b[0]) ?? FREQ_MIN, Number(b[1]) ?? FREQ_MAX] : [FREQ_MIN, FREQ_MAX]))
          : [];
        const band = bands[paramHit.frequencyBand.bandIndex] ?? [FREQ_MIN, FREQ_MAX];
        const idx = paramHit.frequencyBand.field === 'start' || paramHit.frequencyBand.field === 'sliderLow' ? 0 : 1;
        const currentHz = Number(band[idx]) ?? (idx === 0 ? FREQ_MIN : FREQ_MAX);
        ctx.setState({
          interaction: {
            isDraggingParameter: true,
            draggingParameterNodeId: paramHit.nodeId,
            draggingParameterName: paramHit.paramName,
            dragParamStartX: mouseX,
            dragParamStartY: mouseY,
            dragParamStartValue: currentHz,
            draggingFrequencyBand: { ...paramHit.frequencyBand, scale: paramHit.scale }
          }
        });
        ctx.deps.canvas.style.cursor = (paramHit.frequencyBand.field === 'sliderLow' || paramHit.frequencyBand.field === 'sliderHigh') ? 'ew-resize' : 'ns-resize';
        return true;
      }
      const node = graph.nodes.find(n => n.id === paramHit.nodeId);
      const spec = ctx.deps.nodeSpecs.get(node?.type ?? '');
      if (node && spec) {
        const paramSpec = spec.parameters[paramHit.paramName];
        if (paramSpec && isEnumParameter(spec.id, paramHit.paramName)) {
          e.preventDefault();
          e.stopPropagation();
          ctx.deps.handleEnumParameterClick(paramHit.nodeId, paramHit.paramName, mouseX, mouseY);
          return true;
        }
      }
      const modeHit = ctx.deps.hitTestManager.hitTestParameterMode(mouseX, mouseY);
      if (modeHit && modeHit.nodeId === paramHit.nodeId && modeHit.paramName === paramHit.paramName) {
        const modeNode = graph.nodes.find(n => n.id === modeHit.nodeId);
        const modeSpec = ctx.deps.nodeSpecs.get(modeNode?.type ?? '');
        if (modeNode && modeSpec) {
          const modeParamSpec = modeSpec.parameters[modeHit.paramName];
          if (modeParamSpec?.type === 'float') {
            const modes: ParameterInputMode[] = ['override', 'add', 'subtract', 'multiply'];
            const currentMode = modeNode.parameterInputModes?.[modeHit.paramName] ?? modeParamSpec.inputMode ?? 'override';
            const nextMode = modes[(modes.indexOf(currentMode) + 1) % modes.length];
            if (!modeNode.parameterInputModes) modeNode.parameterInputModes = {};
            modeNode.parameterInputModes[modeHit.paramName] = nextMode;
            ctx.deps.onParameterInputModeChanged?.(modeHit.nodeId, modeHit.paramName, nextMode);
            ctx.deps.handlerContext.render();
            return true;
          }
        }
      }
      const event = ctx.deps.createInteractionEvent(InteractionType.ParameterDrag, e, paramHit);
      if (ctx.deps.interactionManager.start(event)) return true;
      if (node && spec) {
        const paramSpec = spec.parameters[paramHit.paramName];
        if (!paramSpec) return false;
        const isToggle = paramSpec.type === 'int' && paramSpec.min === 0 && paramSpec.max === 1;
        if (isToggle) {
          const currentValue = (node.parameters[paramHit.paramName] ?? paramSpec.default) as number;
          ctx.flushParameterChangeAndRender(paramHit.nodeId, paramHit.paramName, currentValue === 1 ? 0 : 1);
          return true;
        }
        if (paramSpec.type === 'float' || paramSpec.type === 'int') {
          ctx.setState({
            interaction: {
              isDraggingParameter: true,
              draggingParameterNodeId: paramHit.nodeId,
              draggingParameterName: paramHit.paramName,
              dragParamStartY: mouseY,
              dragParamStartValue: (node.parameters[paramHit.paramName] ?? paramSpec.default) as number
            }
          });
          ctx.deps.canvas.style.cursor = 'ns-resize';
          return true;
        }
      }
    }
  }

  if (ctx.deps.interactionManager && getActiveTool() === 'cursor') {
    const portHit = ctx.deps.hitTestManager.hitTestPort(mouseX, mouseY);
    if (portHit) {
      const event = ctx.deps.createInteractionEvent(InteractionType.PortConnect, e, portHit);
      if (ctx.deps.interactionManager.start(event)) {
        ctx.deps.attachDocumentListeners();
        return true;
      }
    }
  }

  if (ctx.deps.interactionManager && getActiveTool() === 'cursor') {
    const nodeHit = ctx.deps.hitTestManager.hitTestNode(mouseX, mouseY);
    if (nodeHit && !getIsSpacePressed()) {
      const event = ctx.deps.createInteractionEvent(InteractionType.NodeDrag, e, nodeHit);
      if (ctx.deps.interactionManager.start(event)) {
        ctx.deps.attachDocumentListeners();
        return true;
      }
    }
  }

  if (ctx.deps.interactionManager && getActiveTool() === 'cursor') {
    const connHit = ctx.deps.hitTestManager.hitTestConnection(mouseX, mouseY);
    if (connHit) {
      const event = ctx.deps.createInteractionEvent(InteractionType.NodeSelect, e, connHit);
      if (ctx.deps.interactionManager.start(event)) return true;
    }
  }

  if (ctx.deps.interactionManager && getActiveTool() === 'cursor') {
    const isSpacePressed = getIsSpacePressed();
    const isMiddleMouse = e.button === 1;
    const isLeftClickOnEmpty = e.button === 0;
    if (isSpacePressed || isMiddleMouse || isLeftClickOnEmpty) {
      const event = ctx.deps.createInteractionEvent(InteractionType.CanvasPan, e);
      if (ctx.deps.interactionManager.start(event)) {
        ctx.deps.attachDocumentListeners();
        if (isLeftClickOnEmpty && !isSpacePressed) {
          const selection = ctx.deps.getSelectionState();
          if (selection.selectedConnectionIds.size > 0) {
            ctx.deps.renderState.markConnectionsDirty(Array.from(selection.selectedConnectionIds));
          }
          if (selection.selectedNodeIds.size > 0) {
            ctx.deps.renderState.markNodesDirty(Array.from(selection.selectedNodeIds));
          }
          ctx.deps.selectionManager.clear();
          ctx.deps.onNodeSelected?.(null, false);
          ctx.deps.handlerContext.render();
        }
        return true;
      }
    }
  }

  return false;
}
