// Main Node Editor Component
// Orchestrates the node editor UI including canvas, layout, and interactions

import { NodeEditorCanvas } from './NodeEditorCanvas';
import { NodePanel } from './NodePanel';
import { UndoRedoManager } from './UndoRedoManager';
import { CopyPasteManager } from './CopyPasteManager';
import { ContextualHelpCallout } from './ContextualHelpCallout';
import type { NodeGraph, NodeInstance, Connection } from '../../types/nodeGraph';
import type { NodeSpec } from '../../types/nodeSpec';

export interface NodeEditorCallbacks {
  onGraphChanged?: (graph: NodeGraph) => void;
  onConnectionRemoved?: (connectionId: string) => void;
  onParameterChanged?: (nodeId: string, paramName: string, value: number) => void;
  onFileParameterChanged?: (nodeId: string, paramName: string, file: File) => void;
  onError?: (error: { type: string, errors?: string[], error?: string, timestamp: number }) => void;
}

export class NodeEditor {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private canvasComponent: NodeEditorCanvas;
  private nodePanel: NodePanel;
  private graph: NodeGraph;
  private nodeSpecs: Map<string, NodeSpec>;
  private callbacks: NodeEditorCallbacks;
  private undoRedoManager: UndoRedoManager;
  private copyPasteManager: CopyPasteManager;
  private helpCallout: ContextualHelpCallout;
  
