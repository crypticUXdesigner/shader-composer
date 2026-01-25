/**
 * Main entry point for Node-Based Shader Composer
 * 
 * This replaces the old layer-based system with the new node-based system.
 */

import { elementLibrary } from './shaders/elements/index';
import { NodeShaderCompiler } from './shaders/NodeShaderCompiler';
import { NodeEditor } from './ui/components/NodeEditor';
import { NodeEditorLayout } from './ui/components/NodeEditorLayout';
import { BottomBar } from './ui/components/BottomBar';
import { RuntimeManager } from './runtime/RuntimeManager';
import { visualElementToNodeSpec } from './utils/nodeSpecAdapter';
import { nodeSystemSpecs } from './shaders/nodes/index';
import { listPresets, loadPreset, copyGraphToClipboard } from './utils/presetManager';
import { exportImage } from './utils/export';
import { getCSSColor } from './utils/cssTokens';
import { loadTablerIconData } from './utils/tabler-icons-loader';
import type { NodeGraph } from './data-model/types';
import type { NodeSpec } from './types';

class App {
  private layout!: NodeEditorLayout;
  private bottomBar!: BottomBar;
  private nodeEditor!: NodeEditor;
  private runtimeManager!: RuntimeManager;
  private compiler!: NodeShaderCompiler;
  private nodeSpecs!: NodeSpec[];
  private animationFrameId: number | null = null;
  
  constructor() {
    this.initialize();
  }
  
