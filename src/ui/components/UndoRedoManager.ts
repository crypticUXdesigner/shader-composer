// Undo/Redo Manager
// Manages undo/redo history for graph operations

import type { NodeGraph } from '../../types/nodeGraph';
import { deepCopyGraph } from '../../data-model/immutableUpdates';

export class UndoRedoManager {
  private history: NodeGraph[] = [];
  private currentIndex: number = -1;
  private maxHistorySize: number = 50;
  
  pushState(graph: NodeGraph): void {
    // Remove any states after current index (when undoing then making new change)
    this.history = this.history.slice(0, this.currentIndex + 1);
    
    // Add new state (deep copy using efficient immutable copy)
    const stateCopy = deepCopyGraph(graph as any) as any;
    this.history.push(stateCopy);
    
    // Limit history size
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    } else {
      this.currentIndex++;
    }
  }
  
  undo(): NodeGraph | null {
    if (this.currentIndex <= 0) {
      return null; // Nothing to undo
    }
    
    this.currentIndex--;
    return deepCopyGraph(this.history[this.currentIndex] as any) as any;
  }
  
  redo(): NodeGraph | null {
    if (this.currentIndex >= this.history.length - 1) {
      return null; // Nothing to redo
    }
    
    this.currentIndex++;
    return deepCopyGraph(this.history[this.currentIndex] as any) as any;
  }
  
  canUndo(): boolean {
    return this.currentIndex > 0;
  }
  
  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1;
  }
  
  clear(): void {
    this.history = [];
    this.currentIndex = -1;
  }
}