  constructor(
    container: HTMLElement,
    graph: NodeGraph,
    nodeSpecs: NodeSpec[],
    callbacks: NodeEditorCallbacks = {}
  ) {
    this.container = container;
    this.graph = graph;
    this.callbacks = callbacks;
    this.undoRedoManager = new UndoRedoManager();
    this.copyPasteManager = new CopyPasteManager();
    
    // Create node specs map
    this.nodeSpecs = new Map();
    for (const spec of nodeSpecs) {
      this.nodeSpecs.set(spec.id, spec);
    }
    
    // Push initial state
    this.undoRedoManager.pushState(graph);
    
    // Create canvas
    this.canvas = document.createElement('canvas');
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.display = 'block';
    this.container.appendChild(this.canvas);
    
    // Create canvas component (audioManager will be set later via setAudioManager)
    this.canvasComponent = new NodeEditorCanvas(this.canvas, graph, nodeSpecs);
    
    // Create node panel (will be added to layout container)
    this.nodePanel = new NodePanel(nodeSpecs, {
      onCreateNode: (nodeType, x, y) => {
        this.addNode(nodeType, x, y);
      },
      onScreenToCanvas: (screenX, screenY) => {
        return this.canvasComponent['screenToCanvas'](screenX, screenY);
      }
    });
    
    // Create contextual help callout
    this.helpCallout = new ContextualHelpCallout();
    this.helpCallout.setNodeSpecs(this.nodeSpecs);
    
    // Setup drag and drop from panel to canvas
    this.setupPanelDragAndDrop();
    
    // Setup keyboard shortcuts
    this.setupKeyboardShortcuts();
    
    this.canvasComponent.setCallbacks({
      onNodeMoved: (nodeId, x, y) => {
        const node = this.graph.nodes.find(n => n.id === nodeId);
        if (node) {
          node.position.x = x;
          node.position.y = y;
          // Update metrics for moved node
          const spec = this.nodeSpecs.get(node.type);
          if (spec) {
            const metrics = this.canvasComponent.getNodeRenderer().calculateMetrics(node, spec);
            this.canvasComponent.getNodeMetrics().set(node.id, metrics);
          }
          this.updateViewState();
          this.notifyGraphChanged();
        }
      },
      onNodeSelected: (nodeId, multiSelect) => {
        // Update selection state
        if (!this.graph.viewState) {
          this.graph.viewState = {
            zoom: 1.0,
            panX: 0,
            panY: 0,
            selectedNodeIds: []
          };
        }
        if (!multiSelect) {
          this.graph.viewState.selectedNodeIds = nodeId ? [nodeId] : [];
        } else if (nodeId) {
          const selected = this.graph.viewState.selectedNodeIds || [];
          if (selected.includes(nodeId)) {
            this.graph.viewState.selectedNodeIds = selected.filter(id => id !== nodeId);
          } else {
            this.graph.viewState.selectedNodeIds = [...selected, nodeId];
          }
        }
        this.updateViewState();
      },
      onConnectionCreated: (sourceNodeId, sourcePort, targetNodeId, targetPort?, targetParameter?) => {
        // Create new connection
        const connection: Connection = {
          id: this.generateId('conn'),
          sourceNodeId,
          sourcePort,
          targetNodeId,
          targetPort,
          targetParameter
        };
        
        // Validate connection (but skip duplicate check since we'll replace)
        if (this.validateConnection(connection, true)) {
          // Check if target input/parameter already has a connection and remove it
          let existingConnection: Connection | undefined;
          if (targetParameter) {
            // For parameter connections
            existingConnection = this.graph.connections.find(
              c => c.targetNodeId === targetNodeId && 
                   c.targetParameter === targetParameter
            );
            if (existingConnection) {
              // Remove existing connection
              this.graph.connections = this.graph.connections.filter(c => c.id !== existingConnection!.id);
              // Notify about connection removal to ensure recompilation
              this.callbacks.onConnectionRemoved?.(existingConnection.id);
            }
          } else if (targetPort) {
            // For regular port connections
            existingConnection = this.graph.connections.find(
              c => c.targetNodeId === targetNodeId && c.targetPort === targetPort
            );
            if (existingConnection) {
              // Remove existing connection
              this.graph.connections = this.graph.connections.filter(c => c.id !== existingConnection!.id);
              // Notify about connection removal to ensure recompilation
              this.callbacks.onConnectionRemoved?.(existingConnection.id);
            }
          }
          
          // Add the new connection
          this.graph.connections.push(connection);
          this.updateViewState();
          this.notifyGraphChanged();
        }
      },
      onConnectionSelected: (_connectionId, _multiSelect) => {
        // TODO: Handle connection selection
      },
      onNodeDeleted: (nodeId) => {
        // Remove node and all its connections
        this.graph.nodes = this.graph.nodes.filter(n => n.id !== nodeId);
        this.graph.connections = this.graph.connections.filter(
          c => c.sourceNodeId !== nodeId && c.targetNodeId !== nodeId
        );
        this.updateViewState();
        this.notifyGraphChanged();
      },
      onConnectionDeleted: (connectionId) => {
        this.graph.connections = this.graph.connections.filter(c => c.id !== connectionId);
        this.updateViewState();
        // Notify about connection removal specifically to ensure recompilation
        this.callbacks.onConnectionRemoved?.(connectionId);
        this.notifyGraphChanged();
      },
      onParameterChanged: (nodeId, paramName, value) => {
        // Update parameter value in graph
        this.updateParameter(nodeId, paramName, value);
      },
      onFileParameterChanged: (nodeId, paramName, file) => {
        // Handle file parameter change
        this.callbacks.onFileParameterChanged?.(nodeId, paramName, file);
      },
      onParameterInputModeChanged: (nodeId, paramName, mode) => {
        // Update parameter input mode in graph
        const node = this.graph.nodes.find(n => n.id === nodeId);
        if (node) {
          if (!node.parameterInputModes) {
            node.parameterInputModes = {};
          }
          node.parameterInputModes[paramName] = mode;
          this.updateViewState();
          this.notifyGraphChanged();
        }
      },
      onNodeLabelChanged: (nodeId, label) => {
        // Update node label in graph
        const node = this.graph.nodes.find(n => n.id === nodeId);
        if (node) {
          if (label === undefined) {
            // Remove label to revert to original displayName
            delete node.label;
          } else {
            // Set the new label
            node.label = label;
          }
          // Update metrics for the node (label affects width calculation)
          const spec = this.nodeSpecs.get(node.type);
          if (spec) {
            const metrics = this.canvasComponent.getNodeRenderer().calculateMetrics(node, spec);
            this.canvasComponent.getNodeMetrics().set(node.id, metrics);
          }
          this.updateViewState();
          this.notifyGraphChanged();
        }
      },
      onTypeLabelClick: (portType, screenX, screenY) => {
        // Show help callout for the clicked type
        this.helpCallout.show({
          helpId: `type:${portType}`,
          screenX,
          screenY,
          nodeSpecs: this.nodeSpecs
        });
      }
    });
  }
  
