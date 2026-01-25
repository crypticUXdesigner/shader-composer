/**
 * Connection Select Handler
 * 
 * Handles connection selection:
 * - Click on connection to select it
 * - Supports multi-select with shift-click
 */

import { InteractionType } from '../InteractionTypes';
import type { InteractionEvent, InteractionHandler } from '../InteractionHandler';
import type { HandlerContext } from '../HandlerContext';

export class ConnectionSelectHandler implements InteractionHandler {
  priority = 30; // Medium priority - connection selection is specific interaction
  
  constructor(private context: HandlerContext) {}
  
  canHandle(event: InteractionEvent): boolean {
    if (event.type === InteractionType.NodeSelect) {
      // Connection selection uses NodeSelect type (connections are selectable like nodes)
      return true;
    }
    
    // Check if clicking on a connection
    const connHit = this.context.hitTestConnection?.(event.screenPosition.x, event.screenPosition.y);
    if (connHit) {
      return true;
    }
    
    return false;
  }
  
  onStart(event: InteractionEvent): void {
    const connHit = this.context.hitTestConnection?.(event.screenPosition.x, event.screenPosition.y);
    if (!connHit) return;
    
    const state = this.context.getState();
    const multiSelect = event.modifiers.shift;
    const newState = { ...state };
    
    if (!multiSelect) {
      // Single click: clear selection and select only this connection
      // Mark previously selected nodes as dirty so they re-render without selection border
      if (newState.selectedNodeIds.size > 0) {
        const previouslySelectedNodes = Array.from(newState.selectedNodeIds);
        this.context.markNodesDirty?.(previouslySelectedNodes);
      }
      newState.selectedNodeIds.clear();
      newState.selectedConnectionIds.clear();
      newState.selectedConnectionIds.add(connHit);
    } else {
      // Shift-click: toggle selection
      if (newState.selectedConnectionIds.has(connHit)) {
        newState.selectedConnectionIds.delete(connHit);
      } else {
        newState.selectedConnectionIds.add(connHit);
      }
    }
    
    this.context.setState(() => newState);
    
    // Mark the connection as dirty so it gets fully re-rendered with new selection state
    // This ensures the entire connection path is updated, not just a partial region
    this.context.markConnectionsDirty?.([connHit]);
    
    // Also mark previously selected connections as dirty if clearing selection
    if (!multiSelect && state.selectedConnectionIds.size > 0) {
      const previouslySelected = Array.from(state.selectedConnectionIds);
      this.context.markConnectionsDirty?.(previouslySelected);
    }
    
    this.context.onConnectionSelected?.(connHit, multiSelect);
    this.context.requestRender();
  }
  
  onUpdate(_event: InteractionEvent): void {
    // Connection selection is a one-time action on click, no update needed
  }
  
  onEnd(_event: InteractionEvent): void {
    // Connection selection is a one-time action on click, no cleanup needed
  }
  
  handle(_event: InteractionEvent): void {
    // This method is called for immediate handling
    // For connection selection, we use onStart lifecycle
    // This is a no-op as selection is handled through lifecycle methods
  }
}
