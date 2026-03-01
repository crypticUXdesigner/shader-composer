/**
 * Editor public API: canvas, rendering, and editor-level exports.
 * Lib and other ui code should import from '../ui/editor' or '../ui'.
 */

export { NodeEditorCanvas } from './NodeEditorCanvas';
export { CopyPasteManager } from './CopyPasteManager';
export { UndoRedoManager } from './UndoRedoManager';
export { NodeRenderer, type NodeRenderMetrics } from './NodeRenderer';
export { getParameterUIRegistry, ParameterUIRegistry } from './rendering/ParameterUIRegistry';
export { getPortTypeDisplayLabel } from './rendering/RenderingUtils';
export type { RenderLayer } from './rendering/RenderState';
