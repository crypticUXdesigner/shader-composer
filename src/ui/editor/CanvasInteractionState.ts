/**
 * CanvasInteractionState - Holds pan and interaction drag state for the node editor canvas.
 * Extracted from NodeEditorCanvas to reduce its size and centralize interaction state.
 */

export interface PanState {
  isPanning: boolean;
  potentialBackgroundPan: boolean;
  panStartX: number;
  panStartY: number;
  backgroundDragStartX: number;
  backgroundDragStartY: number;
}

export interface InteractionState {
  isDraggingNode: boolean;
  draggingNodeId: string | null;
  draggingNodeInitialPos: { x: number; y: number } | null;
  selectedNodesInitialPositions: Map<string, { x: number; y: number }>;
  isDraggingParameter: boolean;
  draggingParameterNodeId: string | null;
  draggingParameterName: string | null;
  dragParamStartX: number;
  dragParamStartY: number;
  dragParamStartValue: number;
  draggingFrequencyBand: {
    bandIndex: number;
    field: 'start' | 'end' | 'sliderLow' | 'sliderHigh';
    scale: 'linear' | 'audio';
  } | null;
  isDraggingBezierControl: boolean;
  draggingBezierNodeId: string | null;
  draggingBezierControlIndex: number | null;
  dragBezierStartValues: { x1: number; y1: number; x2: number; y2: number } | null;
  potentialNodeDrag: boolean;
  potentialNodeDragId: string | null;
  nodeDragStartX: number;
  nodeDragStartY: number;
  dragOffsetX: number;
  dragOffsetY: number;
}

export class CanvasInteractionState {
  private pan: PanState = {
    isPanning: false,
    potentialBackgroundPan: false,
    panStartX: 0,
    panStartY: 0,
    backgroundDragStartX: 0,
    backgroundDragStartY: 0
  };

  private interaction: InteractionState = {
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
    potentialNodeDragId: null,
    nodeDragStartX: 0,
    nodeDragStartY: 0,
    dragOffsetX: 0,
    dragOffsetY: 0
  };

  private currentMouseX: number = 0;
  private currentMouseY: number = 0;

  getPanState(): PanState {
    return { ...this.pan };
  }

  setPanState(state: Partial<PanState>): void {
    if (state.isPanning !== undefined) this.pan.isPanning = state.isPanning;
    if (state.potentialBackgroundPan !== undefined) this.pan.potentialBackgroundPan = state.potentialBackgroundPan;
    if (state.panStartX !== undefined) this.pan.panStartX = state.panStartX;
    if (state.panStartY !== undefined) this.pan.panStartY = state.panStartY;
    if (state.backgroundDragStartX !== undefined) this.pan.backgroundDragStartX = state.backgroundDragStartX;
    if (state.backgroundDragStartY !== undefined) this.pan.backgroundDragStartY = state.backgroundDragStartY;
  }

  getInteractionState(): InteractionState {
    return {
      ...this.interaction,
      selectedNodesInitialPositions: new Map(this.interaction.selectedNodesInitialPositions)
    };
  }

  setInteractionState(state: Partial<InteractionState>): void {
    if (state.isDraggingNode !== undefined) this.interaction.isDraggingNode = state.isDraggingNode;
    if (state.draggingNodeId !== undefined) this.interaction.draggingNodeId = state.draggingNodeId;
    if (state.draggingNodeInitialPos !== undefined) this.interaction.draggingNodeInitialPos = state.draggingNodeInitialPos;
    if (state.selectedNodesInitialPositions !== undefined) this.interaction.selectedNodesInitialPositions = state.selectedNodesInitialPositions;
    if (state.isDraggingParameter !== undefined) this.interaction.isDraggingParameter = state.isDraggingParameter;
    if (state.draggingParameterNodeId !== undefined) this.interaction.draggingParameterNodeId = state.draggingParameterNodeId;
    if (state.draggingParameterName !== undefined) this.interaction.draggingParameterName = state.draggingParameterName;
    if (state.dragParamStartX !== undefined) this.interaction.dragParamStartX = state.dragParamStartX;
    if (state.dragParamStartY !== undefined) this.interaction.dragParamStartY = state.dragParamStartY;
    if (state.dragParamStartValue !== undefined) this.interaction.dragParamStartValue = state.dragParamStartValue;
    if (state.draggingFrequencyBand !== undefined) this.interaction.draggingFrequencyBand = state.draggingFrequencyBand;
    if (state.isDraggingBezierControl !== undefined) this.interaction.isDraggingBezierControl = state.isDraggingBezierControl;
    if (state.draggingBezierNodeId !== undefined) this.interaction.draggingBezierNodeId = state.draggingBezierNodeId;
    if (state.draggingBezierControlIndex !== undefined) this.interaction.draggingBezierControlIndex = state.draggingBezierControlIndex;
    if (state.dragBezierStartValues !== undefined) this.interaction.dragBezierStartValues = state.dragBezierStartValues;
    if (state.potentialNodeDrag !== undefined) this.interaction.potentialNodeDrag = state.potentialNodeDrag;
    if (state.potentialNodeDragId !== undefined) this.interaction.potentialNodeDragId = state.potentialNodeDragId;
    if (state.nodeDragStartX !== undefined) this.interaction.nodeDragStartX = state.nodeDragStartX;
    if (state.nodeDragStartY !== undefined) this.interaction.nodeDragStartY = state.nodeDragStartY;
    if (state.dragOffsetX !== undefined) this.interaction.dragOffsetX = state.dragOffsetX;
    if (state.dragOffsetY !== undefined) this.interaction.dragOffsetY = state.dragOffsetY;
  }

  updateMousePosition(x: number, y: number): void {
    this.currentMouseX = x;
    this.currentMouseY = y;
  }

  getCurrentMouse(): { x: number; y: number } {
    return { x: this.currentMouseX, y: this.currentMouseY };
  }
}
