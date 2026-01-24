// Node Editor Canvas Component
// Implements infinite canvas with pan/zoom, grid, and node/connection rendering

import type { NodeGraph, NodeInstance, Connection } from '../../types/nodeGraph';
import type { NodeSpec } from '../../types/nodeSpec';
import { NodeRenderer, type NodeRenderMetrics } from './NodeRenderer';
import { getCSSColor, getCSSVariableAsNumber, getCSSVariable, getCSSColorRGBA } from '../../utils/cssTokens';
import { computeEffectiveParameterValue } from '../../utils/parameterValueCalculator';
import type { AudioManager } from '../../runtime/AudioManager';

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
  
  // Interaction state
  private isPanning: boolean = false;
  private panStartX: number = 0;
  private panStartY: number = 0;
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
  
  // Edge scrolling state
  private edgeScrollAnimationFrame: number | null = null;
  private edgeScrollVelocityX: number = 0;
  private edgeScrollVelocityY: number = 0;
  private currentMouseX: number = 0;
  private currentMouseY: number = 0;
  private readonly EDGE_SCROLL_ZONE = 0.1; // 10% of width/height
  private readonly MAX_EDGE_SCROLL_SPEED = 800; // pixels per second
  
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
  private isDialogVisible?: () => boolean;
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
      this.render();
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
  
  private resizeObserver: ResizeObserver | null = null;

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
    this.resizeObserver = new ResizeObserver(() => {
      this.resize();
      this.render();
    });
    this.resizeObserver.observe(this.canvas);
    
    // Also listen to window resize as fallback
    window.addEventListener('resize', () => {
      this.resize();
      this.render();
    });
  }
  
  private resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    // Setting width/height resets the context, so we need to reapply scale
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    // Reset transform and apply device pixel ratio scaling
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);
  }
  
  // Coordinate conversion
  private screenToCanvas(screenX: number, screenY: number): { x: number, y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const x = (screenX - rect.left - this.state.panX) / this.state.zoom;
    const y = (screenY - rect.top - this.state.panY) / this.state.zoom;
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
          if (paramSpec && paramSpec.type === 'float') {
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
      
      // Calculate slider UI area (same as in renderRangeEditor)
      const gridPadding = getCSSVariableAsNumber('node-body-padding', 18);
      const sliderUIHeight = getCSSVariableAsNumber('range-editor-height', 260);
      const sliderUIPadding = 12;
      const editorPadding = getCSSVariableAsNumber('range-editor-padding', 12);
      const sliderWidth = getCSSVariableAsNumber('range-editor-slider-width', 18);
      const handleSize = getCSSVariableAsNumber('range-editor-handle-size', 12);
      const topMargin = 12;
      const bottomMargin = 12;
      
      const sliderUIX = node.position.x + gridPadding;
      const sliderUIY = node.position.y + metrics.headerHeight + gridPadding;
      const sliderUIWidth = metrics.width - gridPadding * 2;
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

  private hitTestParameter(mouseX: number, mouseY: number): { nodeId: string, paramName: string, isString?: boolean } | null {
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
      this.ctx.font = `${nameWeight} ${nameSize}px sans-serif`;
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
  
  // Public method to check if a click is on a parameter (for double-click handling)
  public hitTestParameterAtScreen(screenX: number, screenY: number): { nodeId: string, paramName: string } | null {
    return this.hitTestParameter(screenX, screenY);
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
    input.style.fontFamily = 'monospace';
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
    this.ctx.font = `${nameWeight} ${nameSize}px sans-serif`;
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
    input.style.fontFamily = 'sans-serif';
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
      this.onNodeDeleted?.(deleteHit);
      this.render();
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
    
    // Check for bezier control point hit (before parameter hit to prioritize)
    const bezierHit = this.hitTestBezierControlPoint(mouseX, mouseY);
    if (bezierHit && !this.isSpacePressed) {
      const node = this.graph.nodes.find(n => n.id === bezierHit.nodeId);
      const spec = this.nodeSpecs.get(node?.type || '');
      if (node && spec) {
        this.isDraggingBezierControl = true;
        this.draggingBezierNodeId = bezierHit.nodeId;
        this.draggingBezierControlIndex = bezierHit.controlIndex;
        
        // Store initial parameter values
        const x1 = (node.parameters.x1 ?? spec.parameters.x1?.default ?? 0) as number;
        const y1 = (node.parameters.y1 ?? spec.parameters.y1?.default ?? 0) as number;
        const x2 = (node.parameters.x2 ?? spec.parameters.x2?.default ?? 1) as number;
        const y2 = (node.parameters.y2 ?? spec.parameters.y2?.default ?? 1) as number;
        this.dragBezierStartValues = { x1, y1, x2, y2 };
        
        this.canvas.style.cursor = 'move';
        return;
      }
    }
    
    // Check for parameter hit (for dragging or file input)
    const paramHit = this.hitTestParameter(mouseX, mouseY);
    if (paramHit && !this.isSpacePressed) {
      // Handle string parameters (file inputs) specially
      if (paramHit.isString) {
        this.handleFileParameterClick(paramHit.nodeId, paramHit.paramName, mouseX, mouseY);
        return;
      }
      
      const node = this.graph.nodes.find(n => n.id === paramHit.nodeId);
      const spec = this.nodeSpecs.get(node?.type || '');
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
    
    // Check for port hit
    const portHit = this.hitTestPort(mouseX, mouseY);
    if (portHit) {
      this.isConnecting = true;
      this.connectionStartNodeId = portHit.nodeId;
      this.connectionStartPort = portHit.port;
      this.connectionStartParameter = portHit.parameter || null;
      this.connectionStartIsOutput = portHit.isOutput;
      this.connectionMouseX = mouseX;
      this.connectionMouseY = mouseY;
      this.hoveredPort = null;
      this.canvas.style.cursor = 'crosshair';
      return;
    }
    
    // Check for node hit (but allow panning if spacebar is pressed)
    const nodeHit = this.hitTestNode(mouseX, mouseY);
    if (nodeHit && !this.isSpacePressed) {
      // Check if clicking on node header (for dragging)
      const node = this.graph.nodes.find(n => n.id === nodeHit)!;
      const metrics = this.nodeMetrics.get(nodeHit);
      if (!metrics) return;
      
      const canvasPos = this.screenToCanvas(mouseX, mouseY);
      const headerHeight = metrics.headerHeight;
      
      if (canvasPos.y - node.position.y < headerHeight) {
        // Clicked on header - prepare for potential drag (with threshold)
        // Handle selection first (for multi-select with shift-click)
        const multiSelect = e.shiftKey;
        if (!multiSelect) {
          // Single click: clear selection and select only this node
          if (!this.state.selectedNodeIds.has(nodeHit)) {
            this.state.selectedNodeIds.clear();
            this.state.selectedConnectionIds.clear();
            this.state.selectedNodeIds.add(nodeHit);
            this.onNodeSelected?.(nodeHit, false);
          }
        } else {
          // Shift-click: toggle selection
          if (this.state.selectedNodeIds.has(nodeHit)) {
            this.state.selectedNodeIds.delete(nodeHit);
          } else {
            this.state.selectedNodeIds.add(nodeHit);
          }
          this.onNodeSelected?.(nodeHit, true);
        }
        
        this.potentialNodeDrag = true;
        this.potentialNodeDragId = nodeHit;
        this.nodeDragStartX = mouseX;
        this.nodeDragStartY = mouseY;
        const nodeScreenPos = this.canvasToScreen(node.position.x, node.position.y);
        this.dragOffsetX = mouseX - nodeScreenPos.x;
        this.dragOffsetY = mouseY - nodeScreenPos.y;
        this.canvas.style.cursor = 'grab';
        this.render();
      } else {
        // Clicked on node body - select node
        const multiSelect = e.shiftKey;
        if (!multiSelect) {
          this.state.selectedNodeIds.clear();
          this.state.selectedConnectionIds.clear();
        }
        if (this.state.selectedNodeIds.has(nodeHit)) {
          this.state.selectedNodeIds.delete(nodeHit);
        } else {
          this.state.selectedNodeIds.add(nodeHit);
        }
        this.onNodeSelected?.(nodeHit, multiSelect);
        this.render();
      }
      return;
    }
    
    // Check for connection hit
    const connHit = this.hitTestConnection(mouseX, mouseY);
    if (connHit) {
      const multiSelect = e.shiftKey;
      if (!multiSelect) {
        this.state.selectedNodeIds.clear();
        this.state.selectedConnectionIds.clear();
      }
      if (this.state.selectedConnectionIds.has(connHit)) {
        this.state.selectedConnectionIds.delete(connHit);
      } else {
        this.state.selectedConnectionIds.add(connHit);
      }
      this.onConnectionSelected?.(connHit, multiSelect);
      this.render();
      return;
    }
    
    // Clicked on empty canvas
    if (e.button === 0) { // Left click
      // Start panning if space is held
      if (this.isSpacePressed) {
        this.isPanning = true;
        this.panStartX = mouseX - this.state.panX;
        this.panStartY = mouseY - this.state.panY;
        this.canvas.style.cursor = 'grabbing';
      } else {
        // Set up potential background pan (will start if user drags)
        this.potentialBackgroundPan = true;
        this.backgroundDragStartX = mouseX;
        this.backgroundDragStartY = mouseY;
        // Deselect all immediately
        this.state.selectedNodeIds.clear();
        this.state.selectedConnectionIds.clear();
        this.onNodeSelected?.(null, false);
        this.render();
      }
    } else if (e.button === 1) { // Middle mouse
      this.isPanning = true;
      this.panStartX = mouseX - this.state.panX;
      this.panStartY = mouseY - this.state.panY;
      this.canvas.style.cursor = 'grabbing';
    }
  }
  
  private handleMouseMove(e: MouseEvent): void {
    const mouseX = e.clientX;
    const mouseY = e.clientY;
    
    // Store current mouse position for edge scrolling
    this.currentMouseX = mouseX;
    this.currentMouseY = mouseY;
    
    // Check if we should start background panning
    if (this.potentialBackgroundPan && !this.isPanning) {
      const dx = mouseX - this.backgroundDragStartX;
      const dy = mouseY - this.backgroundDragStartY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > this.backgroundDragThreshold) {
        // Start panning
        this.isPanning = true;
        this.potentialBackgroundPan = false;
        this.panStartX = this.backgroundDragStartX - this.state.panX;
        this.panStartY = this.backgroundDragStartY - this.state.panY;
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
    
    if (this.isPanning) {
      this.state.panX = mouseX - this.panStartX;
      this.state.panY = mouseY - this.panStartY;
      this.render();
    } else if (this.isDraggingNode && this.draggingNodeId && this.draggingNodeInitialPos) {
      const node = this.graph.nodes.find(n => n.id === this.draggingNodeId)!;
      const canvasPos = this.screenToCanvas(mouseX - this.dragOffsetX, mouseY - this.dragOffsetY);
      
      // Calculate smart guides and snap position for the primary dragged node
      const { snappedX, snappedY, guides } = this.calculateSmartGuides(node, canvasPos.x, canvasPos.y);
      
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
      
      this.smartGuides = guides;
      this.render();
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
   * Check if a node is visible in the viewport (fully or partially)
   */
  private isNodeVisible(node: NodeInstance, metrics: NodeRenderMetrics): boolean {
    const rect = this.canvas.getBoundingClientRect();
    
    // Calculate viewport bounds in canvas coordinates
    const viewportLeft = -this.state.panX / this.state.zoom;
    const viewportTop = -this.state.panY / this.state.zoom;
    const viewportRight = (rect.width - this.state.panX) / this.state.zoom;
    const viewportBottom = (rect.height - this.state.panY) / this.state.zoom;
    
    // Calculate node bounds
    const nodeLeft = node.position.x;
    const nodeTop = node.position.y;
    const nodeRight = node.position.x + metrics.width;
    const nodeBottom = node.position.y + metrics.height;
    
    // Check if node overlaps with viewport
    return !(
      nodeRight < viewportLeft ||
      nodeLeft > viewportRight ||
      nodeBottom < viewportTop ||
      nodeTop > viewportBottom
    );
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
   * Render smart guide lines
   */
  private renderSmartGuides(): void {
    if (this.smartGuides.vertical.length === 0 && this.smartGuides.horizontal.length === 0) {
      return;
    }
    
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
    
    this.ctx.setLineDash([]);
    this.ctx.globalAlpha = 1.0;
  }
  
  private handleMouseUp(e: MouseEvent): void {
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
    
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Zoom at mouse position
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(10, this.state.zoom * zoomFactor));
    
    // Adjust pan to keep mouse position fixed
    const zoomRatio = newZoom / this.state.zoom;
    this.state.panX = mouseX - (mouseX - this.state.panX) * zoomRatio;
    this.state.panY = mouseY - (mouseY - this.state.panY) * zoomRatio;
    
    this.state.zoom = newZoom;
    this.render();
  }
  
  private handleKeyDown(e: KeyboardEvent): void {
    // If dialog is visible, don't handle keyboard shortcuts (except spacebar for panning)
    if (this.isDialogVisible?.()) {
      // Only allow spacebar for panning when dialog is open
      if (e.key === ' ' || e.key === 'Space') {
        if (!this.isSpacePressed) {
          this.isSpacePressed = true;
          // Update cursor if not already panning/dragging
          if (!this.isPanning && !this.isDraggingNode && !this.isConnecting) {
            this.canvas.style.cursor = 'grab';
          }
        }
        e.preventDefault(); // Prevent page scroll
      }
      return;
    }
    
    // Track spacebar for panning
    if (e.key === ' ' || e.key === 'Space') {
      if (!this.isSpacePressed) {
        this.isSpacePressed = true;
        // Update cursor if not already panning/dragging
        if (!this.isPanning && !this.isDraggingNode && !this.isConnecting) {
          this.canvas.style.cursor = 'grab';
        }
      }
      e.preventDefault(); // Prevent page scroll
      return;
    }
    
    // Delete selected nodes/connections
    if ((e.key === 'Delete' || e.key === 'Backspace') && !e.ctrlKey && !e.metaKey) {
      for (const nodeId of this.state.selectedNodeIds) {
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
      this.isSpacePressed = false;
      // Reset cursor if not panning/dragging
      if (!this.isPanning && !this.isDraggingNode && !this.isConnecting) {
        this.canvas.style.cursor = 'default';
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
  public render(): void {
    const { width, height } = this.canvas;
    this.ctx.clearRect(0, 0, width, height);
    
    // Fill canvas background
    const canvasBg = getCSSColor('canvas-bg', getCSSColor('color-gray-40', '#0a0a0e'));
    this.ctx.fillStyle = canvasBg;
    this.ctx.fillRect(0, 0, width, height);
    
    // Save context
    this.ctx.save();
    
    // Apply pan/zoom transform
    this.ctx.translate(this.state.panX, this.state.panY);
    this.ctx.scale(this.state.zoom, this.state.zoom);
    
    // Render grid
    this.renderGrid();
    
    // Render regular connections (behind nodes)
    this.renderRegularConnections();
    
    // Render nodes (without ports)
    this.renderNodes(true);
    
    // Render parameter port connections (on top of nodes)
    this.renderParameterConnections();
    
    // Render ports (on top of all connections)
    this.renderNodePorts();
    
    // Render temporary connection line (if connecting)
    if (this.isConnecting) {
      this.renderTemporaryConnection();
    }
    
    // Render smart guides (if dragging node)
    if (this.isDraggingNode && this.draggingNodeId) {
      this.renderSmartGuides();
    }
    
    // Restore context
    this.ctx.restore();
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
    for (const node of this.graph.nodes) {
      this.renderNode(node, skipPorts);
    }
  }
  
  private renderNode(node: NodeInstance, skipPorts: boolean = false): void {
    const spec = this.nodeSpecs.get(node.type);
    if (!spec) return;
    
    const metrics = this.nodeMetrics.get(node.id);
    if (!metrics) {
      // Calculate metrics if missing
      const newMetrics = this.nodeRenderer.calculateMetrics(node, spec);
      this.nodeMetrics.set(node.id, newMetrics);
      this.renderNode(node, skipPorts); // Recursive call with metrics
      return;
    }
    
    const isSelected = this.state.selectedNodeIds.has(node.id);
    // Check if this node's port is being hovered
    const isPortHovered = this.hoveredPort && this.hoveredPort.nodeId === node.id;
    const hoveredPortName = isPortHovered ? (this.hoveredPort!.parameter || this.hoveredPort!.port) : null;
    const isHoveredParameter = isPortHovered ? !!this.hoveredPort!.parameter : undefined;
    
    // Check if this node's port is the source of a connection being dragged
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
    
    this.nodeRenderer.renderNode(node, spec, metrics, isSelected, hoveredPortName, isHoveredParameter, effectiveParameterValues, connectingPortName, isConnectingParameter, connectedParameters, skipPorts);
  }
  
  private renderNodePorts(): void {
    for (const node of this.graph.nodes) {
      const spec = this.nodeSpecs.get(node.type);
      const metrics = this.nodeMetrics.get(node.id);
      if (!spec || !metrics) continue;
      
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
      
      this.nodeRenderer.renderNodePorts(node, spec, metrics, hoveredPortName, isHoveredParameter, connectingPortName, isConnectingParameter, connectedParameters);
    }
  }
  
  private startEffectiveValueUpdates(): void {
    // Update effective values periodically (every 100ms for smooth animation)
    if (this.effectiveValueUpdateInterval) {
      clearInterval(this.effectiveValueUpdateInterval);
    }
    
    this.effectiveValueUpdateInterval = window.setInterval(() => {
      // Trigger a render to update the display
      this.render();
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
  }
  
  public setAudioManager(audioManager: AudioManager | undefined): void {
    this.audioManager = audioManager;
  }
  
  private renderRegularConnections(): void {
    // Render connections that are NOT connected to parameter ports
    for (const conn of this.graph.connections) {
      if (!conn.targetParameter) {
        this.renderConnection(conn);
      }
    }
  }
  
  private renderParameterConnections(): void {
    // Render connections that ARE connected to parameter ports (on top of nodes)
    for (const conn of this.graph.connections) {
      if (conn.targetParameter) {
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
    
    // Get connection color based on source node category
    const categoryMap: Record<string, string> = {
      'Inputs': 'connection-color-inputs',
      'Patterns': 'connection-color-patterns',
      'Shapes': 'connection-color-shapes',
      'Math': 'connection-color-math',
      'Utilities': 'connection-color-utilities',
      'Distort': 'connection-color-distort',
      'Blend': 'connection-color-blend',
      'Mask': 'connection-color-mask',
      'Effects': 'connection-color-effects',
      'Output': 'connection-color-output'
    };
    const connectionColorToken = categoryMap[sourceSpec.category] || 'connection-color-default';
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
    
    // Check if we're near a valid port and snap to it
    const portHit = this.hitTestPort(this.connectionMouseX, this.connectionMouseY);
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
    
    // Get connection color based on source node category
    const categoryMap: Record<string, string> = {
      'Inputs': 'connection-color-inputs',
      'Patterns': 'connection-color-patterns',
      'Shapes': 'connection-color-shapes',
      'Math': 'connection-color-math',
      'Utilities': 'connection-color-utilities',
      'Distort': 'connection-color-distort',
      'Blend': 'connection-color-blend',
      'Mask': 'connection-color-mask',
      'Effects': 'connection-color-effects',
      'Output': 'connection-color-output'
    };
    const connectionColorToken = categoryMap[sourceSpec.category] || 'connection-color-default';
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
  }
  
  // Public API
  setGraph(graph: NodeGraph): void {
    this.graph = graph;
    // Update state from graph viewState
    if (graph.viewState) {
      this.state.zoom = graph.viewState.zoom ?? this.state.zoom;
      this.state.panX = graph.viewState.panX ?? this.state.panX;
      this.state.panY = graph.viewState.panY ?? this.state.panY;
      this.state.selectedNodeIds = new Set(graph.viewState.selectedNodeIds ?? []);
    }
    this.updateNodeMetrics();
    this.render();
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
    const zoom = Math.min(zoomX, zoomY, 2.0); // Cap zoom at 2.0 to avoid too much zoom
    
    // Calculate pan to center content
    const panX = (canvasWidth / 2) - (centerX * zoom);
    const panY = (canvasHeight / 2) - (centerY * zoom);
    
    // Update state
    this.state.zoom = zoom;
    this.state.panX = panX;
    this.state.panY = panY;
    
    this.render();
  }
  
  getViewState() {
    return {
      zoom: this.state.zoom,
      panX: this.state.panX,
      panY: this.state.panY,
      selectedNodeIds: Array.from(this.state.selectedNodeIds)
    };
  }
  
  getNodeRenderer(): NodeRenderer {
    return this.nodeRenderer;
  }
  
  getNodeMetrics(): Map<string, NodeRenderMetrics> {
    return this.nodeMetrics;
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
    isDialogVisible?: () => boolean;
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
    this.isDialogVisible = callbacks.isDialogVisible;
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
}
