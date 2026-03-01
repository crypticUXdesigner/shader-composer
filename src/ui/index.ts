/**
 * UI public API. Re-exports editor (canvas + rendering) so lib can import from '../ui' or '../ui/editor'.
 */
export {
  NodeEditorCanvas,
  CopyPasteManager,
  UndoRedoManager,
  NodeRenderer,
  type NodeRenderMetrics,
  getParameterUIRegistry,
  ParameterUIRegistry,
  getPortTypeDisplayLabel,
  type RenderLayer
} from './editor';
