// Node Editor Canvas Component
// Implements infinite canvas with pan/zoom, grid, and node/connection rendering

import type { NodeGraph, NodeInstance, Connection } from '../../types/nodeGraph';
import type { NodeSpec } from '../../types/nodeSpec';
import { NodeRenderer, type NodeRenderMetrics } from './NodeRenderer';
import { getCSSColor, getCSSVariableAsNumber, getCSSVariable, getCSSColorRGBA } from '../../utils/cssTokens';
import { computeEffectiveParameterValue } from '../../utils/parameterValueCalculator';
import type { AudioManager } from '../../runtime/AudioManager';
import { RenderState, RenderLayer } from './rendering/RenderState';
// Feature flags removed - all refactored features are now always enabled
import { isRectVisible, type Viewport } from '../../utils/viewport';
import { NodeComponent } from './node/NodeComponent';
import { LayerManager } from './rendering/LayerManager';
import {
  GridLayerRenderer,
  ConnectionLayerRenderer,
  ParameterConnectionLayerRenderer,
  NodeLayerRenderer,
  PortLayerRenderer,
  OverlayLayerRenderer
} from './rendering/layers';
import type { HandlerContext } from '../interactions/HandlerContext';
import { InteractionManager } from '../interactions/InteractionManager';
import { InteractionType } from '../interactions/InteractionTypes';
import type { InteractionEvent } from '../interactions/InteractionHandler';
import {
  CanvasPanHandler,
  CanvasZoomHandler,
  NodeDragHandler,
  PortConnectHandler,
  ParameterDragHandler,
  BezierControlDragHandler,
  ConnectionSelectHandler,
  HandToolHandler,
  SelectionToolHandler
} from '../interactions/handlers';
import type { ToolType } from './BottomBar';
import { DropdownMenu, type DropdownMenuItem } from './DropdownMenu';
import { getParameterUIRegistry } from './rendering/ParameterUIRegistry';
import { FrequencyBandsEditor } from './FrequencyBandsEditor';

export interface CanvasState {
  zoom: number;
  panX: number;
  panY: number;
  selectedNodeIds: Set<string>;
  selectedConnectionIds: Set<string>;
}

export interface CanvasViewport {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class NodeEditorCanvas {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private graph: NodeGraph;
  private state: CanvasState;
  private nodeSpecs: Map<string, NodeSpec> = new Map();
  private nodeRenderer: NodeRenderer;
  private nodeMetrics: Map<string, NodeRenderMetrics> = new Map();
  private nodeComponents: Map<string, NodeComponent> = new Map(); // Phase 2.2: Component system
  private renderState: RenderState;
  private layerManager: LayerManager | null = null; // Phase 2.3: Layer system
  private connectionLayerRenderer: ConnectionLayerRenderer | null = null; // Phase 3.3: For cache invalidation
  private parameterConnectionLayerRenderer: ParameterConnectionLayerRenderer | null = null; // Phase 3.3: For cache invalidation
  private interactionManager: InteractionManager | null = null; // Phase 2.4: Interaction handler system
  private renderRequested: boolean = false;
  private pendingRenderFrame: number | null = null;
  // Frame buffer removed - getImageData/putImageData was too expensive
  // Phase 3.1: Track previous pan/zoom to detect viewport changes (require full redraw)
  private previousPanX: number = 0;
  private previousPanY: number = 0;
  private previousZoom: number = 1.0;
  
  // Resize handling - throttle to animation frame for smooth updates
  private pendingResize: boolean = false;
  private cachedViewportWidth: number = 0;
  private cachedViewportHeight: number = 0;
  
  // Interaction state
  private isPanning: boolean = false;
  // @ts-expect-error - Part of state interface for persistence, but not currently read
  private _panStartX: number = 0;
  // @ts-expect-error - Part of state interface for persistence, but not currently read
  private _panStartY: number = 0;
  private isDraggingNode: boolean = false;
  private draggingNodeId: string | null = null;
  private dragOffsetX: number = 0;
  private dragOffsetY: number = 0;
  private draggingNodeInitialPos: { x: number; y: number } | null = null;
  private selectedNodesInitialPositions: Map<string, { x: number; y: number }> = new Map();
  private isConnecting: boolean = false;
  private connectionStartNodeId: string | null = null;
  private connectionStartPort: string | null = null;
  private connectionStartParameter: string | null = null;
  private connectionStartIsOutput: boolean = false;
  private connectionMouseX: number = 0;
  private connectionMouseY: number = 0;
  private hoveredPort: { nodeId: string, port: string, isOutput: boolean, parameter?: string } | null = null;
  private isSpacePressed: boolean = false;
  private spacePressTimeout: number | null = null;
  private readonly SPACE_PAN_DELAY = 200; // ms - delay before activating pan mode
  private isDraggingParameter: boolean = false;
  private draggingParameterNodeId: string | null = null;
  private draggingParameterName: string | null = null;
  private dragParamStartY: number = 0; // Screen-space Y position
  private dragParamStartValue: number = 0;
  private isDraggingBezierControl: boolean = false;
  private draggingBezierNodeId: string | null = null;
  private draggingBezierControlIndex: number | null = null; // 0 for cp1 (x1,y1), 1 for cp2 (x2,y2)
  private dragBezierStartValues: { x1: number; y1: number; x2: number; y2: number } | null = null;
  private parameterInputElement: HTMLInputElement | null = null;
  private labelInputElement: HTMLInputElement | null = null;
  private enumDropdown: DropdownMenu | null = null;
  private frequencyBandsEditor: FrequencyBandsEditor | null = null;
  private backgroundDragStartX: number = 0;
  private backgroundDragStartY: number = 0;
  private backgroundDragThreshold: number = 5; // pixels
  private potentialBackgroundPan: boolean = false;
  private nodeDragStartX: number = 0;
  private nodeDragStartY: number = 0;
  private nodeDragThreshold: number = 5; // pixels
  private potentialNodeDrag: boolean = false;
  private potentialNodeDragId: string | null = null;
  
  // Smart guides state
  private smartGuides: {
    vertical: Array<{ x: number; startY: number; endY: number }>;
    horizontal: Array<{ y: number; startX: number; endX: number }>;
  } = { vertical: [], horizontal: [] };
  private readonly SNAP_THRESHOLD = 3; // pixels (in canvas space, before zoom) - reduced for less aggressive snapping
  
  // Phase 3.4: Track dragged nodes for metrics recalculation before connection rendering
  private draggedNodeIds: Set<string> = new Set();
  
  // Edge scrolling state
  private edgeScrollAnimationFrame: number | null = null;
  private edgeScrollVelocityX: number = 0;
  private edgeScrollVelocityY: number = 0;
  private currentMouseX: number = 0;
  private currentMouseY: number = 0;
  private readonly EDGE_SCROLL_ZONE = 0.1; // 10% of width/height
  private readonly MAX_EDGE_SCROLL_SPEED = 800; // pixels per second
  
  // Tool state
  private activeTool: ToolType = 'cursor';
  private selectionRectangle: { x: number; y: number; width: number; height: number } | null = null;
  
  // Callbacks
  private onNodeMoved?: (nodeId: string, x: number, y: number) => void;
  private onNodeSelected?: (nodeId: string | null, multiSelect: boolean) => void;
  private onConnectionCreated?: (sourceNodeId: string, sourcePort: string, targetNodeId: string, targetPort?: string, targetParameter?: string) => void;
  private onConnectionSelected?: (connectionId: string | null, multiSelect: boolean) => void;
  private onNodeDeleted?: (nodeId: string) => void;
  private onConnectionDeleted?: (connectionId: string) => void;
  private onParameterChanged?: (nodeId: string, paramName: string, value: number) => void;
  private onFileParameterChanged?: (nodeId: string, paramName: string, file: File) => void;
  private onParameterInputModeChanged?: (nodeId: string, paramName: string, mode: import('../../types/nodeSpec').ParameterInputMode) => void;
  private onNodeLabelChanged?: (nodeId: string, label: string | undefined) => void;
  private onSpacebarStateChange?: (isPressed: boolean) => void;
  private isDialogVisible?: () => boolean;
  private onTypeLabelClick?: (portType: string, screenX: number, screenY: number) => void;
  private audioManager?: AudioManager;
  private effectiveValueUpdateInterval: number | null = null;
  
  constructor(canvas: HTMLCanvasElement, graph: NodeGraph, nodeSpecs: NodeSpec[] = [], audioManager?: AudioManager) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2D context');
    }
    this.ctx = ctx;
    this.graph = graph;
    this.nodeRenderer = new NodeRenderer(ctx);
    
    // Initialize render state for dirty tracking
    this.renderState = new RenderState(graph);
    
    // Store node specs
    for (const spec of nodeSpecs) {
      this.nodeSpecs.set(spec.id, spec);
    }
    
    // Store audio manager reference
    this.audioManager = audioManager;
    
    // Start periodic updates for effective parameter values
    this.startEffectiveValueUpdates();
    
    // Initialize state from graph viewState or defaults
    this.state = {
      zoom: graph.viewState?.zoom ?? 1.0,
      panX: graph.viewState?.panX ?? 0,
      panY: graph.viewState?.panY ?? 0,
      selectedNodeIds: new Set(graph.viewState?.selectedNodeIds ?? []),
      selectedConnectionIds: new Set()
    };
    
    // Initialize refactored systems
    this.setupLayerSystem();
    this.setupInteractionHandlers();
    
    // Initialize previous pan/zoom values
    // Note: FrameBuffer removed - getImageData/putImageData was too expensive
    this.previousPanX = this.state.panX;
    this.previousPanY = this.state.panY;
    this.previousZoom = this.state.zoom;
    
    // Calculate node metrics
    this.updateNodeMetrics();
    
    this.setupEventListeners();
    this.resize();
    