  private validateConnection(connection: Connection, skipDuplicateCheck: boolean = false): boolean {
    const sourceNode = this.graph.nodes.find(n => n.id === connection.sourceNodeId);
    const targetNode = this.graph.nodes.find(n => n.id === connection.targetNodeId);
    
    if (!sourceNode || !targetNode) {
      return false;
    }
    
    const sourceSpec = this.nodeSpecs.get(sourceNode.type);
    const targetSpec = this.nodeSpecs.get(targetNode.type);
    
    if (!sourceSpec || !targetSpec) {
      return false;
    }
    
    // Handle parameter connections
    if (connection.targetParameter) {
      const paramSpec = targetSpec.parameters[connection.targetParameter];
      if (!paramSpec || (paramSpec.type !== 'float' && paramSpec.type !== 'int')) {
        return false; // Parameter doesn't exist or isn't float/int
      }
      
      const sourcePort = sourceSpec.outputs.find(p => p.name === connection.sourcePort);
      if (!sourcePort) {
        return false;
      }
      
      // Check if parameter already has a connection (unless we're replacing it)
      if (!skipDuplicateCheck) {
        const existingConnection = this.graph.connections.find(
          c => c.targetNodeId === connection.targetNodeId && 
               c.targetParameter === connection.targetParameter
        );
        
        if (existingConnection) {
          return false; // Parameter already connected
        }
      }
      
      // Type compatibility: source must be float or int (or vec with .x extraction)
      if (sourcePort.type !== 'float' && sourcePort.type !== 'int') {
        // Allow vec types (will extract .x in compiler)
        if (sourcePort.type !== 'vec2' && sourcePort.type !== 'vec3' && sourcePort.type !== 'vec4') {
          return false;
        }
      }
      
      return true;
    }
    
    // Regular port connection
    // Check if ports exist
    const sourcePort = sourceSpec.outputs.find(p => p.name === connection.sourcePort);
    const targetPort = targetSpec.inputs.find(p => p.name === connection.targetPort);
    
    if (!sourcePort || !targetPort) {
      return false;
    }
    
    // Check if target port already has a connection (unless we're replacing it)
    if (!skipDuplicateCheck) {
      const existingConnection = this.graph.connections.find(
        c => c.targetNodeId === connection.targetNodeId && c.targetPort === connection.targetPort
      );
      
      if (existingConnection) {
        return false; // Port already connected
      }
    }
    
    // TODO: Check type compatibility
    
    return true;
  }
  
  private updateViewState(): void {
    const viewState = this.canvasComponent.getViewState();
    this.graph.viewState = {
      zoom: viewState.zoom,
      panX: viewState.panX,
      panY: viewState.panY,
      selectedNodeIds: viewState.selectedNodeIds
    };
  }
  
  private notifyGraphChanged(): void {
    this.undoRedoManager.pushState(this.graph);
    this.callbacks.onGraphChanged?.(this.graph);
  }
  
  private generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  // Public API
  setGraph(graph: NodeGraph): void {
    this.graph = graph;
    this.canvasComponent.setGraph(graph);
    this.undoRedoManager.pushState(graph);
  }
  
  getGraph(): NodeGraph {
    return this.graph;
  }
  
  getCanvasComponent(): NodeEditorCanvas {
    return this.canvasComponent;
  }
  