  private async initialize(): Promise<void> {
    // Wait for icon data to load before creating UI components
    await loadTablerIconData();
    
    // Get main container
    const mainContainer = document.getElementById('main');
    if (!mainContainer) {
      throw new Error('Main container not found');
    }
    
    // Clear old UI
    mainContainer.innerHTML = '';
    const layoutBg = getCSSColor('layout-bg', '#1a1a1a');
    mainContainer.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: ${layoutBg};
    `;
    
    // Create layout
    this.layout = new NodeEditorLayout(mainContainer);
    
    // Create bottom bar
    this.bottomBar = new BottomBar(mainContainer);
    
    // Connect bottom bar to layout for panel offset
    this.layout.setBottomBar(this.bottomBar);
    
    // Convert visual elements to node specs and add node system specific specs
    const elementSpecs = elementLibrary.map(visualElementToNodeSpec);
    this.nodeSpecs = [...elementSpecs, ...nodeSystemSpecs];
    
    // Create compiler
    const nodeSpecsMap = new Map<string, NodeSpec>();
    for (const spec of this.nodeSpecs) {
      nodeSpecsMap.set(spec.id, spec);
    }
    this.compiler = new NodeShaderCompiler(nodeSpecsMap);
    
    // Create preview canvas
    const previewCanvas = document.createElement('canvas');
    previewCanvas.style.cssText = `
      width: 100%;
      height: 100%;
      display: block;
    `;
    this.layout.getPreviewContainer().appendChild(previewCanvas);
    
    // Create runtime manager
    this.runtimeManager = new RuntimeManager(
      previewCanvas,
      this.compiler,
      (error) => {
        console.error('Shader error:', error);
        // TODO: Display error in UI
      }
    );
    
    // Automatically load first available preset
    let initialGraph: NodeGraph | null = null;
    let loadedPresetName: string | null = null;
    
    try {
      const presets = await listPresets();
      if (presets.length > 0) {
        // Load the first preset alphabetically
        const firstPreset = presets[0];
        console.log(`[App] Loading first preset: ${firstPreset.displayName} (${firstPreset.name})`);
        initialGraph = await loadPreset(firstPreset.name);
        if (initialGraph) {
          loadedPresetName = firstPreset.name;
          // Generate new IDs to avoid conflicts
          const newGraphId = `graph-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          initialGraph.id = newGraphId;
          
          const nodeIdMap = new Map<string, string>();
          for (const node of initialGraph.nodes) {
            const oldId = node.id;
            const newId = `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            nodeIdMap.set(oldId, newId);
            node.id = newId;
          }
          
          for (const conn of initialGraph.connections) {
            conn.id = `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            conn.sourceNodeId = nodeIdMap.get(conn.sourceNodeId) || conn.sourceNodeId;
            conn.targetNodeId = nodeIdMap.get(conn.targetNodeId) || conn.targetNodeId;
          }
          
          // Reset view state
          initialGraph.viewState = {
            zoom: 1.0,
            panX: 0,
            panY: 0,
            selectedNodeIds: []
          };
        }
      }
    } catch (error) {
      console.warn('[App] Failed to load preset:', error);
    }
    
    // Fallback to empty graph if no preset was loaded
    if (!initialGraph) {
      console.log('[App] No presets found, creating empty graph');
      initialGraph = {
        id: 'graph-1',
        name: 'New Shader',
        version: '2.0',
        nodes: [],
        connections: [],
        viewState: {
          zoom: 1.0,
          panX: 0,
          panY: 0,
          selectedNodeIds: []
        }
      };
    }
    
    // Create node editor
    this.nodeEditor = new NodeEditor(
      this.layout.getNodeEditorContainer(),
      initialGraph,
      this.nodeSpecs,
      {
        onGraphChanged: async (graph) => {
          await this.runtimeManager.setGraph(graph);
        },
        onConnectionRemoved: (connectionId) => {
          this.runtimeManager.onConnectionRemoved(connectionId);
        },
        onParameterChanged: (nodeId, paramName, value) => {
          this.runtimeManager.updateParameter(nodeId, paramName, value);
        },
        onFileParameterChanged: async (nodeId, paramName, file) => {
          await this.runtimeManager.onAudioFileParameterChange(nodeId, paramName, file);
        }
      }
    );
    
    // Set audio manager reference in canvas for real-time value display
    this.nodeEditor.getCanvasComponent().setAudioManager(this.runtimeManager.getAudioManager());
    
    // Setup bottom bar callbacks
    this.bottomBar.setCallbacks({
      onPlayToggle: () => {
        this.runtimeManager.toggleGlobalAudioPlayback();
      },
      onTimeChange: (time) => {
        this.runtimeManager.seekGlobalAudio(time);
      },
      getState: () => {
        return this.runtimeManager.getGlobalAudioState();
      },
      onToolChange: (tool) => {
        // Pass tool change to canvas
        this.nodeEditor.getCanvasComponent().setActiveTool(tool);
      }
    });
    
    // Connect spacebar state changes to bottom bar for visual feedback
    this.nodeEditor.getCanvasComponent().setSpacebarStateChangeCallback((isPressed) => {
      this.bottomBar.setSpacebarPressed(isPressed);
    });
    
    // Setup copy preset callback (must be after nodeEditor is created)
    this.layout.setCopyPresetCallback(async () => {
      const currentGraph = this.nodeEditor.getGraph();
      await copyGraphToClipboard(currentGraph);
    });
    
    // Setup export callback
    this.layout.setExportCallback(async () => {
      const currentGraph = this.nodeEditor.getGraph();
      await exportImage(currentGraph, this.compiler, {
        resolution: [1600, 1600],
        format: 'png',
        quality: 1.0
      });
    });
    
    // Setup panel toggle callback and add panel to layout
    const panel = this.nodeEditor.getNodePanel();
    const panelContainer = this.layout.getPanelContainer();
    panelContainer.appendChild(panel.getPanelElement());
    
    this.layout.setPanelToggleCallback(() => {
      panel.toggle();
      this.layout.setPanelToggleActive(panel.isPanelVisible());
    });
    
    // Set initial panel state to match default (panel is visible by default)
    this.layout.setPanelToggleActive(panel.isPanelVisible());
    
    // Setup load preset callback
    this.layout.setLoadPresetCallback(async (presetName: string) => {
      const presetGraph = await loadPreset(presetName);
      if (presetGraph) {
        // Generate new IDs for the loaded graph to avoid conflicts
        const newGraphId = `graph-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        presetGraph.id = newGraphId;
        
        // Generate new IDs for all nodes and connections
        const nodeIdMap = new Map<string, string>();
        for (const node of presetGraph.nodes) {
          const oldId = node.id;
          const newId = `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          nodeIdMap.set(oldId, newId);
          node.id = newId;
        }
        
        // Update connection IDs and references
        for (const conn of presetGraph.connections) {
          conn.id = `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          conn.sourceNodeId = nodeIdMap.get(conn.sourceNodeId) || conn.sourceNodeId;
          conn.targetNodeId = nodeIdMap.get(conn.targetNodeId) || conn.targetNodeId;
        }
        
        // Reset view state
        presetGraph.viewState = {
          zoom: 1.0,
          panX: 0,
          panY: 0,
          selectedNodeIds: []
        };
        
        // Load the graph into the editor
        this.nodeEditor.setGraph(presetGraph);
        await this.runtimeManager.setGraph(presetGraph);
        
        // Update the dropdown to reflect the loaded preset
        this.layout.setSelectedPreset(presetName);
      } else {
        throw new Error(`Failed to load preset: ${presetName}`);
      }
    });
    
    // Setup zoom callbacks
    this.layout.setZoomCallbacks({
      onZoomChange: (zoom: number) => {
        const canvas = this.nodeEditor.getCanvasComponent();
        // setZoom will use canvas center if no coordinates provided
        canvas.setZoom(zoom);
      },
      getZoom: () => {
        return this.nodeEditor.getCanvasComponent().getViewState().zoom;
      }
    });
    
    // Load and populate preset list
    await this.loadPresetList();
    
    // Set the selected preset in the dropdown if a preset was loaded
    if (loadedPresetName) {
      this.layout.setSelectedPreset(loadedPresetName);
    }
    
    // Set initial graph in runtime (await to ensure audio files load)
    await this.runtimeManager.setGraph(initialGraph);
    
    // Start animation loop
    this.startAnimation();
  }
  
  private startAnimation(): void {
    let lastFrameTime = performance.now();
    let lastZoomUpdate = performance.now();
    const ZOOM_UPDATE_INTERVAL = 100; // Update zoom display every 100ms
    
    const animate = (currentTime: number) => {
      // Calculate frame time for FPS tracking
      const frameTime = currentTime - lastFrameTime;
      lastFrameTime = currentTime;
      
      // Update FPS counter
      this.layout.updateFPS(frameTime);
      
      // Update zoom display periodically
      if (currentTime - lastZoomUpdate >= ZOOM_UPDATE_INTERVAL) {
        lastZoomUpdate = currentTime;
        const zoom = this.nodeEditor.getCanvasComponent().getViewState().zoom;
        this.layout.updateZoomDisplay(zoom);
      }
      
      // Update time uniform
      const time = (currentTime / 1000.0) % 1000.0;
      this.runtimeManager.setTime(time);
      
      this.animationFrameId = requestAnimationFrame(animate);
    };
    
    this.animationFrameId = requestAnimationFrame(animate);
  }
  
  private stopAnimation(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }
  
  private async loadPresetList(): Promise<void> {
    try {
      const presets = await listPresets();
      await this.layout.updatePresetList(presets);
    } catch (error) {
      console.error('Failed to load preset list:', error);
    }
  }
  
  destroy(): void {
    this.stopAnimation();
    // Cleanup if needed
  }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new App());
} else {
  new App();
}
