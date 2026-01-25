/**
 * Interaction Types
 * 
 * Defines the types of interactions that can occur in the node editor.
 * Used by InteractionManager to route events to appropriate handlers.
 */

export enum InteractionType {
  NodeDrag,
  PortConnect,
  ParameterDrag,
  CanvasPan,
  CanvasZoom,
  NodeSelect,
  ConnectionDelete,
  BezierControlDrag,
  ParameterModeChange,
  NodeDelete,
  LabelEdit,
  RectangleSelection
}