  undo(): boolean {
    const state = this.undoRedoManager.undo();
    if (state) {
      this.graph = state;
      this.canvasComponent.setGraph(state);
      this.callbacks.onGraphChanged?.(state);
      return true;
    }
    return false;
  }
  
  redo(): boolean {
    const state = this.undoRedoManager.redo();
    if (state) {
      this.graph = state;
      this.canvasComponent.setGraph(state);
      this.callbacks.onGraphChanged?.(state);
      return true;
    }
    return false;
  }
  
  canUndo(): boolean {
    return this.undoRedoManager.canUndo();
  }
  
  canRedo(): boolean {
    return this.undoRedoManager.canRedo();
  }
  
  addNode(nodeType: string, x: number, y: number): NodeInstance | null {
    const spec = this.nodeSpecs.get(nodeType);
    if (!spec) {
      return null;
    }
    
    // Create node with default parameters
    const parameters: Record<string, any> = {};
    for (const [paramName, paramSpec] of Object.entries(spec.parameters)) {
      parameters[paramName] = paramSpec.default;
    }
    
    // Create temporary node to calculate metrics (position doesn't affect metrics)
    const tempNode: NodeInstance = {
      id: 'temp',
      type: nodeType,
      position: { x: 0, y: 0 },
      parameters,
      collapsed: false
    };
    
    // Calculate metrics to get header dimensions
    const metrics = this.canvasComponent.getNodeRenderer().calculateMetrics(tempNode, spec);
    
    // Adjust position so cursor aligns with center of node header
    // Header center: (x + width/2, y + headerHeight/2)
    // We want cursor at (x, y) to be at header center, so:
    const adjustedX = x - metrics.width / 2;
    const adjustedY = y - metrics.headerHeight / 2;
    
    const node: NodeInstance = {
      id: this.generateId('node'),
      type: nodeType,
      position: { x: adjustedX, y: adjustedY },
      parameters,
      collapsed: false
    };
    
    // Update graph's viewState with current viewport before calling setGraph
    // This prevents the viewport from jumping when setGraph overwrites from graph.viewState
    this.updateViewState();
    
    this.graph.nodes.push(node);
    // Update metrics for new node (recalculate with actual node instance)
    const finalMetrics = this.canvasComponent.getNodeRenderer().calculateMetrics(node, spec);
    this.canvasComponent.getNodeMetrics().set(node.id, finalMetrics);
    this.canvasComponent.setGraph(this.graph);
    this.notifyGraphChanged();
    
    return node;
  }
  
  updateParameter(nodeId: string, paramName: string, value: number): void {
    const node = this.graph.nodes.find(n => n.id === nodeId);
    if (node) {
      node.parameters[paramName] = value;
      this.callbacks.onParameterChanged?.(nodeId, paramName, value);
      // Trigger canvas render to update parameter display
      this.canvasComponent.render();
      // Parameter changes don't trigger undo (they're too frequent)
      // Only structure changes trigger undo
    }
  }
  
  copy(): void {
    const selectedNodeIds = Array.from(this.canvasComponent.getViewState().selectedNodeIds);
    if (selectedNodeIds.length === 0) return;
    
    const selectedNodes = this.graph.nodes.filter(n => selectedNodeIds.includes(n.id));
    const selectedConnections = this.graph.connections.filter(
      c => selectedNodeIds.includes(c.sourceNodeId) && selectedNodeIds.includes(c.targetNodeId)
    );
    
    this.copyPasteManager.copy(selectedNodes, selectedConnections);
  }
  
