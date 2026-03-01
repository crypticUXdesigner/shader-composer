/**
 * Context passed to hit-test helper functions. Mirrors HitTestManager's dependencies/state.
 */

import type { NodeGraph } from '../../../../data-model/types';
import type { NodeSpec } from '../../../../types/nodeSpec';
import type { NodeRenderMetrics } from '../../NodeRenderer';
import type { ViewStateManager } from '../ViewStateManager';

export interface HitTestContext {
  graph: NodeGraph;
  nodeSpecs: Map<string, NodeSpec>;
  nodeMetrics: Map<string, NodeRenderMetrics>;
  screenToCanvas: (screenX: number, screenY: number) => { x: number; y: number };
  getViewState: () => { panX: number; panY: number; zoom: number };
  ctx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  viewStateManager: ViewStateManager;
  getParamPortPositionsFromDOM?: () => Map<string, { x: number; y: number }>;
  getHeaderOutputPortPositionsFromDOM?: () => Map<string, { x: number; y: number }>;
  getConnectionHitTestRect?: () => DOMRect;
}