    // Fit to view on initial load if no viewState exists or it's using default values
    const hasCustomViewState = graph.viewState && (
      (graph.viewState.zoom !== undefined && graph.viewState.zoom !== 1.0) ||
      (graph.viewState.panX !== undefined && graph.viewState.panX !== 0) ||
      (graph.viewState.panY !== undefined && graph.viewState.panY !== 0)
    );
    if (!hasCustomViewState && graph.nodes.length > 0) {
      // Use requestAnimationFrame to ensure canvas is sized
      requestAnimationFrame(() => {
        this.fitToView();
      });
    } else {
      this.markFullRedraw();
    }
  }
  
  private updateNodeMetrics(): void {
    this.nodeMetrics.clear();
    for (const node of this.graph.nodes) {
      const spec = this.nodeSpecs.get(node.type);
      if (spec) {
        const metrics = this.nodeRenderer.calculateMetrics(node, spec);
        this.nodeMetrics.set(node.id, metrics);
      }
    }
  }
  
  /**
   * Setup layer system (Phase 2.3)
   */
  private setupLayerSystem(): void {
    this.layerManager = new LayerManager();
    
    // Register grid layer
    this.layerManager.register(new GridLayerRenderer({
      canvas: this.canvas,
      getState: () => ({
        panX: this.state.panX,
        panY: this.state.panY,
        zoom: this.state.zoom
      })
    }));
    
    // Register connection layer
    this.connectionLayerRenderer = new ConnectionLayerRenderer({
      graph: this.graph,
      nodeSpecs: this.nodeSpecs,
      nodeMetrics: this.nodeMetrics,
      selectedConnectionIds: this.state.selectedConnectionIds,
      isConnectionVisible: (conn) => this.isConnectionVisible(conn),
      // Phase 3.4: Recalculate metrics for dragged nodes before rendering connections
      recalculateMetricsForNodes: (nodeIds) => {
        for (const nodeId of nodeIds) {
          const node = this.graph.nodes.find(n => n.id === nodeId);
          if (node) {
            const spec = this.nodeSpecs.get(node.type);
            if (spec) {
              // Recalculate metrics for this node
              const metrics = this.nodeRenderer.calculateMetrics(node, spec);
              this.nodeMetrics.set(nodeId, metrics);
              
              // Update component metrics
              const component = this.nodeComponents.get(nodeId);
              if (component) {
                component.invalidateMetrics();
                component.calculateMetrics();
                this.nodeMetrics.set(nodeId, component.getNodeMetrics());
              }
            }
          }
        }
      },
      getDraggedNodeIds: () => Array.from(this.draggedNodeIds),
      getPanZoom: () => ({ panX: this.state.panX, panY: this.state.panY, zoom: this.state.zoom }),
      renderState: this.renderState
    });
    this.layerManager.register(this.connectionLayerRenderer);
    
    // Register parameter connection layer
    this.parameterConnectionLayerRenderer = new ParameterConnectionLayerRenderer({
      graph: this.graph,
      nodeSpecs: this.nodeSpecs,
      nodeMetrics: this.nodeMetrics,
      selectedConnectionIds: this.state.selectedConnectionIds,
      isConnectionVisible: (conn) => this.isConnectionVisible(conn),
      // Phase 3.4: Recalculate metrics for dragged nodes before rendering connections
      recalculateMetricsForNodes: (nodeIds) => {
        for (const nodeId of nodeIds) {
          const node = this.graph.nodes.find(n => n.id === nodeId);
          if (node) {
            const spec = this.nodeSpecs.get(node.type);
            if (spec) {
              // Recalculate metrics for this node
              const metrics = this.nodeRenderer.calculateMetrics(node, spec);
              this.nodeMetrics.set(nodeId, metrics);
              
              // Update component metrics
              const component = this.nodeComponents.get(nodeId);
              if (component) {
                component.invalidateMetrics();
                component.calculateMetrics();
                this.nodeMetrics.set(nodeId, component.getNodeMetrics());
              }
            }
          }
        }
      },
      getDraggedNodeIds: () => Array.from(this.draggedNodeIds),
      getPanZoom: () => ({ panX: this.state.panX, panY: this.state.panY, zoom: this.state.zoom }),
      renderState: this.renderState
    });
    this.layerManager.register(this.parameterConnectionLayerRenderer);
    
    // Register node layer
    this.layerManager.register(new NodeLayerRenderer({
      graph: this.graph,
      nodeSpecs: this.nodeSpecs,
      nodeMetrics: this.nodeMetrics,
      selectedNodeIds: this.state.selectedNodeIds,
      hoveredPort: this.hoveredPort,
      isConnecting: this.isConnecting,
      connectionStartNodeId: this.connectionStartNodeId,
      connectionStartPort: this.connectionStartPort,
      connectionStartParameter: this.connectionStartParameter,
      audioManager: this.audioManager,
      renderNode: (node, skipPorts) => this.renderNode(node, skipPorts),
      isNodeVisible: (node, metrics) => this.isNodeVisible(node, metrics),
      getPanZoom: () => ({ panX: this.state.panX, panY: this.state.panY, zoom: this.state.zoom }),
      renderState: this.renderState
    }));
    
    // Register port layer
    this.layerManager.register(new PortLayerRenderer({
      graph: this.graph,
      nodeSpecs: this.nodeSpecs,
      nodeMetrics: this.nodeMetrics,
      hoveredPort: this.hoveredPort,
      isConnecting: this.isConnecting,
      connectionStartNodeId: this.connectionStartNodeId,
      connectionStartPort: this.connectionStartPort,
      connectionStartParameter: this.connectionStartParameter,
      renderNodePorts: () => this.renderNodePorts(),
      isNodeVisible: (node, metrics) => this.isNodeVisible(node, metrics)
    }));
    
    // Register overlay layer
    this.layerManager.register(new OverlayLayerRenderer({
      getIsConnecting: () => this.isConnecting,
      getIsDraggingNode: () => {
        // Check both old state and handler state (Phase 2.4)
        // Check if any handler is currently dragging a node
        // Check if smart guides exist (indicates dragging)
        if (this.interactionManager) {
          return this.smartGuides.vertical.length > 0 || this.smartGuides.horizontal.length > 0 || this.isDraggingNode;
        }
        return this.isDraggingNode;
      },
      getSelectionRectangle: () => this.selectionRectangle,
      renderTemporaryConnection: () => this.renderTemporaryConnection(),
      renderSmartGuides: () => this.renderSmartGuides(),
      renderSelectionRectangle: () => this.renderSelectionRectangle()
    }));
  }
  
  /**
   * Setup interaction handler system (Phase 2.4)
   */
  private setupInteractionHandlers(): void {
    this.interactionManager = new InteractionManager();
    const context = this.createHandlerContext();
    
    // Register handlers in priority order (higher priority = checked first)
    // Register node drag handler (priority 50 - highest, most specific)
    this.interactionManager.register(InteractionType.NodeDrag, new NodeDragHandler(context));
    
    // Register port connect handler (priority 45)
    this.interactionManager.register(InteractionType.PortConnect, new PortConnectHandler(context));
    
    // Register parameter drag handler (priority 40)
    this.interactionManager.register(InteractionType.ParameterDrag, new ParameterDragHandler(context));
    
    // Register bezier control drag handler (priority 35)
    this.interactionManager.register(InteractionType.BezierControlDrag, new BezierControlDragHandler(context));
    
    // Register connection select handler (priority 30)
    this.interactionManager.register(InteractionType.NodeSelect, new ConnectionSelectHandler(context));
    
    // Register canvas zoom handler (priority 20)
    this.interactionManager.register(InteractionType.CanvasZoom, new CanvasZoomHandler(context));
    
    // Register hand tool handler (priority 15)
    this.interactionManager.register(InteractionType.CanvasPan, new HandToolHandler(context));
    
    // Register selection tool handler (priority 25)
    this.interactionManager.register(InteractionType.RectangleSelection, new SelectionToolHandler(context));
    
    // Register canvas pan handler (priority 10 - lowest, fallback for empty canvas)
    this.interactionManager.register(InteractionType.CanvasPan, new CanvasPanHandler(context));
  }
  
  /**
   * Convert native mouse/wheel event to InteractionEvent
   */
  private createInteractionEvent(
    type: InteractionType,
    e: MouseEvent | WheelEvent,
    target: any = null
  ): InteractionEvent {
    const rect = this.canvas.getBoundingClientRect();
    const screenX = 'clientX' in e ? e.clientX : rect.left + rect.width / 2;
    const screenY = 'clientY' in e ? e.clientY : rect.top + rect.height / 2;
    
    return {
      type,
      target,
      position: this.screenToCanvas(screenX, screenY),
      screenPosition: { x: screenX, y: screenY },
      modifiers: {
        shift: e.shiftKey,
        ctrl: e.ctrlKey,
        alt: e.altKey,
        meta: e.metaKey
      },
      button: 'button' in e ? e.button : undefined,
      deltaY: 'deltaY' in e ? e.deltaY : undefined,
      originalEvent: e
    };
  }
  
  private resizeObserver: ResizeObserver | null = null;

  private documentMouseMoveHandler: ((e: MouseEvent) => void) | null = null;
  private documentMouseUpHandler: ((e: MouseEvent) => void) | null = null;

  private setupEventListeners(): void {
    // Pan with middle mouse or space + left mouse
    this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    this.canvas.addEventListener('mouseleave', () => this.handleMouseLeave());
    this.canvas.addEventListener('wheel', (e) => this.handleWheel(e));
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    
    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => this.handleKeyDown(e));
    window.addEventListener('keyup', (e) => this.handleKeyUp(e));
    
    // Resize - use ResizeObserver to watch canvas container size changes
    // This handles both window resize and layout changes (e.g., when preview is collapsed)
    // Throttle to animation frame to prevent excessive updates during rapid resizing
    this.resizeObserver = new ResizeObserver(() => {
      this.handleResize();
    });
    this.resizeObserver.observe(this.canvas);
    
    // Initialize cached viewport dimensions
    const initialRect = this.canvas.getBoundingClientRect();
    this.cachedViewportWidth = initialRect.width;
    this.cachedViewportHeight = initialRect.height;
  }
  
  /**
   * Attach document-level mouse listeners for dragging outside canvas
   */
  private attachDocumentListeners(): void {
    if (this.documentMouseMoveHandler || this.documentMouseUpHandler) {
      return; // Already attached
    }
    
    this.documentMouseMoveHandler = (e: MouseEvent) => this.handleMouseMove(e);
    this.documentMouseUpHandler = (e: MouseEvent) => this.handleMouseUp(e);
    
    document.addEventListener('mousemove', this.documentMouseMoveHandler);
    document.addEventListener('mouseup', this.documentMouseUpHandler);
  }
  
  /**
   * Detach document-level mouse listeners
   */
  private detachDocumentListeners(): void {
    if (this.documentMouseMoveHandler) {
      document.removeEventListener('mousemove', this.documentMouseMoveHandler);
      this.documentMouseMoveHandler = null;
    }
    
    if (this.documentMouseUpHandler) {
      document.removeEventListener('mouseup', this.documentMouseUpHandler);
      this.documentMouseUpHandler = null;
    }
  }
  
  /**
   * Handle resize event - marks resize as pending for processing in render loop
   */
  private handleResize(): void {
    // Mark resize as pending - will be processed in next render
    if (!this.pendingResize) {
      this.pendingResize = true;
      this.requestRender();
    }
  }
  
  /**
   * Resize canvas and update viewport
   * Maintains visual center during resize for better UX
   */
  private resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    const oldWidth = this.canvas.width;
    const oldHeight = this.canvas.height;
    
    // Initialize cached dimensions if not set (first resize)
    if (this.cachedViewportWidth === 0 && this.cachedViewportHeight === 0) {
      this.cachedViewportWidth = rect.width;
      this.cachedViewportHeight = rect.height;
    }
    
    const oldViewportWidth = this.cachedViewportWidth;
    const oldViewportHeight = this.cachedViewportHeight;
    
    // Calculate new dimensions
    const newWidth = rect.width * dpr;
    const newHeight = rect.height * dpr;
    const newViewportWidth = rect.width;
    const newViewportHeight = rect.height;
    
    // Cache viewport dimensions for consistent calculations
    this.cachedViewportWidth = newViewportWidth;
    this.cachedViewportHeight = newViewportHeight;
    
    // Optional: Adjust pan to maintain visual center during resize
    // This keeps the content visually centered when window resizes
    if (oldViewportWidth > 0 && oldViewportHeight > 0 && 
        (oldViewportWidth !== newViewportWidth || oldViewportHeight !== newViewportHeight)) {
      // Calculate the canvas point that was at the center of the old viewport
      const oldCenterX = oldViewportWidth / 2;
      const oldCenterY = oldViewportHeight / 2;
      const canvasCenterX = (oldCenterX - this.state.panX) / this.state.zoom;
      const canvasCenterY = (oldCenterY - this.state.panY) / this.state.zoom;
      
      // Calculate new pan to keep same canvas point at center of new viewport
      const newCenterX = newViewportWidth / 2;
      const newCenterY = newViewportHeight / 2;
      this.state.panX = newCenterX - canvasCenterX * this.state.zoom;
      this.state.panY = newCenterY - canvasCenterY * this.state.zoom;
    }
    
    // Only resize if dimensions actually changed
    if (oldWidth !== newWidth || oldHeight !== newHeight) {
      // Setting width/height resets the context, so we need to reapply scale
      this.canvas.width = newWidth;
      this.canvas.height = newHeight;
      // Reset transform and apply device pixel ratio scaling
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.scale(dpr, dpr);
      
      // Canvas resize requires full redraw (context was reset)
      this.renderState.markFullRedraw();
    }
    
    this.pendingResize = false;
  }
  
  // Coordinate conversion
  private screenToCanvas(screenX: number, screenY: number): { x: number, y: number } {
    const rect = this.canvas.getBoundingClientRect();
    // Use cached dimensions for consistency during resize
    const offsetX = screenX - rect.left;
    const offsetY = screenY - rect.top;
    
    const x = (offsetX - this.state.panX) / this.state.zoom;
    const y = (offsetY - this.state.panY) / this.state.zoom;
    return { x, y };
  }
  
  private canvasToScreen(canvasX: number, canvasY: number): { x: number, y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const x = canvasX * this.state.zoom + this.state.panX + rect.left;
    const y = canvasY * this.state.zoom + this.state.panY + rect.top;
    return { x, y };
  }
  
  // Hit testing
  private hitTestNode(mouseX: number, mouseY: number): string | null {
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
  
  private hitTestPort(mouseX: number, mouseY: number): { nodeId: string, port: string, isOutput: boolean, parameter?: string } | null {
    const canvasPos = this.screenToCanvas(mouseX, mouseY);
    const portRadius = getCSSVariableAsNumber('port-radius', 12); // Visual radius (matches CSS)
    const hitMargin = 10; // Increased from 4 to 10 for easier interaction
    const hitRadius = portRadius + hitMargin;
    
    for (const node of this.graph.nodes) {
      const spec = this.nodeSpecs.get(node.type);
      const metrics = this.nodeMetrics.get(node.id);
      if (!spec || !metrics) continue;
      
      // Check parameter input ports (for float/int parameters)
      if (!node.collapsed) {
        for (const [paramName, paramPortPos] of metrics.parameterInputPortPositions.entries()) {
          const paramSpec = spec.parameters[paramName];
          if (paramSpec && (paramSpec.type === 'float' || paramSpec.type === 'int')) {
            const dx = canvasPos.x - paramPortPos.x;
            const dy = canvasPos.y - paramPortPos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < hitRadius) {
              return { nodeId: node.id, port: '', isOutput: false, parameter: paramName };
            }
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
  
  private hitTestConnection(mouseX: number, mouseY: number): string | null {
    const canvasPos = this.screenToCanvas(mouseX, mouseY);
    // Increase hit threshold and make it zoom-aware (12 pixels in screen space)
    const hitThreshold = 12 / this.state.zoom;
    
    for (const conn of this.graph.connections) {
      const sourceNode = this.graph.nodes.find(n => n.id === conn.sourceNodeId);
      const targetNode = this.graph.nodes.find(n => n.id === conn.targetNodeId);
      
      if (!sourceNode || !targetNode) continue;
      
      const sourceSpec = this.nodeSpecs.get(sourceNode.type);
      const targetSpec = this.nodeSpecs.get(targetNode.type);
      const sourceMetrics = this.nodeMetrics.get(sourceNode.id);
      const targetMetrics = this.nodeMetrics.get(targetNode.id);
      
      if (!sourceSpec || !targetSpec || !sourceMetrics || !targetMetrics) continue;
      
      const sourcePortPos = sourceMetrics.portPositions.get(`output:${conn.sourcePort}`);
      
      // Handle parameter connections
      let targetPortPos: { x: number; y: number } | undefined;
      if (conn.targetParameter) {
        targetPortPos = targetMetrics.parameterInputPortPositions.get(conn.targetParameter);
      } else {
        targetPortPos = targetMetrics.portPositions.get(`input:${conn.targetPort}`);
      }
      
      if (!sourcePortPos || !targetPortPos) continue;
      
      // Test bezier curve distance
      if (this.isPointNearBezier(
        canvasPos.x, canvasPos.y,
        sourcePortPos.x, sourcePortPos.y,
        targetPortPos.x, targetPortPos.y,
        hitThreshold
      )) {
        return conn.id;
      }
    }
    
    return null;
  }
  
  private hitTestDeleteButton(mouseX: number, mouseY: number): string | null {
    const canvasPos = this.screenToCanvas(mouseX, mouseY);
    
    for (const node of this.graph.nodes) {
      if (!this.state.selectedNodeIds.has(node.id)) continue;
      
      const metrics = this.nodeMetrics.get(node.id);
      if (!metrics) continue;
      
      const deleteBtnX = node.position.x + metrics.width - 24;
      const deleteBtnY = node.position.y + 4;
      const deleteBtnSize = 20;
      const deleteBtnCenterX = deleteBtnX + deleteBtnSize / 2;
      const deleteBtnCenterY = deleteBtnY + deleteBtnSize / 2;
      
      const dx = canvasPos.x - deleteBtnCenterX;
      const dy = canvasPos.y - deleteBtnCenterY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < deleteBtnSize / 2) {
        return node.id;
      }
    }
    
    return null;
  }
  
  // Special hit test for range editor slider handles
  private hitTestRangeEditorSlider(mouseX: number, mouseY: number): { nodeId: string, paramName: string } | null {
    const canvasPos = this.screenToCanvas(mouseX, mouseY);
    
    for (const node of this.graph.nodes) {
      const spec = this.nodeSpecs.get(node.type);
      const metrics = this.nodeMetrics.get(node.id);
      if (!spec || !metrics || node.collapsed) continue;
      
      // Check if this is a range editor node
      const rangeParams = ['inMin', 'inMax', 'outMin', 'outMax'];
      const hasRangeParams = rangeParams.every(p => spec.parameters[p]?.type === 'float');
      if (!hasRangeParams) continue;
      
      // Get parameter values to calculate handle positions
      const inMin = (node.parameters.inMin ?? spec.parameters.inMin?.default ?? 0) as number;
      const inMax = (node.parameters.inMax ?? spec.parameters.inMax?.default ?? 1) as number;
      const outMin = (node.parameters.outMin ?? spec.parameters.outMin?.default ?? 0) as number;
      const outMax = (node.parameters.outMax ?? spec.parameters.outMax?.default ?? 1) as number;
      
      // Get parameter specs for min/max constraints
      const inMinSpec = spec.parameters.inMin;
      const inMaxSpec = spec.parameters.inMax;
      const outMinSpec = spec.parameters.outMin;
      const outMaxSpec = spec.parameters.outMax;
      const inMinValue = inMinSpec?.min ?? 0;
      const inMaxValue = inMaxSpec?.max ?? 1;
      const outMinValue = outMinSpec?.min ?? 0;
      const outMaxValue = outMaxSpec?.max ?? 1;
      
      // Normalize values to 0-1 range
      const normalizeIn = (v: number) => (inMaxValue - inMinValue > 0) ? (v - inMinValue) / (inMaxValue - inMinValue) : 0;
      const normalizeOut = (v: number) => (outMaxValue - outMinValue > 0) ? (v - outMinValue) / (outMaxValue - outMinValue) : 0;
      const inMinNorm = Math.max(0, Math.min(1, normalizeIn(inMin)));
      const inMaxNorm = Math.max(0, Math.min(1, normalizeIn(inMax)));
      const outMinNorm = Math.max(0, Math.min(1, normalizeOut(outMin)));
      const outMaxNorm = Math.max(0, Math.min(1, normalizeOut(outMax)));
      
      // Calculate slider UI area - use layout system elementMetrics if available
      const gridPadding = getCSSVariableAsNumber('node-body-padding', 18);
      const sliderUIPadding = 12;
      const editorPadding = getCSSVariableAsNumber('range-editor-padding', 12);
      const sliderWidth = getCSSVariableAsNumber('range-editor-slider-width', 18);
      const handleSize = getCSSVariableAsNumber('range-editor-handle-size', 12);
      const topMargin = 12;
      const bottomMargin = 12;
      
      let sliderUIX: number;
      let sliderUIY: number;
      let sliderUIWidth: number;
      let sliderUIHeight: number;
      
      // Check if node uses layout system
      if (spec.parameterLayout && metrics.elementMetrics) {
        // Find slider-ui element in elementMetrics
        let sliderUIElementMetrics = null;
        for (const [element, elementMetrics] of metrics.elementMetrics.entries()) {
          if (element.type === 'slider-ui') {
            sliderUIElementMetrics = elementMetrics;
            break;
          }
        }
        
        if (sliderUIElementMetrics) {
          // Use elementMetrics positions (already in absolute coordinates)
          sliderUIX = sliderUIElementMetrics.x;
          sliderUIY = sliderUIElementMetrics.y;
          sliderUIWidth = sliderUIElementMetrics.width;
          sliderUIHeight = sliderUIElementMetrics.height;
        } else {
          // Fallback to legacy calculation if element not found
          sliderUIHeight = getCSSVariableAsNumber('range-editor-height', 260);
          sliderUIX = node.position.x + gridPadding;
          sliderUIY = node.position.y + metrics.headerHeight + gridPadding;
          sliderUIWidth = metrics.width - gridPadding * 2;
        }
      } else {
        // Legacy calculation for nodes without layout system
        sliderUIHeight = getCSSVariableAsNumber('range-editor-height', 260);
        sliderUIX = node.position.x + gridPadding;
        sliderUIY = node.position.y + metrics.headerHeight + gridPadding;
        sliderUIWidth = metrics.width - gridPadding * 2;
      }
      
      const sliderUIEditorX = sliderUIX + sliderUIPadding;
      const sliderUIEditorY = sliderUIY + sliderUIPadding;
      const sliderUIEditorWidth = sliderUIWidth - sliderUIPadding * 2;
      const sliderHeight = sliderUIHeight - sliderUIPadding * 2 - topMargin - bottomMargin;
      
      // Calculate slider positions
      const inputSliderLeftEdge = sliderUIEditorX + editorPadding;
      const inputSliderCenter = inputSliderLeftEdge + sliderWidth / 2;
      const outputSliderRightEdge = sliderUIEditorX + sliderUIEditorWidth - editorPadding;
      const outputSliderCenter = outputSliderRightEdge - sliderWidth / 2;
      // sliderUIEditorY already includes sliderUIPadding, so we only add topMargin
      const sliderY = sliderUIEditorY + topMargin;
      
      // Check if click is within slider area
      // Make interaction areas zoom-aware so they match visual size
      const handleInteractionRadius = (handleSize / 2 + 10) / this.state.zoom; // Add margin for easier clicking
      const sliderInteractionWidth = (sliderWidth + 20) / this.state.zoom; // Add margin for easier clicking
      
      // Calculate distances to slider centers to determine which slider
      const distToInputSlider = Math.abs(canvasPos.x - inputSliderCenter);
      const distToOutputSlider = Math.abs(canvasPos.x - outputSliderCenter);
      
      // Check if click is near either slider
      const isNearInputSlider = distToInputSlider <= sliderInteractionWidth / 2;
      const isNearOutputSlider = distToOutputSlider <= sliderInteractionWidth / 2;
      
      // Check input slider (left side) - only if closer to input than output
      if (isNearInputSlider && (!isNearOutputSlider || distToInputSlider < distToOutputSlider)) {
        const handleYMin = sliderY + (1 - inMinNorm) * sliderHeight; // Bottom handle (min)
        const handleYMax = sliderY + (1 - inMaxNorm) * sliderHeight; // Top handle (max)
        
        // Check distance to each handle
        const distToMin = Math.abs(canvasPos.y - handleYMin);
        const distToMax = Math.abs(canvasPos.y - handleYMax);
        
        // Determine which handle is closer
        // Top handle (max) should return inMax, bottom handle (min) should return inMin
        if (distToMax <= handleInteractionRadius && distToMax <= distToMin) {
          return { nodeId: node.id, paramName: 'inMax' };
        } else if (distToMin <= handleInteractionRadius && distToMin <= distToMax) {
          return { nodeId: node.id, paramName: 'inMin' };
        }
      }
      
      // Check output slider (right side) - only if closer to output than input
      if (isNearOutputSlider && (!isNearInputSlider || distToOutputSlider < distToInputSlider)) {
        const handleYMin = sliderY + (1 - outMinNorm) * sliderHeight; // Bottom handle (min)
        const handleYMax = sliderY + (1 - outMaxNorm) * sliderHeight; // Top handle (max)
        
        // Check distance to each handle
        const distToMin = Math.abs(canvasPos.y - handleYMin);
        const distToMax = Math.abs(canvasPos.y - handleYMax);
        
        // Determine which handle is closer
        // Top handle (max) should return outMax, bottom handle (min) should return outMin
        if (distToMax <= handleInteractionRadius && distToMax <= distToMin) {
          return { nodeId: node.id, paramName: 'outMax' };
        } else if (distToMin <= handleInteractionRadius && distToMin <= distToMax) {
          return { nodeId: node.id, paramName: 'outMin' };
        }
      }
    }
    
    return null;
  }

  private hitTestParameter(mouseX: number, mouseY: number): { nodeId: string, paramName: string, isString?: boolean, isArray?: boolean } | null {
    // First check for range editor slider handles (priority)
    const rangeSliderHit = this.hitTestRangeEditorSlider(mouseX, mouseY);
    if (rangeSliderHit) {
      return { nodeId: rangeSliderHit.nodeId, paramName: rangeSliderHit.paramName, isString: false };
    }
    
    const canvasPos = this.screenToCanvas(mouseX, mouseY);
    
    for (const node of this.graph.nodes) {
      const spec = this.nodeSpecs.get(node.type);
      const metrics = this.nodeMetrics.get(node.id);
      if (!spec || !metrics || node.collapsed) continue;
      
      // Use parameterGridPositions for the new grid layout
      for (const [paramName, gridPos] of metrics.parameterGridPositions.entries()) {
        const paramSpec = spec.parameters[paramName];
        if (!paramSpec) continue;
        
        // Check if this is an enum parameter - handle before toggle/knob checks
        if (paramSpec.type === 'int') {
          const parameterRegistry = getParameterUIRegistry();
          const renderer = parameterRegistry.getRenderer(spec, paramName);
          if (renderer.getUIType() === 'enum') {
            // For enum parameters, check if click is within the enum selector area
            // Calculate selector position (matching EnumParameterRenderer logic)
            const cellPadding = getCSSVariableAsNumber('param-cell-padding', 12);
            const labelFontSize = getCSSVariableAsNumber('param-label-font-size', 11);
            const selectorHeight = getCSSVariableAsNumber('enum-selector-height', 32);
            const selectorSpacing = getCSSVariableAsNumber('param-label-knob-spacing', 20);
            
            // Position selector below label
            const labelBottom = gridPos.labelY + labelFontSize;
            const selectorY = labelBottom + selectorSpacing;
            const selectorX = gridPos.cellX + cellPadding;
            const selectorWidth = gridPos.cellWidth - cellPadding * 2;
            
            // Check if click is within enum selector area
            if (
              canvasPos.x >= selectorX &&
              canvasPos.x <= selectorX + selectorWidth &&
              canvasPos.y >= selectorY &&
              canvasPos.y <= selectorY + selectorHeight
            ) {
              return { 
                nodeId: node.id, 
                paramName,
                isString: false
              };
            }
            // If it's an enum parameter but click wasn't in selector, continue to next parameter
            continue;
          }
        }
        
        // Check if this is a toggle parameter (int with min 0, max 1) - handle separately
        // This matches the logic in NodeRenderer.isToggleNode
        if (paramSpec.type === 'int' && paramSpec.min === 0 && paramSpec.max === 1) {
          // For toggle parameters, check if click is within the toggle switch area
          // Calculate toggle switch position (matches renderToggle logic - vertically centered)
          const toggleWidth = getCSSVariableAsNumber('toggle-width', 48);
          const toggleHeight = getCSSVariableAsNumber('toggle-height', 24);
          
          const toggleY = gridPos.cellY + gridPos.cellHeight / 2 - toggleHeight / 2;
          const toggleX = gridPos.cellX + gridPos.cellWidth / 2 - toggleWidth / 2; // Centered
          
          // Check if click is within toggle switch area
          if (
            canvasPos.x >= toggleX &&
            canvasPos.x <= toggleX + toggleWidth &&
            canvasPos.y >= toggleY &&
            canvasPos.y <= toggleY + toggleHeight
          ) {
            return { 
              nodeId: node.id, 
              paramName,
              isString: false
            };
          }
        } else if (paramSpec.type === 'float' || paramSpec.type === 'int') {
          const knobSize = getCSSVariableAsNumber('knob-size', 45);
          // Make interaction area larger - use the full knob size plus extra margin
          // This creates a circular area that surrounds the entire knob
          const interactionRadius = knobSize / 2 + 10; // Add 10px margin around the knob
          
          // Check if click is within knob circle
          const dx = canvasPos.x - gridPos.knobX;
          const dy = canvasPos.y - gridPos.knobY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance <= interactionRadius) {
            return { 
              nodeId: node.id, 
              paramName,
              isString: false
            };
          }
          
          // Also check if click is within the value element area (below the knob)
          const valueFontSize = getCSSVariableAsNumber('knob-value-font-size', 11);
          const valuePaddingH = getCSSVariableAsNumber('knob-value-padding-horizontal', 4);
          const valuePaddingV = getCSSVariableAsNumber('knob-value-padding-vertical', 4);
          
          // Calculate value element position (matches rendering code)
          const valueX = gridPos.valueX;
          const valueY = gridPos.valueY;
          
          // Estimate maximum value element width (for typical float values like "-1.000" or "0.000")
          // Using a generous estimate to cover most cases
          const estimatedTextWidth = valueFontSize * 6; // Rough estimate for "0.000" format
          const valueWidth = estimatedTextWidth + valuePaddingH * 2;
          const valueHeight = valueFontSize + valuePaddingV * 2;
          
          // Check if click is within value element rectangle
          if (
            canvasPos.x >= valueX - valueWidth / 2 &&
            canvasPos.x <= valueX + valueWidth / 2 &&
            canvasPos.y >= valueY &&
            canvasPos.y <= valueY + valueHeight
          ) {
            return { 
              nodeId: node.id, 
              paramName,
              isString: false
            };
          }
        } else if (paramSpec.type === 'string') {
          // For string parameters, check if click is in the cell area
          // (string parameters may have file input buttons, etc.)
          if (
            canvasPos.x >= gridPos.cellX &&
            canvasPos.x <= gridPos.cellX + gridPos.cellWidth &&
            canvasPos.y >= gridPos.cellY &&
            canvasPos.y <= gridPos.cellY + gridPos.cellHeight
          ) {
            return { 
              nodeId: node.id, 
              paramName,
              isString: true
            };
          }
        } else if (paramSpec.type === 'array') {
          // For array parameters (like frequencyBands), check if click is in the cell area
          if (
            canvasPos.x >= gridPos.cellX &&
            canvasPos.x <= gridPos.cellX + gridPos.cellWidth &&
            canvasPos.y >= gridPos.cellY &&
            canvasPos.y <= gridPos.cellY + gridPos.cellHeight
          ) {
            return { 
              nodeId: node.id, 
              paramName,
              isArray: true
            };
          }
        }
      }
    }
    
    return null;
  }
  
  private hitTestBezierControlPoint(mouseX: number, mouseY: number): { nodeId: string, controlIndex: number } | null {
    const canvasPos = this.screenToCanvas(mouseX, mouseY);
    
    for (const node of this.graph.nodes) {
      const spec = this.nodeSpecs.get(node.type);
      const metrics = this.nodeMetrics.get(node.id);
      if (!spec || !metrics) continue;
      
      // Check if this is a bezier curve node
      const isBezierNode = spec.id === 'bezier-curve' || (
        spec.parameters.x1 !== undefined &&
        spec.parameters.y1 !== undefined &&
        spec.parameters.x2 !== undefined &&
        spec.parameters.y2 !== undefined
      );
      
      if (!isBezierNode) continue;
      
      // Get bezier editor position from metrics (use x1 parameter position as reference)
      const x1Pos = metrics.parameterGridPositions.get('x1');
      if (!x1Pos) continue;
      
      const bezierEditorX = x1Pos.cellX;
      const bezierEditorY = x1Pos.cellY;
      const bezierEditorWidth = x1Pos.cellWidth;
      const bezierEditorHeight = x1Pos.cellHeight;
      const bezierEditorPadding = getCSSVariableAsNumber('bezier-editor-padding', 12);
      const controlPointSize = getCSSVariableAsNumber('bezier-editor-control-point-size', 8);
      const controlPointHoverSize = getCSSVariableAsNumber('bezier-editor-control-point-hover-size', 12);
      const hitRadius = Math.max(controlPointSize, controlPointHoverSize) / 2 + 4; // Add padding for easier clicking
      
      // Calculate drawing area
      const drawX = bezierEditorX + bezierEditorPadding;
      const drawY = bezierEditorY + bezierEditorPadding;
      const drawWidth = bezierEditorWidth - bezierEditorPadding * 2;
      const drawHeight = bezierEditorHeight - bezierEditorPadding * 2;
      
      // Get parameter values
      const x1 = (node.parameters.x1 ?? spec.parameters.x1?.default ?? 0) as number;
      const y1 = (node.parameters.y1 ?? spec.parameters.y1?.default ?? 0) as number;
      const x2 = (node.parameters.x2 ?? spec.parameters.x2?.default ?? 1) as number;
      const y2 = (node.parameters.y2 ?? spec.parameters.y2?.default ?? 1) as number;
      
      // Convert to screen coordinates (flip Y for screen space)
      const cp1X = drawX + x1 * drawWidth;
      const cp1Y = drawY + (1 - y1) * drawHeight;
      const cp2X = drawX + x2 * drawWidth;
      const cp2Y = drawY + (1 - y2) * drawHeight;
      
      // Check if mouse is near control point 1 (x1, y1)
      const dx1 = canvasPos.x - cp1X;
      const dy1 = canvasPos.y - cp1Y;
      const dist1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
      if (dist1 <= hitRadius) {
        return { nodeId: node.id, controlIndex: 0 };
      }
      
      // Check if mouse is near control point 2 (x2, y2)
      const dx2 = canvasPos.x - cp2X;
      const dy2 = canvasPos.y - cp2Y;
      const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
      if (dist2 <= hitRadius) {
        return { nodeId: node.id, controlIndex: 1 };
      }
    }
    
    return null;
  }
  
  private hitTestHeaderLabel(mouseX: number, mouseY: number): { nodeId: string } | null {
    const canvasPos = this.screenToCanvas(mouseX, mouseY);
    
    for (const node of this.graph.nodes) {
      const spec = this.nodeSpecs.get(node.type);
      const metrics = this.nodeMetrics.get(node.id);
      if (!spec || !metrics) continue;
      
      // Get header dimensions and label position
      const headerHeight = metrics.headerHeight;
      const iconBoxHeight = getCSSVariableAsNumber('node-icon-box-height', 48);
      const iconBoxNameSpacing = getCSSVariableAsNumber('node-icon-box-name-spacing', 4);
      const nameSize = getCSSVariableAsNumber('node-header-name-size', 14);
      const nameWeight = getCSSVariableAsNumber('node-header-name-weight', 600);
      
      // Calculate label position (same as in renderHeader)
      const groupHeight = iconBoxHeight + iconBoxNameSpacing + nameSize;
      const iconBoxY = node.position.y + (headerHeight - groupHeight) / 2;
      const nameY = iconBoxY + iconBoxHeight + iconBoxNameSpacing;
      const iconX = node.position.x + metrics.width / 2;
      
      // Measure text to get label bounds
      this.ctx.font = `${nameWeight} ${nameSize}px "Space Grotesk", sans-serif`;
      const labelText = node.label || spec.displayName;
      const textMetrics = this.ctx.measureText(labelText);
      const textWidth = textMetrics.width;
      const textHeight = nameSize;
      
      // Create hit area around the label (with some padding for easier clicking)
      const padding = 4;
      const labelLeft = iconX - textWidth / 2 - padding;
      const labelRight = iconX + textWidth / 2 + padding;
      const labelTop = nameY - padding;
      const labelBottom = nameY + textHeight + padding;
      
      // Check if click is within label bounds
      if (
        canvasPos.x >= labelLeft &&
        canvasPos.x <= labelRight &&
        canvasPos.y >= labelTop &&
        canvasPos.y <= labelBottom
      ) {
        return { nodeId: node.id };
      }
    }
    
    return null;
  }
  
  private hitTestParameterMode(mouseX: number, mouseY: number): { nodeId: string, paramName: string } | null {
    const canvasPos = this.screenToCanvas(mouseX, mouseY);
    
    for (const node of this.graph.nodes) {
      const spec = this.nodeSpecs.get(node.type);
      const metrics = this.nodeMetrics.get(node.id);
      if (!spec || !metrics || node.collapsed) continue;
      
      // Use parameterGridPositions for the new grid layout
      for (const [paramName, gridPos] of metrics.parameterGridPositions.entries()) {
        const paramSpec = spec.parameters[paramName];
        if (!paramSpec) continue;
        
        // Only check mode selector for float/int parameters (they can have input connections)
        if (paramSpec.type !== 'float' && paramSpec.type !== 'int') continue;
        
        // Mode button is on the left side of the knob, vertically centered with knob, horizontally aligned with port
        const modeButtonSize = getCSSVariableAsNumber('param-mode-button-size', 20);
        const modeButtonX = gridPos.portX; // Same X as port (horizontally aligned with port)
        const modeButtonY = gridPos.knobY; // Same Y as knob center (vertically centered with knob)
        const modeButtonRadius = modeButtonSize / 2;
        
        // Check if click is within the circular mode button area
        const dx = canvasPos.x - modeButtonX;
        const dy = canvasPos.y - modeButtonY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= modeButtonRadius) {
          return { 
            nodeId: node.id, 
            paramName
          };
        }
      }
    }
    
    return null;
  }
  
  /**
   * Hit test for type labels on ports
   * Returns type information if click is on a type badge
   */
  private hitTestTypeLabel(mouseX: number, mouseY: number): { 
    nodeId: string; 
    portName: string; 
    portType: string; 
    isOutput: boolean;
    screenX: number;
    screenY: number;
  } | null {
    const canvasPos = this.screenToCanvas(mouseX, mouseY);
    
    // Get type label dimensions from CSS tokens
    const typeFontSize = getCSSVariableAsNumber('port-type-font-size', 19);
    const typeFontWeight = getCSSVariableAsNumber('port-type-font-weight', 600);
    const typePaddingH = getCSSVariableAsNumber('port-type-padding-horizontal', 8);
    const typePaddingV = getCSSVariableAsNumber('port-type-padding-vertical', 4);
    const portRadius = getCSSVariableAsNumber('port-radius', 12);
    const labelSpacing = getCSSVariableAsNumber('port-label-spacing', 12);
    
    // Set font for text measurement
    this.ctx.font = `${typeFontWeight} ${typeFontSize}px "Space Grotesk", sans-serif`;
    
    for (const node of this.graph.nodes) {
      const spec = this.nodeSpecs.get(node.type);
      const metrics = this.nodeMetrics.get(node.id);
      if (!spec || !metrics) continue;
      
      // Check input ports
      for (const port of spec.inputs) {
        const pos = metrics.portPositions.get(`input:${port.name}`);
        if (!pos) continue;
        
        // Calculate type label position (same as in NodePortRenderer)
        const typeStartX = pos.x + portRadius + labelSpacing;
        const typeWidth = this.ctx.measureText(port.type).width;
        const typeBgWidth = typeWidth + typePaddingH * 2;
        const typeBgHeight = typeFontSize + typePaddingV * 2;
        const typeBgX = typeStartX;
        const typeBgY = pos.y - typeBgHeight / 2;
        
        // Check if click is within type badge bounds
        if (
          canvasPos.x >= typeBgX &&
          canvasPos.x <= typeBgX + typeBgWidth &&
          canvasPos.y >= typeBgY &&
          canvasPos.y <= typeBgY + typeBgHeight
        ) {
          // Convert to screen coordinates for callout positioning
          const rect = this.canvas.getBoundingClientRect();
          const screenX = rect.left + (typeBgX + typeBgWidth / 2) * this.state.zoom + this.state.panX;
          const screenY = rect.top + pos.y * this.state.zoom + this.state.panY;
          
          return {
            nodeId: node.id,
            portName: port.name,
            portType: port.type,
            isOutput: false,
            screenX,
            screenY
          };
        }
      }
      
      // Check output ports
      for (const port of spec.outputs) {
        const pos = metrics.portPositions.get(`output:${port.name}`);
        if (!pos) continue;
        
        // Calculate type label position (output ports have type on the left side)
        const typeEndX = pos.x - portRadius - labelSpacing;
        const typeWidth = this.ctx.measureText(port.type).width;
        const typeBgWidth = typeWidth + typePaddingH * 2;
        const typeBgHeight = typeFontSize + typePaddingV * 2;
        const typeBgX = typeEndX - typeBgWidth;
        const typeBgY = pos.y - typeBgHeight / 2;
        
        // Check if click is within type badge bounds
        if (
          canvasPos.x >= typeBgX &&
          canvasPos.x <= typeBgX + typeBgWidth &&
          canvasPos.y >= typeBgY &&
          canvasPos.y <= typeBgY + typeBgHeight
        ) {
          // Convert to screen coordinates for callout positioning
          const rect = this.canvas.getBoundingClientRect();
          const screenX = rect.left + (typeBgX + typeBgWidth / 2) * this.state.zoom + this.state.panX;
          const screenY = rect.top + pos.y * this.state.zoom + this.state.panY;
          
          return {
            nodeId: node.id,
            portName: port.name,
            portType: port.type,
            isOutput: true,
            screenX,
            screenY
          };
        }
      }
    }
    
    return null;
  }

  // Public method to check if a click is on a parameter (for double-click handling)
  public hitTestParameterAtScreen(screenX: number, screenY: number): { nodeId: string, paramName: string } | null {
    return this.hitTestParameter(screenX, screenY);
  }
  
  // Public method to check if a click is on a type label
  public hitTestTypeLabelAtScreen(screenX: number, screenY: number): { 
    nodeId: string; 
    portName: string; 
    portType: string; 
    isOutput: boolean;
    screenX: number;
    screenY: number;
  } | null {
    return this.hitTestTypeLabel(screenX, screenY);
  }
  
  // Show text input overlay for parameter editing
  public showParameterInput(screenX: number, screenY: number): boolean {
    const paramHit = this.hitTestParameter(screenX, screenY);
    if (!paramHit) return false;
    
    const node = this.graph.nodes.find(n => n.id === paramHit.nodeId);
    const spec = this.nodeSpecs.get(node?.type || '');
    const metrics = this.nodeMetrics.get(paramHit.nodeId);
    if (!node || !spec || !metrics) return false;
    
    const paramSpec = spec.parameters[paramHit.paramName];
    if (!paramSpec || (paramSpec.type !== 'float' && paramSpec.type !== 'int')) return false;
    
    const paramPos = metrics.parameterPositions.get(paramHit.paramName);
    if (!paramPos) return false;
    
    // Get current value
    const currentValue = node.parameters[paramHit.paramName] ?? paramSpec.default;
    const numValue = typeof currentValue === 'number' ? currentValue : 0;
    
    // Calculate screen position for input
    const padding = 8;
    const valueWidth = 50;
    const valueX = paramPos.x + paramPos.width - valueWidth - padding;
    const valueY = paramPos.y;
    
    // Convert canvas position to screen position
    const rect = this.canvas.getBoundingClientRect();
    const screenXPos = rect.left + valueX * this.state.zoom + this.state.panX;
    const screenYPos = rect.top + valueY * this.state.zoom + this.state.panY;
    
    // Remove existing input if any
    this.hideParameterInput();
    
    // Create input element
    const input = document.createElement('input');
    input.type = 'number';
    input.style.position = 'fixed';
    input.style.left = `${screenXPos}px`;
    input.style.top = `${screenYPos}px`;
    input.style.width = `${valueWidth * this.state.zoom}px`;
    input.style.height = `${paramPos.height * this.state.zoom}px`;
    input.style.fontSize = `${12 * this.state.zoom}px`;
    input.style.fontFamily = '"JetBrains Mono", "Courier New", Courier, monospace';
    const inputBorder = getCSSVariable('param-input-border', `2px solid ${getCSSColor('color-blue-90', '#6565dc')}`);
    input.style.border = inputBorder;
    const inputRadius = getCSSVariable('input-radius', '2px');
    input.style.borderRadius = inputRadius;
    input.style.padding = '2px 4px';
    input.style.zIndex = '10000';
    const inputBg = getCSSColor('param-input-bg', getCSSColor('color-gray-20', '#020203'));
    input.style.background = inputBg;
    const inputColor = getCSSColor('param-input-color', getCSSColor('color-gray-130', '#ebeff0'));
    input.style.color = inputColor;
    input.value = paramSpec.type === 'int' ? Math.round(numValue).toString() : numValue.toString();
    
    if (paramSpec.min !== undefined) input.min = String(paramSpec.min);
    if (paramSpec.max !== undefined) input.max = String(paramSpec.max);
    input.step = paramSpec.step !== undefined ? String(paramSpec.step) : 'any';
    
    // Add to document
    document.body.appendChild(input);
    this.parameterInputElement = input;
    
    // Focus and select
    setTimeout(() => {
      input.focus();
      input.select();
    }, 0);
    
    // Track if we've already committed to prevent double-removal
    let isCommitted = false;
    
    // Handle commit
    const commitValue = () => {
      if (isCommitted) return; // Prevent double-commit
      isCommitted = true;
      
      const newValue = paramSpec.type === 'int' 
        ? parseInt(input.value) 
        : parseFloat(input.value);
      
      if (!isNaN(newValue)) {
        // Clamp to min/max if specified
        let clampedValue = newValue;
        if (paramSpec.min !== undefined) clampedValue = Math.max(clampedValue, paramSpec.min);
        if (paramSpec.max !== undefined) clampedValue = Math.min(clampedValue, paramSpec.max);
        
        this.onParameterChanged?.(paramHit.nodeId, paramHit.paramName, clampedValue);
      }
      
      this.hideParameterInput();
      this.hideLabelInput();
    };
    
    // Handle cancel
    const cancelEdit = () => {
      if (isCommitted) return; // Prevent double-removal
      isCommitted = true;
      this.hideParameterInput();
      this.hideLabelInput();
    };
    
    const blurHandler = commitValue;
    const keydownHandler = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitValue();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelEdit();
      }
    };
    
    input.addEventListener('blur', blurHandler);
    input.addEventListener('keydown', keydownHandler);
    
    // Store handlers for cleanup
    (input as any)._blurHandler = blurHandler;
    (input as any)._keydownHandler = keydownHandler;
    
    return true;
  }
  
  // Hide parameter input overlay
  public hideParameterInput(): void {
    if (this.parameterInputElement) {
      const input = this.parameterInputElement;
      
      // Remove event listeners first to prevent them from firing during removal
      const blurHandler = (input as any)._blurHandler;
      const keydownHandler = (input as any)._keydownHandler;
      
      if (blurHandler) {
        input.removeEventListener('blur', blurHandler);
      }
      if (keydownHandler) {
        input.removeEventListener('keydown', keydownHandler);
      }
      
      // Only remove if the element is still in the DOM
      if (input.parentNode) {
        input.remove();
      }
      
      this.parameterInputElement = null;
    }
  }
  
  // Show text input overlay for label editing
  public showLabelInput(screenX: number, screenY: number): boolean {
    const labelHit = this.hitTestHeaderLabel(screenX, screenY);
    if (!labelHit) return false;
    
    const node = this.graph.nodes.find(n => n.id === labelHit.nodeId);
    const spec = this.nodeSpecs.get(node?.type || '');
    const metrics = this.nodeMetrics.get(node?.id || '');
    if (!node || !spec || !metrics) return false;
    
    // Get header dimensions and label position (same as in hitTestHeaderLabel)
    const headerHeight = metrics.headerHeight;
    const iconBoxHeight = getCSSVariableAsNumber('node-icon-box-height', 48);
    const iconBoxNameSpacing = getCSSVariableAsNumber('node-icon-box-name-spacing', 4);
    const nameSize = getCSSVariableAsNumber('node-header-name-size', 14);
    const nameWeight = getCSSVariableAsNumber('node-header-name-weight', 600);
    
    // Calculate label position (same as in renderHeader)
    const groupHeight = iconBoxHeight + iconBoxNameSpacing + nameSize;
    const iconBoxY = node.position.y + (headerHeight - groupHeight) / 2;
    const nameY = iconBoxY + iconBoxHeight + iconBoxNameSpacing;
    const iconX = node.position.x + metrics.width / 2;
    
    // Measure text to get label bounds
    this.ctx.font = `${nameWeight} ${nameSize}px "Space Grotesk", sans-serif`;
    const currentLabelText = node.label || spec.displayName;
    const textMetrics = this.ctx.measureText(currentLabelText);
    const textWidth = Math.max(textMetrics.width, 100); // Minimum width for input
    const textHeight = nameSize;
    
    // Convert canvas position to screen position
    const rect = this.canvas.getBoundingClientRect();
    const labelLeft = iconX - textWidth / 2;
    const screenXPos = rect.left + labelLeft * this.state.zoom + this.state.panX;
    const screenYPos = rect.top + nameY * this.state.zoom + this.state.panY;
    
    // Remove existing input if any
    this.hideLabelInput();
    
    // Create input element
    const input = document.createElement('input');
    input.type = 'text';
    input.style.position = 'fixed';
    input.style.left = `${screenXPos}px`;
    input.style.top = `${screenYPos}px`;
    input.style.width = `${textWidth * this.state.zoom}px`;
    input.style.height = `${(textHeight + 8) * this.state.zoom}px`;
    input.style.fontSize = `${nameSize * this.state.zoom}px`;
    input.style.fontWeight = `${nameWeight}`;
    input.style.fontFamily = '"Space Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif';
    input.style.textAlign = 'center';
    const inputBorder = getCSSVariable('param-input-border', `2px solid ${getCSSColor('color-blue-90', '#6565dc')}`);
    input.style.border = inputBorder;
    const inputRadius = getCSSVariable('input-radius', '2px');
    input.style.borderRadius = inputRadius;
    input.style.padding = `${4 * this.state.zoom}px ${8 * this.state.zoom}px`;
    input.style.zIndex = '10000';
    const inputBg = getCSSColor('param-input-bg', getCSSColor('color-gray-20', '#020203'));
    input.style.background = inputBg;
    const inputColor = getCSSColor('param-input-color', getCSSColor('color-gray-130', '#ebeff0'));
    input.style.color = inputColor;
    input.value = node.label || ''; // Show current label or empty if using default
    
    // Add to document
    document.body.appendChild(input);
    this.labelInputElement = input;
    
    // Focus and select
    setTimeout(() => {
      input.focus();
      input.select();
    }, 0);
    
    // Track if we've already committed to prevent double-removal
    let isCommitted = false;
    
    // Handle commit
    const commitValue = () => {
      if (isCommitted) return; // Prevent double-commit
      isCommitted = true;
      
      const newLabel = input.value.trim();
      
      // Notify that the node label changed (callback will handle the update)
      this.onNodeLabelChanged?.(node.id, newLabel === '' ? undefined : newLabel);
      
      // Update metrics and render (after callback updates the node)
      this.updateNodeMetrics();
      this.render();
      
      this.hideLabelInput();
    };
    
    // Handle cancel
    const cancelEdit = () => {
      if (isCommitted) return; // Prevent double-removal
      isCommitted = true;
      this.hideLabelInput();
    };
    
    const blurHandler = commitValue;
    const keydownHandler = (e: KeyboardEvent) => {
      // Stop propagation to prevent canvas keyboard shortcuts (like Delete/Backspace) from firing
      e.stopPropagation();
      
      if (e.key === 'Enter') {
        e.preventDefault();
        commitValue();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelEdit();
      }
      // Allow Delete and Backspace to work normally in the input field
      // (they won't bubble up to canvas due to stopPropagation)
    };
    
    input.addEventListener('blur', blurHandler);
    input.addEventListener('keydown', keydownHandler);
    
    // Store handlers for cleanup
    (input as any)._blurHandler = blurHandler;
    (input as any)._keydownHandler = keydownHandler;
    
    return true;
  }
  
  // Hide label input overlay
  public hideLabelInput(): void {
    if (this.labelInputElement) {
      const input = this.labelInputElement;
      
      // Remove event listeners first to prevent them from firing during removal
      const blurHandler = (input as any)._blurHandler;
      const keydownHandler = (input as any)._keydownHandler;
      
      if (blurHandler) {
        input.removeEventListener('blur', blurHandler);
      }
      if (keydownHandler) {
        input.removeEventListener('keydown', keydownHandler);
      }
      
      // Only remove if the element is still in the DOM
      if (input.parentNode) {
        input.remove();
      }
      
      this.labelInputElement = null;
    }
  }
  
  private isPointNearBezier(
    px: number, py: number,
    x0: number, y0: number,
    x3: number, y3: number,
    threshold: number
  ): boolean {
    // Bezier control points (strong horizontal movement: 100px offset)
    const cp1X = x0 + 100;
    const cp1Y = y0;
    const cp2X = x3 - 100;
    const cp2Y = y3;
    
    // Calculate curve length to determine appropriate number of samples
    // Use more samples for longer curves to ensure good coverage
    const dx = x3 - x0;
    const dy = y3 - y0;
    const curveLength = Math.sqrt(dx * dx + dy * dy);
    // At least 50 samples, more for longer curves (roughly 1 sample per 10 pixels)
    const samples = Math.max(50, Math.ceil(curveLength / 10));
    
    let minDistance = Infinity;
    
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const point = this.bezierPoint(x0, y0, cp1X, cp1Y, cp2X, cp2Y, x3, y3, t);
      
      const dx = px - point.x;
      const dy = py - point.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      minDistance = Math.min(minDistance, distance);
    }
    
    return minDistance < threshold;
  }
  
  private bezierPoint(
    x0: number, y0: number,
    x1: number, y1: number,
    x2: number, y2: number,
    x3: number, y3: number,
    t: number
  ): { x: number, y: number } {
    const u = 1 - t;
    const tt = t * t;
    const uu = u * u;
    const uuu = uu * u;
    const ttt = tt * t;
    
    return {
      x: uuu * x0 + 3 * uu * t * x1 + 3 * u * tt * x2 + ttt * x3,
      y: uuu * y0 + 3 * uu * t * y1 + 3 * u * tt * y2 + ttt * y3
    };
  }
  
  // Event handlers
  private handleMouseDown(e: MouseEvent): void {
    // Hide parameter input if clicking on canvas (but not on the input itself)
    if (this.parameterInputElement && e.target === this.canvas) {
      this.hideParameterInput();
      this.hideLabelInput();
    }
    const mouseX = e.clientX;
    const mouseY = e.clientY;
    
    // Check for delete button hit first (highest priority)
    const deleteHit = this.hitTestDeleteButton(mouseX, mouseY);
    if (deleteHit) {
      // Clean up NodeComponent if feature flag is enabled (Phase 2.2)
      const component = this.nodeComponents.get(deleteHit);
      if (component) {
        component.unmount();
        this.nodeComponents.delete(deleteHit);
      }
      this.onNodeDeleted?.(deleteHit);
      this.render();
      return;
    }
    
    // Check for type label hit (before port connections to allow clicking type labels)
    const typeLabelHit = this.hitTestTypeLabel(mouseX, mouseY);
    if (typeLabelHit && !this.isSpacePressed && this.activeTool === 'cursor') {
      e.preventDefault();
      e.stopPropagation();
      this.onTypeLabelClick?.(typeLabelHit.portType, typeLabelHit.screenX, typeLabelHit.screenY);
      return;
    }
    
    // Check for parameter mode selector hit (highest priority for parameter area)
    const modeHit = this.hitTestParameterMode(mouseX, mouseY);
    if (modeHit && !this.isSpacePressed) {
      const node = this.graph.nodes.find(n => n.id === modeHit.nodeId);
      const spec = this.nodeSpecs.get(node?.type || '');
      if (node && spec) {
        const paramSpec = spec.parameters[modeHit.paramName];
        if (paramSpec && (paramSpec.type === 'float' || paramSpec.type === 'int')) {
          // Cycle through modes: override -> add -> subtract -> multiply -> override
          const modes: import('../../types/nodeSpec').ParameterInputMode[] = ['override', 'add', 'subtract', 'multiply'];
          const currentMode = node.parameterInputModes?.[modeHit.paramName] || paramSpec.inputMode || 'override';
          const currentIndex = modes.indexOf(currentMode);
          const nextIndex = (currentIndex + 1) % modes.length;
          const nextMode = modes[nextIndex];
          
          // Update the node's parameter input mode
          if (!node.parameterInputModes) {
            node.parameterInputModes = {};
          }
          node.parameterInputModes[modeHit.paramName] = nextMode;
          
          // Notify callback
          this.onParameterInputModeChanged?.(modeHit.nodeId, modeHit.paramName, nextMode);
          
          this.render();
          return;
        }
      }
    }
    
    // Use interaction handler system for tool-specific interactions (check early for priority)
    // Selection tool should work everywhere, even when clicking on nodes/ports
    if (this.interactionManager && this.activeTool === 'select') {
      const event = this.createInteractionEvent(InteractionType.RectangleSelection, e);
      if (this.interactionManager.start(event)) {
        // Attach document-level listeners for dragging outside canvas
        this.attachDocumentListeners();
        return; // Event handled by handler
      }
    }
    
    // Hand tool should also work everywhere
    if (this.interactionManager && this.activeTool === 'hand') {
      const event = this.createInteractionEvent(InteractionType.CanvasPan, e);
      if (this.interactionManager.start(event)) {
        // Attach document-level listeners for dragging outside canvas
        this.attachDocumentListeners();
        return; // Event handled by handler
      }
    }
    
    // Use interaction handler system for bezier control dragging (only for cursor tool)
    if (this.interactionManager && this.activeTool === 'cursor') {
      const bezierHit = this.hitTestBezierControlPoint(mouseX, mouseY);
      if (bezierHit && !this.isSpacePressed) {
        const event = this.createInteractionEvent(InteractionType.BezierControlDrag, e, bezierHit);
        if (this.interactionManager.start(event)) {
          return; // Event handled by handler
        }
      }
    }
    
    // Check if dropdown is open - if so, don't handle other interactions
    if (this.enumDropdown && this.enumDropdown.isVisible()) {
      // Let the dropdown handle clicks (it will close on outside click)
      return;
    }
    
    // Check if frequency bands editor is open - if so, don't handle other interactions
    if (this.frequencyBandsEditor && this.frequencyBandsEditor.isVisible()) {
      // Let the editor handle clicks (it will close on outside click)
      return;
    }
    
    // Use interaction handler system for parameter dragging (only for cursor tool)
    if (this.interactionManager && this.activeTool === 'cursor') {
      const paramHit = this.hitTestParameter(mouseX, mouseY);
      if (paramHit && !this.isSpacePressed) {
        // Handle string parameters (file inputs) specially - not handled by handler
        if (paramHit.isString) {
          this.handleFileParameterClick(paramHit.nodeId, paramHit.paramName, mouseX, mouseY);
          return;
        }
        
        // Handle array parameters (frequency bands) specially - not handled by handler
        if (paramHit.isArray) {
          this.handleFrequencyBandsParameterClick(paramHit.nodeId, paramHit.paramName, mouseX, mouseY);
          return;
        }
        
        // Check if this is an enum parameter - handle dropdown before drag handler
        const node = this.graph.nodes.find(n => n.id === paramHit.nodeId);
        const spec = this.nodeSpecs.get(node?.type || '');
        if (node && spec) {
          const paramSpec = spec.parameters[paramHit.paramName];
          if (paramSpec) {
            const parameterRegistry = getParameterUIRegistry();
            const renderer = parameterRegistry.getRenderer(spec, paramHit.paramName);
            if (renderer.getUIType() === 'enum') {
              // Handle enum parameter - open dropdown menu
              e.preventDefault(); // Prevent default behavior
              e.stopPropagation(); // Prevent other handlers from interfering
              this.handleEnumParameterClick(paramHit.nodeId, paramHit.paramName, mouseX, mouseY);
              return;
            }
          }
        }
        
        const event = this.createInteractionEvent(InteractionType.ParameterDrag, e, paramHit);
        if (this.interactionManager.start(event)) {
          return; // Event handled by handler
        }
        
        // Fallback: legacy parameter handling when interaction manager doesn't handle it
        if (node && spec) {
          const paramSpec = spec.parameters[paramHit.paramName];
          if (!paramSpec) return;
          
          // Check if this is a toggle parameter (int with min 0, max 1)
          // This matches the logic in NodeRenderer.isToggleNode
          const isToggle = paramSpec.type === 'int' && 
            paramSpec.min === 0 && 
            paramSpec.max === 1;
          
          // Handle toggle parameters - toggle on click instead of drag
          if (isToggle) {
            const currentValue = (node.parameters[paramHit.paramName] ?? paramSpec.default) as number;
            const newValue = currentValue === 1 ? 0 : 1;
            this.onParameterChanged?.(paramHit.nodeId, paramHit.paramName, newValue);
            this.render();
            return;
          }
          
          // Handle float/int parameters - drag to adjust
          if (paramSpec.type === 'float' || paramSpec.type === 'int') {
            this.isDraggingParameter = true;
            this.draggingParameterNodeId = paramHit.nodeId;
            this.draggingParameterName = paramHit.paramName;
            // Store screen-space position for consistent drag feel at all zoom levels
            this.dragParamStartY = mouseY;
            this.dragParamStartValue = (node.parameters[paramHit.paramName] ?? paramSpec.default) as number;
            this.canvas.style.cursor = 'ns-resize';
            return;
          }
        }
      }
    }
    
    // Use interaction handler system for port connection (only for cursor tool)
    if (this.interactionManager && this.activeTool === 'cursor') {
      const portHit = this.hitTestPort(mouseX, mouseY);
      if (portHit) {
        const event = this.createInteractionEvent(InteractionType.PortConnect, e, portHit);
        if (this.interactionManager.start(event)) {
          return; // Event handled by handler
        }
      }
    }
    
    // Use interaction handler system for node dragging (only for cursor tool)
    if (this.interactionManager && this.activeTool === 'cursor') {
      const nodeHit = this.hitTestNode(mouseX, mouseY);
      if (nodeHit && !this.isSpacePressed) {
        const event = this.createInteractionEvent(InteractionType.NodeDrag, e, nodeHit);
        if (this.interactionManager.start(event)) {
          // Attach document-level listeners for dragging outside canvas
          this.attachDocumentListeners();
          return; // Event handled by handler
        }
      }
    }
    
    // Use interaction handler system for connection selection (only for cursor tool)
    if (this.interactionManager && this.activeTool === 'cursor') {
      const connHit = this.hitTestConnection(mouseX, mouseY);
      if (connHit) {
        const event = this.createInteractionEvent(InteractionType.NodeSelect, e, connHit);
        if (this.interactionManager.start(event)) {
          return; // Event handled by handler
        }
      }
    }
    
    // Use interaction handler system for canvas panning (fallback for cursor tool)
    if (this.interactionManager && this.activeTool === 'cursor') {
      // Check for panning scenarios: spacebar+drag, middle mouse, or background drag
      const isSpacePressed = this.isSpacePressed;
      const isMiddleMouse = e.button === 1;
      const isLeftClickOnEmpty = e.button === 0;
      
      if (isSpacePressed || isMiddleMouse || isLeftClickOnEmpty) {
        const event = this.createInteractionEvent(InteractionType.CanvasPan, e);
        if (this.interactionManager.start(event)) {
          // Attach document-level listeners for dragging outside canvas
          this.attachDocumentListeners();
          // If spacebar or middle mouse, panning started immediately
          // If left click on empty, potential background pan is set up
          if (isLeftClickOnEmpty && !isSpacePressed) {
            // Deselect all immediately for background pan
            // Mark connections as dirty before clearing so they re-render correctly
            if (this.state.selectedConnectionIds.size > 0) {
              const previouslySelected = Array.from(this.state.selectedConnectionIds);
              this.renderState.markConnectionsDirty(previouslySelected);
            }
            // Mark previously selected nodes as dirty so they re-render without selection border
            if (this.state.selectedNodeIds.size > 0) {
              const previouslySelectedNodes = Array.from(this.state.selectedNodeIds);
              this.renderState.markNodesDirty(previouslySelectedNodes);
            }
            this.state.selectedNodeIds.clear();
            this.state.selectedConnectionIds.clear();
            this.onNodeSelected?.(null, false);
            this.render();
          }
          return; // Event handled by handler
        }
      }
    }
  }
  
  private handleMouseMove(e: MouseEvent): void {
    const mouseX = e.clientX;
    const mouseY = e.clientY;
    
    // If dropdown is open, don't process other interactions
    if (this.enumDropdown && this.enumDropdown.isVisible()) {
      return;
    }
    
    // Store current mouse position for edge scrolling
    this.currentMouseX = mouseX;
    this.currentMouseY = mouseY;
    
    // Use interaction handler system for interaction updates
    if (this.interactionManager) {
      // Always try to update all interaction types in priority order
      // Handlers will check their own state via canHandle() to determine if they're active
      let eventHandled = false;
      
      // Try handlers in priority order (highest first)
      // Node dragging (priority 50)
      const nodeHit = this.hitTestNode(mouseX, mouseY);
      const eventNodeDrag = this.createInteractionEvent(InteractionType.NodeDrag, e, nodeHit);
      if (this.interactionManager.update(eventNodeDrag)) {
        eventHandled = true;
      }
      
      // Port connection (priority 45)
      const portHit = this.hitTestPort(mouseX, mouseY);
      const eventPortConnect = this.createInteractionEvent(InteractionType.PortConnect, e, portHit);
      if (this.interactionManager.update(eventPortConnect)) {
        eventHandled = true;
      }
      
      // Parameter dragging (priority 40)
      const paramHit = this.hitTestParameter(mouseX, mouseY);
      const eventParamDrag = this.createInteractionEvent(InteractionType.ParameterDrag, e, paramHit);
      if (this.interactionManager.update(eventParamDrag)) {
        eventHandled = true;
      }
      
      // Bezier control dragging (priority 35)
      const bezierHit = this.hitTestBezierControlPoint(mouseX, mouseY);
      const eventBezierDrag = this.createInteractionEvent(InteractionType.BezierControlDrag, e, bezierHit);
      if (this.interactionManager.update(eventBezierDrag)) {
        eventHandled = true;
      }
      
      // Rectangle selection (priority 25)
      if (this.activeTool === 'select') {
        const eventSelection = this.createInteractionEvent(InteractionType.RectangleSelection, e);
        if (this.interactionManager.update(eventSelection)) {
          eventHandled = true;
        }
      }
      
      // Panning (priority 10-15)
      const eventPan = this.createInteractionEvent(InteractionType.CanvasPan, e);
      if (this.interactionManager.update(eventPan)) {
        eventHandled = true;
      }
      
      // Update hover states when no active interaction is consuming mouse events
      // This provides visual feedback for ports and parameters
      if (!eventHandled) {
        // Check for port hover (for highlighting)
        const previousHoveredPort = this.hoveredPort;
        if (portHit) {
          this.hoveredPort = portHit;
          this.canvas.style.cursor = 'crosshair';
        } else {
          this.hoveredPort = null;
        }
        
        // Render if hover state changed
        if (previousHoveredPort !== this.hoveredPort) {
          this.requestRender();
        }
        
        // Update cursor based on what's under the mouse
        const bezierHitHover = this.hitTestBezierControlPoint(mouseX, mouseY);
        if (bezierHitHover) {
          this.canvas.style.cursor = 'move';
        } else {
          const modeHit = this.hitTestParameterMode(mouseX, mouseY);
          if (modeHit) {
            this.canvas.style.cursor = 'pointer';
          } else if (portHit) {
            // Port hover already set cursor to crosshair above
          } else if (paramHit) {
            // Check if this is a toggle parameter
            const node = this.graph.nodes.find(n => n.id === paramHit.nodeId);
            const spec = this.nodeSpecs.get(node?.type || '');
            if (node && spec) {
              const paramSpec = spec.parameters[paramHit.paramName];
              const isToggle = paramSpec && paramSpec.type === 'int' && 
                paramSpec.min === 0 && 
                paramSpec.max === 1;
              this.canvas.style.cursor = isToggle ? 'pointer' : 'ns-resize';
            } else {
              this.canvas.style.cursor = 'ns-resize';
            }
          } else if (this.activeTool === 'hand') {
            this.canvas.style.cursor = 'grab';
          } else if (this.activeTool === 'select') {
            this.canvas.style.cursor = 'crosshair';
          } else if (this.isSpacePressed) {
            this.canvas.style.cursor = 'grab';
          } else {
            this.canvas.style.cursor = 'default';
          }
        }
      }
      
      // Continue with edge scrolling and other logic below
    }
    
    // Fallback to old implementation
    // Check if we should start background panning
    if (this.potentialBackgroundPan && !this.isPanning) {
      const dx = mouseX - this.backgroundDragStartX;
      const dy = mouseY - this.backgroundDragStartY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > this.backgroundDragThreshold) {
        // Start panning
        this.isPanning = true;
        this.potentialBackgroundPan = false;
        this._panStartX = this.backgroundDragStartX - this.state.panX;
        this._panStartY = this.backgroundDragStartY - this.state.panY;
        this.canvas.style.cursor = 'grabbing';
      }
    }
    
    // Check if we should start node dragging
    if (this.potentialNodeDrag && !this.isDraggingNode && this.potentialNodeDragId) {
      const dx = mouseX - this.nodeDragStartX;
      const dy = mouseY - this.nodeDragStartY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > this.nodeDragThreshold) {
        // Start dragging
        this.isDraggingNode = true;
        this.draggingNodeId = this.potentialNodeDragId;
        this.potentialNodeDrag = false;
        this.canvas.style.cursor = 'grabbing';
        
        // Store initial positions for multi-node dragging
        const draggedNode = this.graph.nodes.find(n => n.id === this.draggingNodeId);
        if (draggedNode) {
          this.draggingNodeInitialPos = { x: draggedNode.position.x, y: draggedNode.position.y };
          
          // Store initial positions of all selected nodes (including the dragged one)
          this.selectedNodesInitialPositions.clear();
          for (const selectedNodeId of this.state.selectedNodeIds) {
            const selectedNode = this.graph.nodes.find(n => n.id === selectedNodeId);
            if (selectedNode) {
              this.selectedNodesInitialPositions.set(selectedNodeId, {
                x: selectedNode.position.x,
                y: selectedNode.position.y
              });
            }
          }
        }
      }
    }
    
    // Update cursor and port hover state (when not actively dragging)
    if (!this.isPanning && !this.isDraggingNode && !this.isConnecting && !this.isDraggingParameter && !this.isDraggingBezierControl && !this.potentialBackgroundPan && !this.potentialNodeDrag) {
      // Check for port hover (for highlighting)
      const portHit = this.hitTestPort(mouseX, mouseY);
      const previousHoveredPort = this.hoveredPort;
      
      if (portHit) {
        this.hoveredPort = portHit;
        this.canvas.style.cursor = 'crosshair';
      } else {
        this.hoveredPort = null;
      }
      
      // Render if hover state changed
      if (previousHoveredPort !== this.hoveredPort) {
        this.render();
      }
      
      // Check for bezier control point hover (high priority)
      const bezierHit = this.hitTestBezierControlPoint(mouseX, mouseY);
      if (bezierHit) {
        this.canvas.style.cursor = 'move';
      } else {
        // Check for parameter mode selector hover
        const modeHit = this.hitTestParameterMode(mouseX, mouseY);
        if (modeHit) {
          this.canvas.style.cursor = 'pointer';
        } else if (portHit) {
          // Port hover already set cursor to crosshair above
        } else {
          // Check for parameter value hover
          const paramHit = this.hitTestParameter(mouseX, mouseY);
          if (paramHit) {
            // Check if this is a toggle parameter - use pointer cursor for toggles
            const node = this.graph.nodes.find(n => n.id === paramHit.nodeId);
            const spec = this.nodeSpecs.get(node?.type || '');
            if (node && spec) {
              const paramSpec = spec.parameters[paramHit.paramName];
              const isToggle = paramSpec && paramSpec.type === 'int' && 
                paramSpec.min === 0 && 
                paramSpec.max === 1;
              this.canvas.style.cursor = isToggle ? 'pointer' : 'ns-resize';
            } else {
              this.canvas.style.cursor = 'ns-resize';
            }
          } else if (this.activeTool === 'hand') {
            this.canvas.style.cursor = 'grab';
          } else if (this.activeTool === 'select') {
            this.canvas.style.cursor = 'crosshair';
          } else if (this.isSpacePressed) {
            this.canvas.style.cursor = 'grab';
          } else {
            this.canvas.style.cursor = 'default';
          }
        }
      }
    }
    
    // Check for edge scrolling when dragging nodes or connections
    const shouldEdgeScroll = (this.isDraggingNode || this.isConnecting) && !this.isPanning;
    if (shouldEdgeScroll) {
      this.updateEdgeScrollVelocity(mouseX, mouseY);
      this.startEdgeScrolling();
    } else {
      this.stopEdgeScrolling();
    }
    
    // Panning and node dragging are handled by InteractionManager
    // Old fallback code removed - handlers are always used
    if (this.isDraggingNode && this.draggingNodeId && this.draggingNodeInitialPos) {
      const node = this.graph.nodes.find(n => n.id === this.draggingNodeId)!;
      const canvasPos = this.screenToCanvas(mouseX - this.dragOffsetX, mouseY - this.dragOffsetY);
      
      // Calculate smart guides and snap position for the primary dragged node
      const { snappedX, snappedY, guides } = this.calculateSmartGuides(node, canvasPos.x, canvasPos.y);
      
      // Calculate the delta from initial position
      const deltaX = snappedX - this.draggingNodeInitialPos.x;
      const deltaY = snappedY - this.draggingNodeInitialPos.y;
      
      // Move all selected nodes by the same delta
      const movedNodeIds: string[] = [];
      for (const [nodeId, initialPos] of this.selectedNodesInitialPositions.entries()) {
        const selectedNode = this.graph.nodes.find(n => n.id === nodeId);
        if (selectedNode) {
          selectedNode.position.x = Math.round(initialPos.x + deltaX);
          selectedNode.position.y = Math.round(initialPos.y + deltaY);
          
          // Invalidate metrics cache for moved node (port positions depend on node position)
          // Need to invalidate both the local cache and the metrics calculator cache
          this.nodeMetrics.delete(nodeId);
          this.nodeRenderer.invalidateMetrics(nodeId);
          
          // Invalidate NodeComponent metrics cache if component system is enabled (Phase 2.2)
          const component = this.nodeComponents.get(nodeId);
          if (component) {
            component.invalidateMetrics();
          }
          
          this.onNodeMoved?.(nodeId, selectedNode.position.x, selectedNode.position.y);
          movedNodeIds.push(nodeId);
        }
      }
      
      this.smartGuides = guides;
      // Mark moved nodes and all related elements as dirty
      this.renderState.markNodesDirty(movedNodeIds);
      this.renderState.markLayerDirty(RenderLayer.Overlays); // Smart guides render in overlay layer
      
      // Mark all connections connected to moved nodes as dirty (connections need to redraw when endpoints move)
      const connectionsToUpdate: string[] = [];
      for (const nodeId of movedNodeIds) {
        for (const conn of this.graph.connections) {
          if (conn.sourceNodeId === nodeId || conn.targetNodeId === nodeId) {
            connectionsToUpdate.push(conn.id);
          }
        }
      }
      if (connectionsToUpdate.length > 0) {
        this.renderState.markConnectionsDirty(connectionsToUpdate);
      }
      
      // Clear connection path caches when nodes move (port positions change)
      this.connectionLayerRenderer?.clearCache();
      this.parameterConnectionLayerRenderer?.clearCache();
      
      // Mark ports layer as dirty (ports are rendered separately and need to move with nodes)
      this.renderState.markLayerDirty(RenderLayer.Ports);
      this.renderState.markLayerDirty(RenderLayer.Connections);
      this.renderState.markLayerDirty(RenderLayer.ParameterConnections);
      
      this.requestRender();
    } else if (this.isDraggingParameter && this.draggingParameterNodeId && this.draggingParameterName) {
      const node = this.graph.nodes.find(n => n.id === this.draggingParameterNodeId);
      const spec = this.nodeSpecs.get(node?.type || '');
      if (node && spec) {
        const paramSpec = spec.parameters[this.draggingParameterName];
        if (paramSpec && (paramSpec.type === 'float' || paramSpec.type === 'int')) {
          // Calculate delta in screen space (Up = increase, down = decrease)
          const deltaY = this.dragParamStartY - mouseY;
          const modifier = e.shiftKey ? 'fine' : (e.ctrlKey || e.metaKey ? 'coarse' : 'normal');
          
          const min = paramSpec.min ?? 0;
          const max = paramSpec.max ?? 1;
          const range = max - min;
          
          // For range slider parameters, use the actual visual slider height in screen pixels
          // This ensures that dragging the full height of the slider = full range
          const isRangeSliderParam = ['inMin', 'inMax', 'outMin', 'outMax'].includes(this.draggingParameterName || '');
          let baseSensitivity: number;
          
          if (isRangeSliderParam) {
            // Calculate the visual slider height in screen pixels
            const sliderUIHeight = getCSSVariableAsNumber('range-editor-height', 260);
            const sliderUIPadding = 12;
            const topMargin = 12;
            const bottomMargin = 12;
            const sliderHeight = sliderUIHeight - sliderUIPadding * 2 - topMargin - bottomMargin;
            // Convert canvas height to screen pixels
            baseSensitivity = sliderHeight * this.state.zoom;
          } else {
            // For regular parameters, use a default sensitivity
            baseSensitivity = 100;
          }
          
          const multipliers = {
            'normal': 1.0,
            'fine': 0.1,
            'coarse': 10.0
          };
          
          const sensitivity = baseSensitivity / multipliers[modifier];
          const valueDelta = (deltaY / sensitivity) * range;
          const newValue = Math.max(min, Math.min(max, this.dragParamStartValue + valueDelta));
          
          node.parameters[this.draggingParameterName] = newValue;
          
          // Invalidate metrics cache so controls update during drag
          this.nodeMetrics.delete(this.draggingParameterNodeId);
          this.nodeRenderer.invalidateMetrics(this.draggingParameterNodeId);
          const component = this.nodeComponents.get(this.draggingParameterNodeId);
          if (component) {
            component.invalidateMetrics();
          }
          
          this.onParameterChanged?.(this.draggingParameterNodeId, this.draggingParameterName, newValue);
          this.render();
        }
      }
    } else if (this.isDraggingBezierControl && this.draggingBezierNodeId !== null && this.draggingBezierControlIndex !== null && this.dragBezierStartValues) {
      const node = this.graph.nodes.find(n => n.id === this.draggingBezierNodeId);
      const spec = this.nodeSpecs.get(node?.type || '');
      const metrics = this.nodeMetrics.get(node?.id || '');
      if (node && spec && metrics) {
        // Get bezier editor position
        const x1Pos = metrics.parameterGridPositions.get('x1');
        if (!x1Pos) return;
        
        const bezierEditorX = x1Pos.cellX;
        const bezierEditorY = x1Pos.cellY;
        const bezierEditorWidth = x1Pos.cellWidth;
        const bezierEditorHeight = x1Pos.cellHeight;
        const bezierEditorPadding = getCSSVariableAsNumber('bezier-editor-padding', 12);
        
        // Calculate drawing area
        const drawX = bezierEditorX + bezierEditorPadding;
        const drawY = bezierEditorY + bezierEditorPadding;
        const drawWidth = bezierEditorWidth - bezierEditorPadding * 2;
        const drawHeight = bezierEditorHeight - bezierEditorPadding * 2;
        
        // Convert mouse position to canvas coordinates
        const canvasPos = this.screenToCanvas(mouseX, mouseY);
        
        // Calculate new control point position (clamped to editor bounds)
        let newX = (canvasPos.x - drawX) / drawWidth;
        let newY = 1 - (canvasPos.y - drawY) / drawHeight; // Flip Y for parameter space
        
        // Clamp to [0, 1]
        newX = Math.max(0, Math.min(1, newX));
        newY = Math.max(0, Math.min(1, newY));
        
        // Update the appropriate parameters based on control index
        if (this.draggingBezierControlIndex === 0) {
          // Control point 1 (x1, y1)
          node.parameters.x1 = newX;
          node.parameters.y1 = newY;
          this.onParameterChanged?.(this.draggingBezierNodeId, 'x1', newX);
          this.onParameterChanged?.(this.draggingBezierNodeId, 'y1', newY);
        } else if (this.draggingBezierControlIndex === 1) {
          // Control point 2 (x2, y2)
          node.parameters.x2 = newX;
          node.parameters.y2 = newY;
          this.onParameterChanged?.(this.draggingBezierNodeId, 'x2', newX);
          this.onParameterChanged?.(this.draggingBezierNodeId, 'y2', newY);
        }
        
        this.render();
      }
    } else if (this.isConnecting) {
      this.connectionMouseX = mouseX;
      this.connectionMouseY = mouseY;
      // Check if hovering over a valid input port (only if dragging from output)
      if (this.connectionStartIsOutput) {
        const portHit = this.hitTestPort(mouseX, mouseY);
        // Only highlight input ports (not outputs) and not the same node
        if (portHit && !portHit.isOutput && portHit.nodeId !== this.connectionStartNodeId) {
          this.hoveredPort = portHit;
        } else {
          this.hoveredPort = null;
        }
      } else {
        this.hoveredPort = null;
      }
      this.render();
    }
  }
  
  /**
   * Calculate edge scroll velocity based on mouse position
   */
  private updateEdgeScrollVelocity(mouseX: number, mouseY: number): void {
    const rect = this.canvas.getBoundingClientRect();
    const canvasWidth = rect.width;
    const canvasHeight = rect.height;
    const scrollZoneWidth = canvasWidth * this.EDGE_SCROLL_ZONE;
    const scrollZoneHeight = canvasHeight * this.EDGE_SCROLL_ZONE;
    
    // Calculate distance from edges
    const distFromLeft = mouseX - rect.left;
    const distFromRight = rect.right - mouseX;
    const distFromTop = mouseY - rect.top;
    const distFromBottom = rect.bottom - mouseY;
    
    // Calculate velocity for X axis
    let velocityX = 0;
    if (distFromLeft < scrollZoneWidth) {
      // Near left edge - scroll right to reveal more content (positive velocity)
      const proximity = 1 - (distFromLeft / scrollZoneWidth);
      velocityX = this.MAX_EDGE_SCROLL_SPEED * proximity * proximity; // Quadratic for smoother acceleration
    } else if (distFromRight < scrollZoneWidth) {
      // Near right edge - scroll left to reveal more content (negative velocity)
      const proximity = 1 - (distFromRight / scrollZoneWidth);
      velocityX = -this.MAX_EDGE_SCROLL_SPEED * proximity * proximity;
    }
    
    // Calculate velocity for Y axis
    let velocityY = 0;
    if (distFromTop < scrollZoneHeight) {
      // Near top edge - scroll down to reveal more content (positive velocity)
      const proximity = 1 - (distFromTop / scrollZoneHeight);
      velocityY = this.MAX_EDGE_SCROLL_SPEED * proximity * proximity;
    } else if (distFromBottom < scrollZoneHeight) {
      // Near bottom edge - scroll up to reveal more content (negative velocity)
      const proximity = 1 - (distFromBottom / scrollZoneHeight);
      velocityY = -this.MAX_EDGE_SCROLL_SPEED * proximity * proximity;
    }
    
    this.edgeScrollVelocityX = velocityX;
    this.edgeScrollVelocityY = velocityY;
  }
  
  /**
   * Start edge scrolling animation loop
   */
  private startEdgeScrolling(): void {
    if (this.edgeScrollAnimationFrame !== null) {
      return; // Already running
    }
    
    let lastTime = performance.now();
    
    const animate = (currentTime: number) => {
      const deltaTime = (currentTime - lastTime) / 1000; // Convert to seconds
      lastTime = currentTime;
      
      // Update velocity based on current mouse position (in case it changed or we panned)
      this.updateEdgeScrollVelocity(this.currentMouseX, this.currentMouseY);
      
      // Only scroll if there's velocity
      if (this.edgeScrollVelocityX !== 0 || this.edgeScrollVelocityY !== 0) {
        // Update pan based on velocity and delta time
        this.state.panX += this.edgeScrollVelocityX * deltaTime;
        this.state.panY += this.edgeScrollVelocityY * deltaTime;
        
        // If dragging a node, update its position to stay under the mouse cursor
        // The pan changed, so we need to recalculate the node's canvas position
        if (this.isDraggingNode && this.draggingNodeId && this.draggingNodeInitialPos) {
          const node = this.graph.nodes.find(n => n.id === this.draggingNodeId);
          if (node) {
            // Convert current mouse position to canvas coordinates
            const canvasPos = this.screenToCanvas(
              this.currentMouseX - this.dragOffsetX,
              this.currentMouseY - this.dragOffsetY
            );
            
            // Calculate smart guides and snap position
            const { snappedX, snappedY } = this.calculateSmartGuides(node, canvasPos.x, canvasPos.y);
            
            // Calculate the delta from initial position
            const deltaX = snappedX - this.draggingNodeInitialPos.x;
            const deltaY = snappedY - this.draggingNodeInitialPos.y;
            
            // Move all selected nodes by the same delta
            for (const [nodeId, initialPos] of this.selectedNodesInitialPositions.entries()) {
              const selectedNode = this.graph.nodes.find(n => n.id === nodeId);
              if (selectedNode) {
                selectedNode.position.x = Math.round(initialPos.x + deltaX);
                selectedNode.position.y = Math.round(initialPos.y + deltaY);
                this.onNodeMoved?.(nodeId, selectedNode.position.x, selectedNode.position.y);
              }
            }
          }
        }
        
        this.render();
      }
      
      // Continue animation if still dragging
      if (this.isDraggingNode || this.isConnecting) {
        this.edgeScrollAnimationFrame = requestAnimationFrame(animate);
      } else {
        this.edgeScrollAnimationFrame = null;
      }
    };
    
    this.edgeScrollAnimationFrame = requestAnimationFrame(animate);
  }
  
  /**
   * Stop edge scrolling animation
   */
  private stopEdgeScrolling(): void {
    if (this.edgeScrollAnimationFrame !== null) {
      cancelAnimationFrame(this.edgeScrollAnimationFrame);
      this.edgeScrollAnimationFrame = null;
    }
    this.edgeScrollVelocityX = 0;
    this.edgeScrollVelocityY = 0;
  }
  
  /**
   * Get current viewport information
   */
  private getViewport(): Viewport {
    // Use cached dimensions if available, fallback to getBoundingClientRect
    // This ensures consistent viewport calculations during resize
    const width = this.cachedViewportWidth || this.canvas.getBoundingClientRect().width;
    const height = this.cachedViewportHeight || this.canvas.getBoundingClientRect().height;
    
    return {
      x: this.state.panX,
      y: this.state.panY,
      width,
      height,
      zoom: this.state.zoom
    };
  }

  /**
   * Check if a node is visible in the viewport (fully or partially)
   */
  private isNodeVisible(node: NodeInstance, metrics: NodeRenderMetrics): boolean {
    
    const viewport = this.getViewport();
    return isRectVisible(
      node.position.x,
      node.position.y,
      metrics.width,
      metrics.height,
      viewport
    );
  }

  /**
   * Check if a connection is visible in the viewport
   * A connection is visible if at least one of its endpoints is visible
   */
  private isConnectionVisible(conn: Connection): boolean {
    const sourceNode = this.graph.nodes.find(n => n.id === conn.sourceNodeId);
    const targetNode = this.graph.nodes.find(n => n.id === conn.targetNodeId);
    
    if (!sourceNode || !targetNode) return false;
    
    const sourceMetrics = this.nodeMetrics.get(sourceNode.id);
    const targetMetrics = this.nodeMetrics.get(targetNode.id);
    
    // If we don't have metrics yet, render the connection (it will be calculated)
    if (!sourceMetrics || !targetMetrics) return true;
    
    // Connection is visible if either node is visible
    return this.isNodeVisible(sourceNode, sourceMetrics) || this.isNodeVisible(targetNode, targetMetrics);
  }
  
  /**
   * Calculate smart guides and snap position for a node being dragged
   */
  private calculateSmartGuides(
    draggingNode: NodeInstance,
    proposedX: number,
    proposedY: number
  ): {
    snappedX: number;
    snappedY: number;
    guides: { vertical: Array<{ x: number; startY: number; endY: number }>; horizontal: Array<{ y: number; startX: number; endX: number }> };
  } {
    const draggingMetrics = this.nodeMetrics.get(draggingNode.id);
    if (!draggingMetrics) {
      return { snappedX: proposedX, snappedY: proposedY, guides: { vertical: [], horizontal: [] } };
    }
    
    const draggingLeft = proposedX;
    const draggingRight = proposedX + draggingMetrics.width;
    const draggingTop = proposedY;
    const draggingBottom = proposedY + draggingMetrics.height;
    
    const verticalGuides: Array<{ x: number; startY: number; endY: number }> = [];
    const horizontalGuides: Array<{ y: number; startX: number; endX: number }> = [];
    
    let snappedX = proposedX;
    let snappedY = proposedY;
    let bestSnapX: { pos: number; distance: number; alignType: string } | null = null;
    let bestSnapY: { pos: number; distance: number; alignType: string } | null = null;
    
    const snapThreshold = this.SNAP_THRESHOLD / this.state.zoom;
    
    // Check alignment with other visible nodes
    for (const node of this.graph.nodes) {
      if (node.id === draggingNode.id) continue;
      
      const metrics = this.nodeMetrics.get(node.id);
      if (!metrics) continue;
      
      // Only consider nodes that are at least partially visible
      if (!this.isNodeVisible(node, metrics)) continue;
      
      const nodeLeft = node.position.x;
      const nodeRight = node.position.x + metrics.width;
      const nodeTop = node.position.y;
      const nodeBottom = node.position.y + metrics.height;
      
      // Vertical alignment checks (left, right)
      const alignmentsX = [
        { pos: nodeLeft, alignType: 'left' },
        { pos: nodeRight, alignType: 'right' }
      ];
      
      for (const align of alignmentsX) {
        // Check if dragging node's left edge aligns
        const distLeft = Math.abs(draggingLeft - align.pos);
        // Calculate what the position change would be if we snap
        const positionChangeLeft = Math.abs(align.pos - proposedX);
        if (distLeft < snapThreshold && positionChangeLeft <= snapThreshold && (!bestSnapX || distLeft < bestSnapX.distance)) {
          bestSnapX = { pos: align.pos, distance: distLeft, alignType: align.alignType };
        }
        
        // Check if dragging node's right edge aligns
        const distRight = Math.abs(draggingRight - align.pos);
        // Calculate what the position change would be if we snap (right edge alignment)
        const positionChangeRight = Math.abs((align.pos - draggingMetrics.width) - proposedX);
        if (distRight < snapThreshold && positionChangeRight <= snapThreshold && (!bestSnapX || distRight < bestSnapX.distance)) {
          bestSnapX = { pos: align.pos, distance: distRight, alignType: align.alignType };
        }
        
        // Only add guide if we're actually close enough to potentially snap (within threshold)
        if ((distLeft < snapThreshold && positionChangeLeft <= snapThreshold) || 
            (distRight < snapThreshold && positionChangeRight <= snapThreshold)) {
          const guideStartY = Math.min(draggingTop, nodeTop);
          const guideEndY = Math.max(draggingBottom, nodeBottom);
          verticalGuides.push({ x: align.pos, startY: guideStartY, endY: guideEndY });
        }
      }
      
      // Horizontal alignment checks (top, bottom)
      const alignmentsY = [
        { pos: nodeTop, alignType: 'top' },
        { pos: nodeBottom, alignType: 'bottom' }
      ];
      
      for (const align of alignmentsY) {
        // Check if dragging node's top edge aligns
        const distTop = Math.abs(draggingTop - align.pos);
        // Calculate what the position change would be if we snap
        const positionChangeTop = Math.abs(align.pos - proposedY);
        if (distTop < snapThreshold && positionChangeTop <= snapThreshold && (!bestSnapY || distTop < bestSnapY.distance)) {
          bestSnapY = { pos: align.pos, distance: distTop, alignType: align.alignType };
        }
        
        // Check if dragging node's bottom edge aligns
        const distBottom = Math.abs(draggingBottom - align.pos);
        // Calculate what the position change would be if we snap (bottom edge alignment)
        const positionChangeBottom = Math.abs((align.pos - draggingMetrics.height) - proposedY);
        if (distBottom < snapThreshold && positionChangeBottom <= snapThreshold && (!bestSnapY || distBottom < bestSnapY.distance)) {
          bestSnapY = { pos: align.pos, distance: distBottom, alignType: align.alignType };
        }
        
        // Only add guide if we're actually close enough to potentially snap (within threshold)
        if ((distTop < snapThreshold && positionChangeTop <= snapThreshold) || 
            (distBottom < snapThreshold && positionChangeBottom <= snapThreshold)) {
          const guideStartX = Math.min(draggingLeft, nodeLeft);
          const guideEndX = Math.max(draggingRight, nodeRight);
          horizontalGuides.push({ y: align.pos, startX: guideStartX, endX: guideEndX });
        }
      }
    }
    
    // Apply snapping based on best matches, but only if the position change is small
    if (bestSnapX) {
      let candidateSnappedX: number;
      if (bestSnapX.alignType === 'left') {
        candidateSnappedX = bestSnapX.pos;
      } else if (bestSnapX.alignType === 'right') {
        candidateSnappedX = bestSnapX.pos - draggingMetrics.width;
      } else {
        candidateSnappedX = proposedX;
      }
      
      // Only snap if the resulting position change is small (within threshold)
      const positionChangeX = Math.abs(candidateSnappedX - proposedX);
      if (positionChangeX <= snapThreshold) {
        snappedX = candidateSnappedX;
      }
    }
    
    if (bestSnapY) {
      let candidateSnappedY: number;
      if (bestSnapY.alignType === 'top') {
        candidateSnappedY = bestSnapY.pos;
      } else if (bestSnapY.alignType === 'bottom') {
        candidateSnappedY = bestSnapY.pos - draggingMetrics.height;
      } else {
        candidateSnappedY = proposedY;
      }
      
      // Only snap if the resulting position change is small (within threshold)
      const positionChangeY = Math.abs(candidateSnappedY - proposedY);
      if (positionChangeY <= snapThreshold) {
        snappedY = candidateSnappedY;
      }
    }
    
    // Filter duplicate guides and clamp to viewport
    const uniqueVerticalGuides = new Map<number, { x: number; startY: number; endY: number }>();
    for (const guide of verticalGuides) {
      const existing = uniqueVerticalGuides.get(guide.x);
      if (!existing) {
        uniqueVerticalGuides.set(guide.x, guide);
      } else {
        // Merge guide extents
        existing.startY = Math.min(existing.startY, guide.startY);
        existing.endY = Math.max(existing.endY, guide.endY);
      }
    }
    
    const uniqueHorizontalGuides = new Map<number, { y: number; startX: number; endX: number }>();
    for (const guide of horizontalGuides) {
      const existing = uniqueHorizontalGuides.get(guide.y);
      if (!existing) {
        uniqueHorizontalGuides.set(guide.y, guide);
      } else {
        // Merge guide extents
        existing.startX = Math.min(existing.startX, guide.startX);
        existing.endX = Math.max(existing.endX, guide.endX);
      }
    }
    
    return {
      snappedX,
      snappedY,
      guides: {
        vertical: Array.from(uniqueVerticalGuides.values()),
        horizontal: Array.from(uniqueHorizontalGuides.values())
      }
    };
  }
  
  /**
   * Render selection rectangle
   * Note: This is called from renderContent() which already applies pan/zoom transform,
   * so we render directly in canvas space.
   */
  private renderSelectionRectangle(): void {
    if (!this.selectionRectangle) return;
    
    const { x, y, width, height } = this.selectionRectangle;
    
    // Get selection rectangle color from CSS
    const fillColor = getCSSColor('selection-rectangle-fill', 'rgba(100, 150, 255, 0.1)');
    const strokeColor = getCSSColor('selection-rectangle-stroke', getCSSColor('color-blue-60', '#4a9eff'));
    
    // Draw fill
    this.ctx.fillStyle = fillColor;
    this.ctx.fillRect(x, y, width, height);
    
    // Draw stroke
    this.ctx.strokeStyle = strokeColor;
    this.ctx.lineWidth = 1 / this.state.zoom; // Scale line width with zoom
    this.ctx.setLineDash([4 / this.state.zoom, 4 / this.state.zoom]); // Scale dash with zoom
    this.ctx.strokeRect(x, y, width, height);
    this.ctx.setLineDash([]);
  }
  
  /**
   * Render smart guide lines
   */
  private renderSmartGuides(): void {
    if (this.smartGuides.vertical.length === 0 && this.smartGuides.horizontal.length === 0) {
      return;
    }
    
    // Save context state to avoid affecting other renderers
    this.ctx.save();
    
    const rect = this.canvas.getBoundingClientRect();
    const viewportLeft = -this.state.panX / this.state.zoom;
    const viewportTop = -this.state.panY / this.state.zoom;
    const viewportRight = (rect.width - this.state.panX) / this.state.zoom;
    const viewportBottom = (rect.height - this.state.panY) / this.state.zoom;
    
    const guideColor = getCSSColor('smart-guide-color', getCSSColor('color-blue-90', '#6565dc'));
    const guideWidth = 1;
    
    this.ctx.strokeStyle = guideColor;
    this.ctx.lineWidth = guideWidth / this.state.zoom;
    this.ctx.setLineDash([4 / this.state.zoom, 4 / this.state.zoom]);
    this.ctx.globalAlpha = 0.8;
    
    // Render vertical guides
    for (const guide of this.smartGuides.vertical) {
      // Clamp guide to viewport
      const startY = Math.max(viewportTop, Math.min(viewportBottom, guide.startY));
      const endY = Math.max(viewportTop, Math.min(viewportBottom, guide.endY));
      
      if (endY > startY) {
        this.ctx.beginPath();
        this.ctx.moveTo(guide.x, startY);
        this.ctx.lineTo(guide.x, endY);
        this.ctx.stroke();
      }
    }
    
    // Render horizontal guides
    for (const guide of this.smartGuides.horizontal) {
      // Clamp guide to viewport
      const startX = Math.max(viewportLeft, Math.min(viewportRight, guide.startX));
      const endX = Math.max(viewportLeft, Math.min(viewportRight, guide.endX));
      
      if (endX > startX) {
        this.ctx.beginPath();
        this.ctx.moveTo(startX, guide.y);
        this.ctx.lineTo(endX, guide.y);
        this.ctx.stroke();
      }
    }
    
    // Restore context state
    this.ctx.restore();
  }
  
  /**
   * Set the active tool
   */
  public setActiveTool(tool: ToolType): void {
    this.activeTool = tool;
    
    // Update cursor based on tool
    if (tool === 'hand') {
      this.canvas.style.cursor = 'grab';
    } else if (tool === 'select') {
      this.canvas.style.cursor = 'crosshair';
    } else {
      this.canvas.style.cursor = 'default';
    }
  }
  
  private handleMouseUp(e: MouseEvent): void {
    // Detach document-level listeners when drag ends
    this.detachDocumentListeners();
    
    // Try new interaction handler system for interaction end (Phase 2.4)
    if (this.interactionManager) {
      // Always try to end all interaction types - handlers will check if they're active
      // This ensures handlers can clean up their state even if old instance variables aren't set
      const eventTypes = [
        InteractionType.NodeDrag,
        InteractionType.ParameterDrag,
        InteractionType.BezierControlDrag,
        InteractionType.PortConnect,
        InteractionType.CanvasPan,
        InteractionType.RectangleSelection
      ];
      
      for (const eventType of eventTypes) {
        const event = this.createInteractionEvent(eventType, e);
        this.interactionManager.end(event);
      }
    }
    
    // Stop edge scrolling
    this.stopEdgeScrolling();
    
    // Clear smart guides
    this.smartGuides = { vertical: [], horizontal: [] };
    
    if (this.isConnecting) {
      // Check if released on a valid port
      const portHit = this.hitTestPort(e.clientX, e.clientY);
      if (portHit && portHit.nodeId !== this.connectionStartNodeId) {
        // Valid connection
        if (this.connectionStartIsOutput && !portHit.isOutput) {
          // Output to input or parameter
          if (portHit.parameter) {
            // Connecting to parameter input
            this.onConnectionCreated?.(
              this.connectionStartNodeId!,
              this.connectionStartPort!,
              portHit.nodeId,
              undefined,
              portHit.parameter
            );
          } else {
            // Output to input port
            this.onConnectionCreated?.(
              this.connectionStartNodeId!,
              this.connectionStartPort!,
              portHit.nodeId,
              portHit.port
            );
          }
        } else if (!this.connectionStartIsOutput && portHit.isOutput) {
          // Input to output (reverse) - not applicable for parameter inputs
          this.onConnectionCreated?.(
            portHit.nodeId,
            portHit.port,
            this.connectionStartNodeId!,
            this.connectionStartPort!
          );
        }
      }
      this.isConnecting = false;
      this.connectionStartNodeId = null;
      this.connectionStartPort = null;
      this.connectionStartParameter = null;
      this.hoveredPort = null;
      this.canvas.style.cursor = this.isSpacePressed ? 'grab' : 'default';
      this.render();
    }
    
    // If we had a potential node drag but didn't actually drag, the selection was already handled in mouseDown
    // So we don't need to do anything here - just clean up
    if (this.potentialNodeDrag && !this.isDraggingNode && this.potentialNodeDragId) {
      // Selection was already handled in mouseDown, so we just clean up the drag state
      // No need to change selection here
    }
    
    // Handle double-click on parameter value for text input
    if (!this.isPanning && !this.isDraggingNode && !this.isConnecting && !this.isDraggingParameter) {
      const paramHit = this.hitTestParameter(e.clientX, e.clientY);
      if (paramHit && e.detail === 2) {
        // Double-click on parameter - could show text input (for now, just log)
        // TODO: Implement text input overlay for parameter editing
      }
    }
    
    this.isPanning = false;
    this.isDraggingNode = false;
    this.draggingNodeId = null;
    this.draggingNodeInitialPos = null;
    this.selectedNodesInitialPositions.clear();
    this.isDraggingParameter = false;
    this.draggingParameterNodeId = null;
    this.draggingParameterName = null;
    this.isDraggingBezierControl = false;
    this.draggingBezierNodeId = null;
    this.draggingBezierControlIndex = null;
    this.dragBezierStartValues = null;
    this.potentialBackgroundPan = false;
    this.potentialNodeDrag = false;
    this.potentialNodeDragId = null;
    // Reset cursor based on spacebar state
    this.canvas.style.cursor = this.isSpacePressed ? 'grab' : 'default';
  }
  
  private handleWheel(e: WheelEvent): void {
    e.preventDefault();
    
    // Try new interaction handler system first (Phase 2.4)
    if (this.interactionManager) {
      const event = this.createInteractionEvent(InteractionType.CanvasZoom, e);
      if (this.interactionManager.handle(event)) {
        return; // Event handled by handler
      }
    }
    
    // Fallback to old implementation
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Zoom at mouse position
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.10, Math.min(10, this.state.zoom * zoomFactor));
    
    // Adjust pan to keep mouse position fixed
    const zoomRatio = newZoom / this.state.zoom;
    this.state.panX = mouseX - (mouseX - this.state.panX) * zoomRatio;
    this.state.panY = mouseY - (mouseY - this.state.panY) * zoomRatio;
    
    this.state.zoom = newZoom;
    // Zoom changes viewport - everything needs to be redrawn
    this.renderState.markFullRedraw();
    this.requestRender();
  }
  
  private handleKeyDown(e: KeyboardEvent): void {
    // Check if user is typing in an input field - don't handle shortcuts in that case
    const target = e.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
    
    // If dialog is visible, don't handle keyboard shortcuts (except spacebar for panning)
    if (this.isDialogVisible?.()) {
      // Only allow spacebar for panning when dialog is open
      if (e.key === ' ' || e.key === 'Space') {
        if (!this.isSpacePressed && this.spacePressTimeout === null) {
          // Activate panning immediately when dialog is open (no delay needed)
          this.isSpacePressed = true;
          // Update cursor if not already panning/dragging
          if (!this.isPanning && !this.isDraggingNode && !this.isConnecting) {
            this.canvas.style.cursor = 'grab';
          }
          // Notify that spacebar is now active for panning (visual feedback)
          this.onSpacebarStateChange?.(true);
        }
        e.preventDefault(); // Prevent page scroll
      }
      return;
    }
    
    // Track spacebar for panning - but only activate after a delay
    // This allows quick presses to trigger playback without activating pan mode
    if (e.key === ' ' || e.key === 'Space') {
      if (!this.isSpacePressed && this.spacePressTimeout === null) {
        // Set a timeout to activate panning mode only if spacebar is held
        this.spacePressTimeout = window.setTimeout(() => {
          this.isSpacePressed = true;
          this.spacePressTimeout = null;
          // Update cursor if not already panning/dragging
          if (!this.isPanning && !this.isDraggingNode && !this.isConnecting) {
            this.canvas.style.cursor = 'grab';
          }
          // Notify that spacebar is now active for panning (visual feedback)
          this.onSpacebarStateChange?.(true);
        }, this.SPACE_PAN_DELAY);
      }
      // Don't prevent default here - let BottomBar handle playback toggle
      // Only prevent default if we're already in pan mode
      if (this.isSpacePressed) {
        e.preventDefault(); // Prevent page scroll
      }
      return;
    }
    
    // Don't handle Delete/Backspace when user is typing in an input field
    if (isInput) {
      return;
    }
    
    // Delete selected nodes/connections
    if ((e.key === 'Delete' || e.key === 'Backspace') && !e.ctrlKey && !e.metaKey) {
      for (const nodeId of this.state.selectedNodeIds) {
        // Clean up NodeComponent if feature flag is enabled (Phase 2.2)
        const component = this.nodeComponents.get(nodeId);
        if (component) {
          component.unmount();
          this.nodeComponents.delete(nodeId);
        }
        this.onNodeDeleted?.(nodeId);
      }
      for (const connId of this.state.selectedConnectionIds) {
        this.onConnectionDeleted?.(connId);
      }
      this.state.selectedNodeIds.clear();
      this.state.selectedConnectionIds.clear();
      this.render();
    }
  }
  
  private handleKeyUp(e: KeyboardEvent): void {
    // Track spacebar release
    if (e.key === ' ' || e.key === 'Space') {
      // Cancel the timeout if spacebar was released before pan mode activated
      if (this.spacePressTimeout !== null) {
        clearTimeout(this.spacePressTimeout);
        this.spacePressTimeout = null;
      }
      const wasSpacePressed = this.isSpacePressed;
      this.isSpacePressed = false;
      // Reset cursor if not panning/dragging
      if (!this.isPanning && !this.isDraggingNode && !this.isConnecting) {
        this.canvas.style.cursor = 'default';
      }
      // Notify that spacebar is no longer active (visual feedback)
      if (wasSpacePressed) {
        this.onSpacebarStateChange?.(false);
      }
      e.preventDefault();
    }
  }
  
  private handleMouseLeave(): void {
    // Clear port hover when mouse leaves canvas
    if (this.hoveredPort && !this.isConnecting) {
      this.hoveredPort = null;
      this.render();
    }
  }
  
  // Rendering
  /**
   * Request a render on the next animation frame
   * Batches multiple render requests into a single frame
   */
  private requestRender(): void {
    if (this.renderRequested) {
      return; // Already scheduled
    }
    
    this.renderRequested = true;
    this.pendingRenderFrame = requestAnimationFrame(() => {
      this.render();
      this.renderRequested = false;
      this.pendingRenderFrame = null;
    });
  }

  /**
   * Mark full redraw needed and request render
   */
  private markFullRedraw(): void {
    this.renderState.markFullRedraw();
    this.requestRender();
  }

  public render(): void {
    // Process pending resize before rendering
    // This ensures resize is handled in sync with the render loop
    if (this.pendingResize) {
      this.resize();
    }
    
    const { width, height } = this.canvas;
    
    // Detect pan/zoom changes (require full redraw for incremental rendering)
    const panChanged = this.state.panX !== this.previousPanX || this.state.panY !== this.previousPanY;
    const zoomChanged = this.state.zoom !== this.previousZoom;
    
    // PERFORMANCE OPTIMIZATION: Check if this is a pan-only update (no content changes)
    const dirtyNodes = this.renderState.getDirtyNodes();
    const dirtyConnections = this.renderState.getDirtyConnections();
    const isPanOnly = panChanged && !zoomChanged && dirtyNodes.size === 0 && dirtyConnections.size === 0;
    
    if (panChanged || zoomChanged) {
      // Viewport changed - require full redraw
      this.renderState.markFullRedraw();
      
      // Update previous values
      this.previousPanX = this.state.panX;
      this.previousPanY = this.state.panY;
      this.previousZoom = this.state.zoom;
    }
    
    // PERFORMANCE OPTIMIZATION: Skip unnecessary recalculations during pan-only updates
    // When only panning (no nodes/connections changed), we don't need to recalculate
    // metrics or dirty regions - just render with the new pan offset
    if (!isPanOnly) {
      // Recalculate metrics for dirty nodes before calculating dirty regions
      // This ensures metrics are up-to-date when parameters change
      this.recalculateMetricsForDirtyNodes();
      
      // Update dirty regions before rendering (calculate screen-space regions)
      this.updateDirtyRegions();
    }
    
    // Standard rendering: always clear and render everything
    // FrameBuffer removed - getImageData/putImageData was too expensive
    this.ctx.clearRect(0, 0, width, height);
    this.fillBackground();
    
    // Always render all visible content
    // Note: Without FrameBuffer, we can't do true incremental rendering (restore previous frame)
    // So we always render everything visible, but layers can use dirty regions as optimization hints
    this.renderContent();
    
    // Clear dirty state after rendering
    this.renderState.clear();
  }
  
  /**
   * Fill canvas background
   */
  private fillBackground(): void {
    const canvasBg = getCSSColor('canvas-bg', getCSSColor('color-gray-40', '#0a0a0e'));
    this.ctx.fillStyle = canvasBg;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }
  
  /**
   * Render all content (grid, nodes, connections, etc.)
   */
  private renderContent(): void {
    // Use layer system
    if (this.layerManager) {
      // Save context
      this.ctx.save();
      
      // Apply pan/zoom transform
      this.ctx.translate(this.state.panX, this.state.panY);
      this.ctx.scale(this.state.zoom, this.state.zoom);
      
      // Render layers
      this.layerManager.render(this.ctx, this.renderState);
      
      // Restore context
      this.ctx.restore();
    } else {
      // Fallback to old rendering path
      // Save context
      this.ctx.save();
      
      // Apply pan/zoom transform
      this.ctx.translate(this.state.panX, this.state.panY);
      this.ctx.scale(this.state.zoom, this.state.zoom);
      
      // Render grid (always render - grid position changes with pan/zoom)
      // Note: With dirty tracking, we could optimize this, but panning changes grid position
      // so we render it every frame for now. Future optimization: only re-render grid when pan/zoom changes.
      this.renderGrid();
      
      // Always render all connections, nodes, and ports
      // Dirty tracking determines WHEN to render (via requestRender), not WHAT to render
      // We still need to render all visible items every frame
      this.renderRegularConnections();
      this.renderNodes(true);
      this.renderParameterConnections();
      this.renderNodePorts();
      
      // Render temporary connection line (if connecting)
      if (this.isConnecting) {
        this.renderTemporaryConnection();
      }
      
      // Render smart guides (if dragging node - check guides exist or old dragging state)
      if (this.smartGuides.vertical.length > 0 || this.smartGuides.horizontal.length > 0 || (this.isDraggingNode && this.draggingNodeId)) {
        this.renderSmartGuides();
      }
      
      // Render selection rectangle (if selection tool is active)
      if (this.selectionRectangle) {
        this.renderSelectionRectangle();
      }
      
      // Restore context
      this.ctx.restore();
    }
  }
  
  /**
   * Phase 3.1: Calculate screen-space dirty region for a node
   * Converts node bounds from canvas space to screen space
   */
  private calculateNodeDirtyRegion(nodeId: string): { x: number; y: number; width: number; height: number } | null {
    const node = this.graph.nodes.find(n => n.id === nodeId);
    if (!node) return null;
    
    const metrics = this.nodeMetrics.get(nodeId);
    if (!metrics) return null;
    
    // Node bounds in canvas space
    const canvasX = node.position.x;
    const canvasY = node.position.y;
    const canvasWidth = metrics.width;
    const canvasHeight = metrics.height;
    
    // Convert to screen space
    // Screen X = canvasX * zoom + panX
    // Screen Y = canvasY * zoom + panY
    const screenX = canvasX * this.state.zoom + this.state.panX;
    const screenY = canvasY * this.state.zoom + this.state.panY;
    const screenWidth = canvasWidth * this.state.zoom;
    const screenHeight = canvasHeight * this.state.zoom;
    
    // Add padding to account for connections, ports, parameter ports, mode buttons, etc.
    // Nodes with connected parameter ports need extra padding for parameter UI elements
    const hasConnectedParams = this.graph.connections.some(
      conn => conn.targetNodeId === nodeId && conn.targetParameter
    );
    const padding = hasConnectedParams ? 100 : 50; // More padding for nodes with parameter connections
    
    return {
      x: Math.max(0, screenX - padding),
      y: Math.max(0, screenY - padding),
      width: Math.min(this.canvas.width, screenWidth + padding * 2),
      height: Math.min(this.canvas.height, screenHeight + padding * 2)
    };
  }
  
  /**
   * Phase 3.1: Calculate screen-space dirty region for a connection
   * Estimates connection bounds based on source and target node positions
   */
  private calculateConnectionDirtyRegion(connection: Connection): { x: number; y: number; width: number; height: number } | null {
    const sourceNode = this.graph.nodes.find(n => n.id === connection.sourceNodeId);
    const targetNode = this.graph.nodes.find(n => n.id === connection.targetNodeId);
    
    if (!sourceNode || !targetNode) return null;
    
    const sourceMetrics = this.nodeMetrics.get(connection.sourceNodeId);
    const targetMetrics = this.nodeMetrics.get(connection.targetNodeId);
    
    if (!sourceMetrics || !targetMetrics) return null;
    
    // Get actual port positions (not node centers)
    let sourcePortPos: { x: number; y: number } | undefined;
    let targetPortPos: { x: number; y: number } | undefined;
    
    if (connection.targetParameter) {
      // Parameter connection
      sourcePortPos = sourceMetrics.portPositions.get(`output:${connection.sourcePort}`);
      targetPortPos = targetMetrics.parameterInputPortPositions.get(connection.targetParameter);
    } else {
      // Regular connection
      sourcePortPos = sourceMetrics.portPositions.get(`output:${connection.sourcePort}`);
      targetPortPos = targetMetrics.portPositions.get(`input:${connection.targetPort}`);
    }
    
    if (!sourcePortPos || !targetPortPos) return null;
    
    const sourceX = sourcePortPos.x;
    const sourceY = sourcePortPos.y;
    const targetX = targetPortPos.x;
    const targetY = targetPortPos.y;
    
    // Calculate bezier curve control points (matches connection rendering)
    const cp1X = sourceX + 100;
    const cp1Y = sourceY;
    const cp2X = targetX - 100;
    const cp2Y = targetY;
    
    // Convert to screen space
    const sourceScreenX = sourceX * this.state.zoom + this.state.panX;
    const sourceScreenY = sourceY * this.state.zoom + this.state.panY;
    const targetScreenX = targetX * this.state.zoom + this.state.panX;
    const targetScreenY = targetY * this.state.zoom + this.state.panY;
    const cp1ScreenX = cp1X * this.state.zoom + this.state.panX;
    const cp1ScreenY = cp1Y * this.state.zoom + this.state.panY;
    const cp2ScreenX = cp2X * this.state.zoom + this.state.panX;
    const cp2ScreenY = cp2Y * this.state.zoom + this.state.panY;
    
    // Calculate bounding box including all bezier curve points
    const minX = Math.min(sourceScreenX, targetScreenX, cp1ScreenX, cp2ScreenX);
    const maxX = Math.max(sourceScreenX, targetScreenX, cp1ScreenX, cp2ScreenX);
    const minY = Math.min(sourceScreenY, targetScreenY, cp1ScreenY, cp2ScreenY);
    const maxY = Math.max(sourceScreenY, targetScreenY, cp1ScreenY, cp2ScreenY);
    
    // Add padding for line width (selected connections are thicker) and anti-aliasing
    const maxLineWidth = getCSSVariableAsNumber('connection-width-selected', 3);
    const padding = Math.max(50, maxLineWidth * 2); // At least 50px, or 2x line width
    
    return {
      x: Math.max(0, minX - padding),
      y: Math.max(0, minY - padding),
      width: Math.min(this.canvas.width, maxX - minX + padding * 2),
      height: Math.min(this.canvas.height, maxY - minY + padding * 2)
    };
  }
  
  /**
   * Recalculate metrics for dirty nodes before calculating dirty regions
   * This ensures metrics are up-to-date when parameters change
   * 
   * When parameters change, the metrics cache is invalidated, but we need
   * fresh metrics to calculate the correct dirty region bounds.
   */
  private recalculateMetricsForDirtyNodes(): void {
    const dirtyNodes = this.renderState.getDirtyNodes();
    
    for (const nodeId of dirtyNodes) {
      const node = this.graph.nodes.find(n => n.id === nodeId);
      if (!node) continue;
      
      const spec = this.nodeSpecs.get(node.type);
      if (!spec) continue;
      
      // Invalidate node cache (metrics or content may have changed)
      // The cache will be regenerated on next render with new metrics
      const oldMetrics = this.nodeMetrics.get(nodeId);
      if (oldMetrics) {
        this.nodeRenderer.clearNodeCache(node, spec, oldMetrics);
      }
      
      // Always recalculate metrics for dirty nodes to ensure they're up-to-date
      // The NodeMetricsCalculator cache will handle optimization internally
      const metrics = this.nodeRenderer.calculateMetrics(node, spec);
      this.nodeMetrics.set(nodeId, metrics);
      
      // Also update component metrics if component exists
      const component = this.nodeComponents.get(nodeId);
      if (component) {
        component.invalidateMetrics();
        this.nodeMetrics.set(nodeId, component.getNodeMetrics());
      }
    }
  }
  
  /**
   * Phase 3.1: Update dirty regions based on dirty nodes and connections
   * Called before rendering to calculate screen-space regions
   */
  private updateDirtyRegions(): void {
    // Clear existing regions (will recalculate)
    const dirtyNodes = this.renderState.getDirtyNodes();
    const dirtyConnections = this.renderState.getDirtyConnections();
    
    // Check if any dirty nodes have parameter connections - if so, we need to be more careful
    const nodesWithParamConnections = new Set<string>();
    for (const nodeId of dirtyNodes) {
      const hasParamConnections = this.graph.connections.some(
        conn => conn.targetNodeId === nodeId && conn.targetParameter
      );
      if (hasParamConnections) {
        nodesWithParamConnections.add(nodeId);
        // Also mark parameter connections layer as dirty to ensure proper rendering
        this.renderState.markLayerDirty(RenderLayer.ParameterConnections);
      }
    }
    
    // Calculate regions for dirty nodes
    for (const nodeId of dirtyNodes) {
      const region = this.calculateNodeDirtyRegion(nodeId);
      if (region) {
        // Validate region is reasonable (not way too large)
        const maxRegionSize = Math.max(this.canvas.width, this.canvas.height) * 2;
        if (region.width <= maxRegionSize && region.height <= maxRegionSize) {
          this.renderState.addDirtyRegion(region);
        } else {
          // Region is suspiciously large - trigger full redraw instead
          this.renderState.markFullRedraw();
          return;
        }
      }
    }
    
    // Calculate regions for dirty connections
    for (const connId of dirtyConnections) {
      const connection = this.graph.connections.find(c => c.id === connId);
      if (connection) {
        const region = this.calculateConnectionDirtyRegion(connection);
        if (region) {
          // Validate region is reasonable
          const maxRegionSize = Math.max(this.canvas.width, this.canvas.height) * 2;
          if (region.width <= maxRegionSize && region.height <= maxRegionSize) {
            this.renderState.addDirtyRegion(region);
          } else {
            // Region is suspiciously large - trigger full redraw instead
            this.renderState.markFullRedraw();
            return;
          }
        }
      }
    }
    
    // If grid layer is dirty, mark entire viewport as dirty (grid covers everything)
    if (this.renderState.isLayerDirty(RenderLayer.Grid)) {
      this.renderState.addDirtyRegion({
        x: 0,
        y: 0,
        width: this.canvas.width,
        height: this.canvas.height
      });
    }
  }
  
  private renderGrid(): void {
    const gridSize = getCSSVariableAsNumber('canvas-grid-size', 50);
    const gridColor = getCSSColor('canvas-grid-color', getCSSColor('color-gray-50', '#111317'));
    const dotRadius = getCSSVariableAsNumber('canvas-grid-dot-radius', 1.5);
    
    this.ctx.fillStyle = gridColor;
    
    const rect = this.canvas.getBoundingClientRect();
    const startX = Math.floor((-this.state.panX) / (this.state.zoom * gridSize)) * gridSize;
    const startY = Math.floor((-this.state.panY) / (this.state.zoom * gridSize)) * gridSize;
    const endX = startX + (rect.width / this.state.zoom) + gridSize;
    const endY = startY + (rect.height / this.state.zoom) + gridSize;
    
    // Draw dots at grid intersection points
    this.ctx.beginPath();
    for (let x = startX; x < endX; x += gridSize) {
      for (let y = startY; y < endY; y += gridSize) {
        this.ctx.moveTo(x + dotRadius, y);
        this.ctx.arc(x, y, dotRadius / this.state.zoom, 0, Math.PI * 2);
      }
    }
    this.ctx.fill();
  }
  
  private renderNodes(skipPorts: boolean = false): void {
    // Always render all visible nodes - dirty tracking controls when to trigger renders, not what to render
    // Viewport culling filters out off-screen nodes for performance
    for (const node of this.graph.nodes) {
      // Get metrics to check visibility (will be recalculated in renderNode if needed)
      const metrics = this.nodeMetrics.get(node.id);
      
      // Check visibility before rendering (viewport culling)
      if (metrics && !this.isNodeVisible(node, metrics)) {
        continue; // Skip off-screen nodes
      }
      
      this.renderNode(node, skipPorts);
    }
  }
  
  private renderNode(node: NodeInstance, skipPorts: boolean = false): void {
    const spec = this.nodeSpecs.get(node.type);
    if (!spec) return;
    
    // Use NodeComponent system
    this.renderNodeWithComponent(node, spec, skipPorts);
  }
  
  /**
   * Render node using NodeComponent (Phase 2.2)
   */
  private renderNodeWithComponent(node: NodeInstance, spec: NodeSpec, skipPorts: boolean = false): void {
    // Get or create NodeComponent for this node
    let component = this.nodeComponents.get(node.id);
    if (!component) {
      component = new NodeComponent(this.ctx, node, spec, this.nodeRenderer);
      this.nodeComponents.set(node.id, component);
      component.mount();
    }
    
    // Update component state
    const isSelected = this.state.selectedNodeIds.has(node.id);
    const isPortHovered = this.hoveredPort && this.hoveredPort.nodeId === node.id;
    const hoveredPortName = isPortHovered ? (this.hoveredPort!.parameter || this.hoveredPort!.port) : null;
    const isHoveredParameter = isPortHovered ? !!this.hoveredPort!.parameter : undefined;
    
    let connectingPortName: string | null = null;
    let isConnectingParameter: boolean | undefined = undefined;
    if (this.isConnecting && this.connectionStartNodeId === node.id) {
      connectingPortName = this.connectionStartParameter || this.connectionStartPort || null;
      isConnectingParameter = !!this.connectionStartParameter;
    }
    
    // Compute effective parameter values for parameters with input connections
    const effectiveParameterValues = new Map<string, number | null>();
    const connectedParameters = new Set<string>();
    
    if (!node.collapsed) {
      for (const [paramName, paramSpec] of Object.entries(spec.parameters)) {
        if (paramSpec.type === 'float') {
          const effectiveValue = computeEffectiveParameterValue(
            node,
            paramName,
            paramSpec,
            this.graph,
            this.nodeSpecs,
            this.audioManager
          );
          effectiveParameterValues.set(paramName, effectiveValue);
          
          // Check if this parameter has a connection
          const hasConnection = this.graph.connections.some(
            conn => conn.targetNodeId === node.id && conn.targetParameter === paramName
          );
          if (hasConnection) {
            connectedParameters.add(paramName);
          }
        }
      }
    }
    
    // Update component state
    component.setState({
      isSelected,
      hoveredPortName,
      isHoveredParameter,
      effectiveParameterValues,
      connectingPortName,
      isConnectingParameter,
      connectedParameters,
      skipPorts
    });
    
    // Always invalidate and recalculate metrics - they depend on node.position which changes when dragging
    // The component's cache will handle optimization for non-position changes
    component.invalidateMetrics();
    
    // Recalculate component metrics (bounds) to reflect current node position
    // This ensures the component's bounds are up-to-date for hit testing and viewport culling
    component.calculateMetrics();
    
    // Store metrics for viewport culling (component will recalculate on next getNodeMetrics call)
    const metrics = component.getNodeMetrics();
    this.nodeMetrics.set(node.id, metrics);
    
    // Render the component
    component.render();
  }
  
  private renderNodePorts(): void {
    // Use NodeComponent system
    this.renderNodePortsWithComponent();
  }
  
  /**
   * Render node ports using NodeComponent (Phase 2.2)
   */
  private renderNodePortsWithComponent(): void {
    // Always render all visible node ports - dirty tracking controls when to trigger renders
    // Viewport culling filters out off-screen nodes for performance
    for (const node of this.graph.nodes) {
      const component = this.nodeComponents.get(node.id);
      if (!component) continue;
      
      const metrics = component.getNodeMetrics();
      
      // Check visibility before rendering (viewport culling)
      if (!this.isNodeVisible(node, metrics)) {
        continue; // Skip off-screen nodes
      }
      
      // Update component state for port rendering
      const isPortHovered = this.hoveredPort && this.hoveredPort.nodeId === node.id;
      const hoveredPortName = isPortHovered ? (this.hoveredPort!.parameter || this.hoveredPort!.port) : null;
      const isHoveredParameter = isPortHovered ? !!this.hoveredPort!.parameter : undefined;
      
      let connectingPortName: string | null = null;
      let isConnectingParameter: boolean | undefined = undefined;
      if (this.isConnecting && this.connectionStartNodeId === node.id) {
        connectingPortName = this.connectionStartParameter || this.connectionStartPort || null;
        isConnectingParameter = !!this.connectionStartParameter;
      }
      
      // Calculate connected parameters for this node
      const connectedParameters = new Set<string>();
      const spec = component.getSpec();
      if (!node.collapsed) {
        for (const [paramName, paramSpec] of Object.entries(spec.parameters)) {
          if (paramSpec.type === 'float' || paramSpec.type === 'int') {
            const hasConnection = this.graph.connections.some(
              conn => conn.targetNodeId === node.id && conn.targetParameter === paramName
            );
            if (hasConnection) {
              connectedParameters.add(paramName);
            }
          }
        }
      }
      
      // Update component state for ports
      const currentState = component.getState();
      component.setState({
        ...currentState,
        hoveredPortName,
        isHoveredParameter,
        connectingPortName,
        isConnectingParameter,
        connectedParameters
      });
      
      // Render ports
      component.renderPorts();
    }
  }
  
  private startEffectiveValueUpdates(): void {
    // Update effective values periodically (every 100ms for smooth animation)
    if (this.effectiveValueUpdateInterval) {
      clearInterval(this.effectiveValueUpdateInterval);
    }
    
    this.effectiveValueUpdateInterval = window.setInterval(() => {
      // Mark all nodes with animated parameters as dirty
      // Find all nodes with connected float parameters (which may have animated values)
      const nodesWithAnimatedParams = new Set<string>();
      for (const node of this.graph.nodes) {
        const spec = this.nodeSpecs.get(node.type);
        if (!spec) continue;
        for (const [paramName, paramSpec] of Object.entries(spec.parameters)) {
          if (paramSpec.type === 'float') {
            const hasConnection = this.graph.connections.some(
              conn => conn.targetNodeId === node.id && conn.targetParameter === paramName
            );
            if (hasConnection) {
              nodesWithAnimatedParams.add(node.id);
              break;
            }
          }
        }
      }
      if (nodesWithAnimatedParams.size > 0) {
        this.renderState.markNodesDirty(Array.from(nodesWithAnimatedParams));
        this.requestRender();
      }
    }, 100);
  }
  
  private stopEffectiveValueUpdates(): void {
    if (this.effectiveValueUpdateInterval) {
      clearInterval(this.effectiveValueUpdateInterval);
      this.effectiveValueUpdateInterval = null;
    }
  }
  
  public destroy(): void {
    this.stopEffectiveValueUpdates();
    // Cleanup edge scrolling
    if (this.edgeScrollAnimationFrame !== null) {
      cancelAnimationFrame(this.edgeScrollAnimationFrame);
    }
    // Cancel pending render frame
    if (this.pendingRenderFrame !== null) {
      cancelAnimationFrame(this.pendingRenderFrame);
      this.pendingRenderFrame = null;
      this.renderRequested = false;
    }
  }
  
  public setAudioManager(audioManager: AudioManager | undefined): void {
    this.audioManager = audioManager;
  }
  
  private renderRegularConnections(): void {
    // Render connections that are NOT connected to parameter ports
    // Always render all visible connections - dirty tracking controls when to trigger renders
    // Viewport culling filters out connections where both nodes are off-screen
    for (const conn of this.graph.connections) {
      if (!conn.targetParameter) {
        // If viewport culling is enabled, check if connection is visible
        // Check visibility before rendering (viewport culling)
        if (!this.isConnectionVisible(conn)) {
          continue; // Skip off-screen connections
        }
        this.renderConnection(conn);
      }
    }
  }
  
  private renderParameterConnections(): void {
    // Render connections that ARE connected to parameter ports (on top of nodes)
    // Always render all visible connections - dirty tracking controls when to trigger renders
    // Viewport culling filters out connections where both nodes are off-screen
    for (const conn of this.graph.connections) {
      if (conn.targetParameter) {
        // If viewport culling is enabled, check if connection is visible
        // Check visibility before rendering (viewport culling)
        if (!this.isConnectionVisible(conn)) {
          continue; // Skip off-screen connections
        }
        this.renderConnection(conn);
      }
    }
  }
  
  private renderConnection(conn: Connection): void {
    const sourceNode = this.graph.nodes.find(n => n.id === conn.sourceNodeId);
    const targetNode = this.graph.nodes.find(n => n.id === conn.targetNodeId);
    
    if (!sourceNode || !targetNode) return;
    
    const sourceSpec = this.nodeSpecs.get(sourceNode.type);
    const targetSpec = this.nodeSpecs.get(targetNode.type);
    const sourceMetrics = this.nodeMetrics.get(sourceNode.id);
    const targetMetrics = this.nodeMetrics.get(targetNode.id);
    
    if (!sourceSpec || !targetSpec || !sourceMetrics || !targetMetrics) return;
    
    const isSelected = this.state.selectedConnectionIds.has(conn.id);
    
    // Get actual port positions
    const sourcePortPos = sourceMetrics.portPositions.get(`output:${conn.sourcePort}`);
    
    // Handle parameter connections
    let targetPortPos: { x: number; y: number } | undefined;
    if (conn.targetParameter) {
      targetPortPos = targetMetrics.parameterInputPortPositions.get(conn.targetParameter);
    } else {
      targetPortPos = targetMetrics.portPositions.get(`input:${conn.targetPort}`);
    }
    
    if (!sourcePortPos || !targetPortPos) return;
    
    const sourceX = sourcePortPos.x;
    const sourceY = sourcePortPos.y;
    const targetX = targetPortPos.x;
    const targetY = targetPortPos.y;
    
    // Bezier curve with strong horizontal movement
    // Output connections: move straight right first (100px)
    // Input connections: come in straight from left (100px)
    const cp1X = sourceX + 100;
    const cp1Y = sourceY;
    const cp2X = targetX - 100;
    const cp2Y = targetY;
    
    // Get connection color based on source port type
    const sourcePortSpec = sourceSpec.outputs.find(p => p.name === conn.sourcePort);
    const portType = sourcePortSpec?.type || 'float';
    
    // Map port type to connection color token
    const connectionColorMap: Record<string, string> = {
      'float': 'connection-color-float',
      'vec2': 'connection-color-vec2',
      'vec3': 'connection-color-vec3',
      'vec4': 'connection-color-vec4',
      'int': 'connection-color-int',
      'bool': 'connection-color-bool'
    };
    const connectionColorToken = connectionColorMap[portType] || 'connection-color-default';
    const connectionColor = getCSSColor(connectionColorToken, getCSSColor('connection-color-default', getCSSColor('color-gray-100', '#747e87')));
    const connectionWidth = isSelected
      ? getCSSVariableAsNumber('connection-width-selected', 3)
      : getCSSVariableAsNumber('connection-width', 2);
    const connectionOpacity = isSelected
      ? getCSSVariableAsNumber('connection-opacity-selected', 1.0)
      : getCSSVariableAsNumber('connection-opacity', 0.8);
    
    this.ctx.strokeStyle = connectionColor;
    this.ctx.lineWidth = connectionWidth;
    this.ctx.globalAlpha = connectionOpacity;
    
    this.ctx.beginPath();
    this.ctx.moveTo(sourceX, sourceY);
    this.ctx.bezierCurveTo(cp1X, cp1Y, cp2X, cp2Y, targetX, targetY);
    this.ctx.stroke();
    
    this.ctx.globalAlpha = 1.0;
  }
  
  private renderTemporaryConnection(): void {
    if (!this.connectionStartNodeId) return;
    
    const sourceNode = this.graph.nodes.find(n => n.id === this.connectionStartNodeId);
    if (!sourceNode) return;
    
    const sourceSpec = this.nodeSpecs.get(sourceNode.type);
    const sourceMetrics = this.nodeMetrics.get(sourceNode.id);
    if (!sourceSpec || !sourceMetrics) return;
    
    // Get actual port position
    let sourcePortPos: { x: number; y: number } | undefined;
    
    if (this.connectionStartParameter) {
      // Parameter port
      sourcePortPos = sourceMetrics.parameterInputPortPositions.get(this.connectionStartParameter);
    } else if (this.connectionStartPort) {
      // Regular port
      const portKey = `${this.connectionStartIsOutput ? 'output' : 'input'}:${this.connectionStartPort}`;
      sourcePortPos = sourceMetrics.portPositions.get(portKey);
    }
    
    if (!sourcePortPos) return;
    
    const rect = this.canvas.getBoundingClientRect();
    let targetX = (this.connectionMouseX - rect.left - this.state.panX) / this.state.zoom;
    let targetY = (this.connectionMouseY - rect.top - this.state.panY) / this.state.zoom;
    
    let isSnapped = false;
    
    // Use hoveredPort if available (set by PortConnectHandler) - this is more reliable than hit testing again
    // Fallback to hitTestPort if hoveredPort is not set (for old code path)
    const portHit = this.hoveredPort || this.hitTestPort(this.connectionMouseX, this.connectionMouseY);
    if (portHit && portHit.nodeId !== this.connectionStartNodeId) {
      // Check if this is a valid target port
      const isValidTarget = this.connectionStartIsOutput 
        ? !portHit.isOutput  // Dragging from output: can connect to input ports or parameters
        : portHit.isOutput;  // Dragging from input: can connect to output ports
      
      if (isValidTarget) {
        // Get the port position and snap to it
        const targetNode = this.graph.nodes.find(n => n.id === portHit.nodeId);
        const targetSpec = this.nodeSpecs.get(targetNode?.type || '');
        const targetMetrics = this.nodeMetrics.get(portHit.nodeId);
        
        if (targetNode && targetSpec && targetMetrics) {
          let snappedPortPos: { x: number; y: number } | undefined;
          
          if (portHit.parameter) {
            // Parameter port
            snappedPortPos = targetMetrics.parameterInputPortPositions.get(portHit.parameter);
          } else {
            // Regular port
            const portKey = `${portHit.isOutput ? 'output' : 'input'}:${portHit.port}`;
            snappedPortPos = targetMetrics.portPositions.get(portKey);
          }
          
          if (snappedPortPos) {
            targetX = snappedPortPos.x;
            targetY = snappedPortPos.y;
            isSnapped = true;
          }
        }
      }
    }
    
    const sourceX = sourcePortPos.x;
    const sourceY = sourcePortPos.y;
    
    // Bezier curve with strong horizontal movement
    // Output connections: move straight right first (100px), then come in from left
    // Input connections: move straight left first (100px), then come in from right
    const cp1X = this.connectionStartIsOutput ? sourceX + 100 : sourceX - 100;
    const cp1Y = sourceY;
    const cp2X = this.connectionStartIsOutput ? targetX - 100 : targetX + 100;
    const cp2Y = targetY;
    
    // Get connection color based on source port type
    let portType: string = 'float';
    if (this.connectionStartParameter) {
      // For parameter connections, get type from parameter spec
      const paramSpec = sourceSpec.parameters[this.connectionStartParameter];
      if (paramSpec) {
        // Map parameter types to port types (some parameter types match port types)
        portType = paramSpec.type === 'vec4' ? 'vec4' : 
                   paramSpec.type === 'float' || paramSpec.type === 'int' ? 'float' : 'float';
      }
    } else if (this.connectionStartPort) {
      // For regular port connections, get type from port spec
      if (this.connectionStartIsOutput) {
        const portSpec = sourceSpec.outputs.find(p => p.name === this.connectionStartPort);
        portType = portSpec?.type || 'float';
      } else {
        const portSpec = sourceSpec.inputs.find(p => p.name === this.connectionStartPort);
        portType = portSpec?.type || 'float';
      }
    }
    
    // Map port type to connection color token
    const connectionColorMap: Record<string, string> = {
      'float': 'connection-color-float',
      'vec2': 'connection-color-vec2',
      'vec3': 'connection-color-vec3',
      'vec4': 'connection-color-vec4',
      'int': 'connection-color-int',
      'bool': 'connection-color-bool'
    };
    const connectionColorToken = connectionColorMap[portType] || 'connection-color-default';
    const connectionColor = getCSSColor(connectionColorToken, getCSSColor('connection-color-default', getCSSColor('color-gray-100', '#747e87')));
    
    // Draw preview port at cursor position first (smaller, slightly transparent)
    // We'll render it directly here since renderPort is private
    const previewScale = 0.8; // 80% size
    const previewOpacity = 0.7; // 70% opacity
    const previewRadius = getCSSVariableAsNumber('port-radius', 4) * previewScale;
    
    // Draw highlight circle (connecting state) - use green color from token
    const highlightRadius = previewRadius * 3.5;
    const draggingColorRGBA = getCSSColorRGBA('port-dragging-color', { r: 0, g: 255, b: 136, a: 1 });
    const draggingOuterOpacity = getCSSVariableAsNumber('port-dragging-outer-opacity', 0.6);
    
    // Calculate actual opacity value (multiply before using in string)
    const actualOuterOpacity = draggingOuterOpacity * previewOpacity;
    
    // Draw larger transparent circle behind (outer highlight)
    this.ctx.fillStyle = `rgba(${draggingColorRGBA.r}, ${draggingColorRGBA.g}, ${draggingColorRGBA.b}, ${actualOuterOpacity})`;
    this.ctx.beginPath();
    this.ctx.arc(targetX, targetY, highlightRadius, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Draw solid green port on top (inner circle)
    this.ctx.fillStyle = `rgba(${draggingColorRGBA.r}, ${draggingColorRGBA.g}, ${draggingColorRGBA.b}, ${previewOpacity})`;
    this.ctx.beginPath();
    this.ctx.arc(targetX, targetY, previewRadius, 0, Math.PI * 2);
    this.ctx.fill();
    
    const tempConnectionWidth = getCSSVariableAsNumber('connection-width', 2);
    this.ctx.strokeStyle = connectionColor;
    this.ctx.lineWidth = tempConnectionWidth;
    
    // Use dotted line when not snapped, solid when snapped
    if (isSnapped) {
      // Solid line when snapped
      this.ctx.setLineDash([]);
    } else {
      // Dotted line when not snapped
      const dashPattern = [2, 18]; // 2px dash, 10px gap
      this.ctx.setLineDash(dashPattern);
    }
    
    this.ctx.beginPath();
    this.ctx.moveTo(sourceX, sourceY);
    this.ctx.bezierCurveTo(cp1X, cp1Y, cp2X, cp2Y, targetX, targetY);
    this.ctx.stroke();
    
    // Reset line dash pattern to prevent state leakage
    this.ctx.setLineDash([]);
  }
  
  // Public API
  setGraph(graph: NodeGraph): void {
    // Phase 3.3: Invalidate connection path caches when graph structure changes
    // Check if connections changed and invalidate caches
    const oldConnectionIds = new Set(this.graph.connections.map(c => c.id));
    const newConnectionIds = new Set(graph.connections.map(c => c.id));
    
    // Invalidate caches for removed connections
    for (const connId of oldConnectionIds) {
      if (!newConnectionIds.has(connId)) {
        this.connectionLayerRenderer?.invalidateConnection(connId);
        this.parameterConnectionLayerRenderer?.invalidateConnection(connId);
      }
    }
    
    // Clear all caches if connection count changed significantly (indicates major change)
    if (Math.abs(this.graph.connections.length - graph.connections.length) > 5) {
      this.connectionLayerRenderer?.clearCache();
      this.parameterConnectionLayerRenderer?.clearCache();
    }
    
    // Clean up NodeComponents for nodes that no longer exist (Phase 2.2)
    const currentNodeIds = new Set(graph.nodes.map(n => n.id));
    for (const [nodeId, component] of this.nodeComponents) {
      if (!currentNodeIds.has(nodeId)) {
        component.unmount();
        this.nodeComponents.delete(nodeId);
      }
    }
    this.graph = graph;
    // Update state from graph viewState
    if (graph.viewState) {
      this.state.zoom = Math.max(0.10, graph.viewState.zoom ?? this.state.zoom);
      this.state.panX = graph.viewState.panX ?? this.state.panX;
      this.state.panY = graph.viewState.panY ?? this.state.panY;
      this.state.selectedNodeIds = new Set(graph.viewState.selectedNodeIds ?? []);
    }
    this.updateNodeMetrics();
    // Update render state with new graph
    this.renderState.updateGraph(graph);
    this.renderState.markFullRedraw();
    this.requestRender();
  }
  
  setNodeSpecs(nodeSpecs: NodeSpec[]): void {
    this.nodeSpecs.clear();
    for (const spec of nodeSpecs) {
      this.nodeSpecs.set(spec.id, spec);
    }
    this.updateNodeMetrics();
    this.render();
  }
  
  /**
   * Fit the view to show all nodes in the graph
   */
  fitToView(): void {
    if (this.graph.nodes.length === 0) {
      return;
    }
    
    // Calculate bounding box of all nodes
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    
    for (const node of this.graph.nodes) {
      const metrics = this.nodeMetrics.get(node.id);
      if (!metrics) continue;
      
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + metrics.width);
      maxY = Math.max(maxY, node.position.y + metrics.height);
    }
    
    // If no valid bounding box, return
    if (minX === Infinity || minY === Infinity) {
      return;
    }
    
    // Add padding around the nodes (20% on each side)
    const padding = 0.2;
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    const paddedWidth = contentWidth * (1 + padding * 2);
    const paddedHeight = contentHeight * (1 + padding * 2);
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    
    // Get canvas dimensions
    const rect = this.canvas.getBoundingClientRect();
    const canvasWidth = rect.width;
    const canvasHeight = rect.height;
    
    // Calculate zoom to fit content
    const zoomX = canvasWidth / paddedWidth;
    const zoomY = canvasHeight / paddedHeight;
    const zoom = Math.max(0.10, Math.min(zoomX, zoomY, 2.0)); // Cap zoom at 2.0 to avoid too much zoom, minimum 0.10
    
    // Calculate pan to center content
    const panX = (canvasWidth / 2) - (centerX * zoom);
    const panY = (canvasHeight / 2) - (centerY * zoom);
    
    // Update state
    this.state.zoom = zoom;
    this.state.panX = panX;
    this.state.panY = panY;
    
    // View state change affects everything
    this.renderState.markFullRedraw();
    this.requestRender();
  }
  
  getViewState() {
    return {
      zoom: this.state.zoom,
      panX: this.state.panX,
      panY: this.state.panY,
      selectedNodeIds: Array.from(this.state.selectedNodeIds)
    };
  }
  
  /**
   * Set zoom to a specific value, optionally centering on a point
   * @param zoom - Zoom level (1.0 = 100%)
   * @param centerX - Optional screen X coordinate to center on (default: canvas center)
   * @param centerY - Optional screen Y coordinate to center on (default: canvas center)
   */
  setZoom(zoom: number, centerX?: number, centerY?: number): void {
    const newZoom = Math.max(0.10, Math.min(5.0, zoom));
    const rect = this.canvas.getBoundingClientRect();
    
    // Default to canvas center if no center point provided
    const screenX = centerX ?? rect.width / 2;
    const screenY = centerY ?? rect.height / 2;
    
    // Get mouse position in canvas coordinates before zoom
    const canvasPos = this.screenToCanvas(screenX, screenY);
    
    // Calculate new pan to keep the center point fixed in canvas space
    const newPanX = screenX - canvasPos.x * newZoom;
    const newPanY = screenY - canvasPos.y * newZoom;
    
    // Update state
    this.state.zoom = newZoom;
    this.state.panX = newPanX;
    this.state.panY = newPanY;
    
    // View state change affects everything
    this.renderState.markFullRedraw();
    this.requestRender();
  }
  
  getNodeRenderer(): NodeRenderer {
    return this.nodeRenderer;
  }
  
  getNodeMetrics(): Map<string, NodeRenderMetrics> {
    return this.nodeMetrics;
  }
  
  /**
   * Create a HandlerContext for interaction handlers (Phase 2.4)
   * This allows handlers to access canvas state and methods without tight coupling
   */
  public createHandlerContext(): HandlerContext {
    return {
      getState: () => ({ ...this.state }),
      setState: (updater) => {
        this.state = updater(this.state);
      },
      getGraph: () => this.graph,
      getNodeSpecs: () => this.nodeSpecs,
      screenToCanvas: (screenX, screenY) => this.screenToCanvas(screenX, screenY),
      canvasToScreen: (canvasX, canvasY) => this.canvasToScreen(canvasX, canvasY),
      requestRender: () => this.requestRender(),
      render: () => this.render(),
      setCursor: (cursor) => { this.canvas.style.cursor = cursor; },
      onNodeMoved: this.onNodeMoved,
      onNodeSelected: this.onNodeSelected,
      onConnectionCreated: (...args) => {
        // Access callback dynamically (it may be set after HandlerContext creation)
        if (this.onConnectionCreated) {
          this.onConnectionCreated(...args);
        } else {
          console.warn('[NodeEditorCanvas] onConnectionCreated callback not set yet');
        }
      },
      onParameterChanged: (nodeId, paramName, value) => {
        // Access callback dynamically (it may be set after HandlerContext creation)
        if (this.onParameterChanged) {
          this.onParameterChanged(nodeId, paramName, value);
        } else {
          console.warn('[NodeEditorCanvas] onParameterChanged callback not set yet');
        }
      },
      onParameterInputModeChanged: (nodeId, paramName, mode) => {
        // Access callback dynamically (it may be set after HandlerContext creation)
        if (this.onParameterInputModeChanged) {
          this.onParameterInputModeChanged(nodeId, paramName, mode);
        } else {
          console.warn('[NodeEditorCanvas] onParameterInputModeChanged callback not set yet');
        }
      },
      isFeatureEnabled: () => true, // All features enabled
      isSpacePressed: () => this.isSpacePressed,
      hitTestNode: (screenX, screenY) => this.hitTestNode(screenX, screenY),
      getNodeMetrics: (nodeId) => this.nodeMetrics.get(nodeId),
      calculateSmartGuides: (draggingNode, proposedX, proposedY) => this.calculateSmartGuides(draggingNode, proposedX, proposedY),
      invalidateNodeMetrics: (nodeId) => {
        this.nodeMetrics.delete(nodeId);
        this.nodeRenderer.invalidateMetrics(nodeId);
        const component = this.nodeComponents.get(nodeId);
        if (component) {
          component.invalidateMetrics();
        }
      },
      setSmartGuides: (guides) => {
        this.smartGuides = guides;
      },
      setDraggedNodeIds: (nodeIds: string[]) => {
        // Phase 3.4: Track dragged nodes for metrics recalculation before connection rendering
        this.draggedNodeIds = new Set(nodeIds);
      },
      markNodesDirty: (nodeIds) => {
        this.renderState.markNodesDirty(nodeIds);
      },
      markConnectionsDirty: (connectionIds) => {
        this.renderState.markConnectionsDirty(connectionIds);
      },
      markLayerDirty: (layer) => {
        this.renderState.markLayerDirty(layer);
      },
      hitTestPort: (screenX, screenY) => this.hitTestPort(screenX, screenY),
      hitTestParameter: (screenX, screenY) => this.hitTestParameter(screenX, screenY),
      hitTestBezierControlPoint: (screenX, screenY) => this.hitTestBezierControlPoint(screenX, screenY),
      hitTestConnection: (screenX, screenY) => this.hitTestConnection(screenX, screenY),
      onConnectionSelected: this.onConnectionSelected,
      setConnectionState: (state) => {
        this.isConnecting = state.isConnecting;
        this.connectionStartNodeId = state.connectionStartNodeId;
        this.connectionStartPort = state.connectionStartPort;
        this.connectionStartParameter = state.connectionStartParameter;
        this.connectionStartIsOutput = state.connectionStartIsOutput;
        this.connectionMouseX = state.connectionMouseX;
        this.connectionMouseY = state.connectionMouseY;
        this.hoveredPort = state.hoveredPort;
      },
      setPanState: (state) => {
        this.isPanning = state.isPanning;
        this.potentialBackgroundPan = state.potentialBackgroundPan;
        this._panStartX = state.panStartX;
        this._panStartY = state.panStartY;
        this.backgroundDragStartX = state.backgroundDragStartX;
        this.backgroundDragStartY = state.backgroundDragStartY;
      },
      getCanvasRect: () => this.canvas.getBoundingClientRect(),
      getActiveTool: () => this.activeTool,
      setSelectionRectangle: (rect) => {
        this.selectionRectangle = rect;
        this.renderState.markLayerDirty(RenderLayer.Overlays);
        this.requestRender();
      }
    };
  }
  
  setCallbacks(callbacks: {
    onNodeMoved?: (nodeId: string, x: number, y: number) => void;
    onNodeSelected?: (nodeId: string | null, multiSelect: boolean) => void;
    onConnectionCreated?: (sourceNodeId: string, sourcePort: string, targetNodeId: string, targetPort?: string, targetParameter?: string) => void;
    onConnectionSelected?: (connectionId: string | null, multiSelect: boolean) => void;
    onNodeDeleted?: (nodeId: string) => void;
    onConnectionDeleted?: (connectionId: string) => void;
    onParameterChanged?: (nodeId: string, paramName: string, value: number) => void;
    onFileParameterChanged?: (nodeId: string, paramName: string, file: File) => void;
    onParameterInputModeChanged?: (nodeId: string, paramName: string, mode: import('../../types/nodeSpec').ParameterInputMode) => void;
    onNodeLabelChanged?: (nodeId: string, label: string | undefined) => void;
    onSpacebarStateChange?: (isPressed: boolean) => void;
    isDialogVisible?: () => boolean;
    onTypeLabelClick?: (portType: string, screenX: number, screenY: number) => void;
  }): void {
    this.onNodeMoved = callbacks.onNodeMoved;
    this.onNodeSelected = callbacks.onNodeSelected;
    this.onConnectionCreated = callbacks.onConnectionCreated;
    this.onConnectionSelected = callbacks.onConnectionSelected;
    this.onNodeDeleted = callbacks.onNodeDeleted;
    this.onConnectionDeleted = callbacks.onConnectionDeleted;
    this.onParameterChanged = callbacks.onParameterChanged;
    this.onFileParameterChanged = callbacks.onFileParameterChanged;
    this.onParameterInputModeChanged = callbacks.onParameterInputModeChanged;
    this.onNodeLabelChanged = callbacks.onNodeLabelChanged;
    this.onSpacebarStateChange = callbacks.onSpacebarStateChange;
    this.isDialogVisible = callbacks.isDialogVisible;
    this.onTypeLabelClick = callbacks.onTypeLabelClick;
  }
  
  /**
   * Set the spacebar state change callback (for visual feedback)
   */
  public setSpacebarStateChangeCallback(callback: (isPressed: boolean) => void): void {
    this.onSpacebarStateChange = callback;
  }

  /**
   * Handle file parameter click - show file input dialog
   */
  private handleFileParameterClick(nodeId: string, paramName: string, _screenX: number, _screenY: number): void {
    // Create hidden file input
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'audio/mpeg,audio/mp3,.mp3';
    fileInput.style.display = 'none';
    
    fileInput.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        this.onFileParameterChanged?.(nodeId, paramName, file);
      }
      document.body.removeChild(fileInput);
    });
    
    // Position and trigger
    document.body.appendChild(fileInput);
    fileInput.click();
  }

  /**
   * Handle frequency bands parameter click - show frequency bands editor modal
   */
  private handleFrequencyBandsParameterClick(nodeId: string, paramName: string, _screenX: number, _screenY: number): void {
    const node = this.graph.nodes.find(n => n.id === nodeId);
    const spec = this.nodeSpecs.get(node?.type || '');
    if (!node || !spec) return;

    const paramSpec = spec.parameters[paramName];
    if (!paramSpec || paramSpec.type !== 'array') return;

    // Get current value or default
    const currentValue = node.parameters[paramName] ?? paramSpec.default;
    const bandsArray = Array.isArray(currentValue) ? currentValue : paramSpec.default as number[][];
    
    // Ensure it's an array of arrays
    if (!Array.isArray(bandsArray) || (bandsArray.length > 0 && !Array.isArray(bandsArray[0]))) {
      console.warn('Invalid frequency bands format');
      return;
    }

    // Initialize editor if needed
    if (!this.frequencyBandsEditor) {
      this.frequencyBandsEditor = new FrequencyBandsEditor({
        onApply: (bands) => {
          // Convert FrequencyBand[] to number[][]
          const bandsArray = bands.map(band => [band.minHz, band.maxHz]);
          // Type cast needed because callback signature expects number, but frequencyBands is an array
          this.onParameterChanged?.(nodeId, paramName, bandsArray as any);
          this.render();
        },
        onCancel: () => {
          // Nothing to do on cancel
        }
      });
    }

    // Show the editor with current bands
    this.frequencyBandsEditor.show(bandsArray as number[][]);
  }

  /**
   * Handle enum parameter click - show dropdown menu
   */
  private handleEnumParameterClick(nodeId: string, paramName: string, screenX: number, screenY: number): void {
    const node = this.graph.nodes.find(n => n.id === nodeId);
    const spec = this.nodeSpecs.get(node?.type || '');
    if (!node || !spec) return;

    const paramSpec = spec.parameters[paramName];
    if (!paramSpec || paramSpec.type !== 'int') return;

    // Get enum mappings from NodeRenderer
    const enumMappings = this.nodeRenderer.getEnumMappings(spec.id, paramName);
    if (!enumMappings) return;

    // Initialize dropdown if needed
    if (!this.enumDropdown) {
      this.enumDropdown = new DropdownMenu();
    }

    // If dropdown is already open, close it (toggle behavior)
    if (this.enumDropdown.isVisible()) {
      this.enumDropdown.hide();
      return;
    }

    // Get current value
    const currentValue = (node.parameters[paramName] ?? paramSpec.default) as number;

    // Create dropdown items
    const items: DropdownMenuItem[] = Object.entries(enumMappings)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .map(([valueStr, label]) => {
        const value = parseInt(valueStr);
        return {
          label,
          disabled: false,
          action: () => {
            if (value !== currentValue) {
              this.onParameterChanged?.(nodeId, paramName, value);
              this.render();
            }
          }
        };
      });

    // Calculate dropdown position based on enum selector position
    const metrics = this.nodeMetrics.get(nodeId);
    if (!metrics) {
      // Fallback to click position if metrics not available
      this.enumDropdown.show(screenX, screenY, items);
      return;
    }

    const gridPos = metrics.parameterGridPositions.get(paramName);
    if (!gridPos) {
      // Fallback to click position if grid position not available
      this.enumDropdown.show(screenX, screenY, items);
      return;
    }

    // Calculate enum selector position (matching EnumParameterRenderer logic)
    const cellPadding = getCSSVariableAsNumber('param-cell-padding', 12);
    const labelFontSize = getCSSVariableAsNumber('param-label-font-size', 11);
    const selectorHeight = getCSSVariableAsNumber('enum-selector-height', 32);
    const selectorSpacing = getCSSVariableAsNumber('param-label-knob-spacing', 20);
    
    // Position selector below label
    const labelBottom = gridPos.labelY + labelFontSize;
    const selectorY = labelBottom + selectorSpacing;
    const selectorX = gridPos.cellX + cellPadding;

    // Convert canvas coordinates to screen coordinates
    const selectorBottomScreen = this.canvasToScreen(selectorX, selectorY + selectorHeight);
    const selectorLeftScreen = this.canvasToScreen(selectorX, selectorY);

    // Position dropdown below the selector, aligned with left edge
    const dropdownY = selectorBottomScreen.y + 4; // 4px gap
    const dropdownX = selectorLeftScreen.x;

    this.enumDropdown.show(dropdownX, dropdownY, items);
  }
}