  paste(x: number, y: number): void {
    const pasted = this.copyPasteManager.paste(x, y);
    if (!pasted) return;
    
    // Add pasted nodes and connections
    this.graph.nodes.push(...pasted.nodes);
    this.graph.connections.push(...pasted.connections);
    
    // Update metrics for new nodes
    for (const node of pasted.nodes) {
      const spec = this.nodeSpecs.get(node.type);
      if (spec) {
        const metrics = this.canvasComponent.getNodeRenderer().calculateMetrics(node, spec);
        this.canvasComponent.getNodeMetrics().set(node.id, metrics);
      }
    }
    
    // Update graph's viewState with current viewport before calling setGraph
    // This prevents the viewport from jumping when setGraph overwrites from graph.viewState
    const viewState = this.canvasComponent.getViewState();
    viewState.selectedNodeIds = pasted.nodes.map(n => n.id);
    this.graph.viewState = {
      zoom: viewState.zoom,
      panX: viewState.panX,
      panY: viewState.panY,
      selectedNodeIds: viewState.selectedNodeIds
    };
    
    this.canvasComponent.setGraph(this.graph);
    this.notifyGraphChanged();
  }
  
  duplicate(): void {
    const selectedNodeIds = Array.from(this.canvasComponent.getViewState().selectedNodeIds);
    if (selectedNodeIds.length === 0) return;
    
    // Copy first
    this.copy();
    
    // Then paste with offset
    const selectedNodes = this.graph.nodes.filter(n => selectedNodeIds.includes(n.id));
    if (selectedNodes.length === 0) return;
    
    // Calculate average position
    let avgX = 0;
    let avgY = 0;
    for (const node of selectedNodes) {
      avgX += node.position.x;
      avgY += node.position.y;
    }
    avgX /= selectedNodes.length;
    avgY /= selectedNodes.length;
    
    // Paste with offset
    this.paste(avgX + 50, avgY + 50);
  }
  
  selectAll(): void {
    const allNodeIds = this.graph.nodes.map(n => n.id);
    const viewState = this.canvasComponent.getViewState();
    viewState.selectedNodeIds = allNodeIds;
    this.graph.viewState = {
      zoom: this.graph.viewState?.zoom ?? 1.0,
      panX: this.graph.viewState?.panX ?? 0,
      panY: this.graph.viewState?.panY ?? 0,
      selectedNodeIds: allNodeIds
    };
    this.canvasComponent.setGraph(this.graph);
  }
  
  // Keyboard shortcuts
  setupKeyboardShortcuts(): void {
    window.addEventListener('keydown', (e) => {
      // Check if user is typing in an input field - don't handle shortcuts in that case
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      
      // Don't handle shortcuts when user is typing in an input field
      if (isInput) {
        return;
      }
      
      // Ctrl/Cmd + C: Copy
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        this.copy();
      }
      
      // Ctrl/Cmd + V: Paste
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const viewState = this.canvasComponent.getViewState();
        // Paste at center of viewport
        const centerX = (rect.width / 2 - viewState.panX) / viewState.zoom;
        const centerY = (rect.height / 2 - viewState.panY) / viewState.zoom;
        this.paste(centerX, centerY);
      }
      
      // Ctrl/Cmd + D: Duplicate
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        this.duplicate();
      }
      
      // Ctrl/Cmd + A: Select all
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        this.selectAll();
      }
      
      // Ctrl/Cmd + Z: Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        this.undo();
      }
      
      // Ctrl/Cmd + Shift + Z: Redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        this.redo();
      }
    });
  }
  
  private setupPanelDragAndDrop(): void {
    // Prevent default drag behavior on canvas
    this.canvas.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer!.dropEffect = 'copy';
    });
    
    // Handle drop on canvas
    this.canvas.addEventListener('drop', (e) => {
      e.preventDefault();
      const nodeType = e.dataTransfer?.getData('text/plain');
      if (nodeType) {
        const canvasPos = this.canvasComponent['screenToCanvas'](e.clientX, e.clientY);
        this.addNode(nodeType, canvasPos.x, canvasPos.y);
      }
    });
  }
  
  /**
   * Get the node panel instance
   */
  getNodePanel(): NodePanel {
    return this.nodePanel;
  }
  
  destroy(): void {
    this.nodePanel.destroy();
    this.helpCallout.destroy();
    this.container.removeChild(this.canvas);
  }
}
