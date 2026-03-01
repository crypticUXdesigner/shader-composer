/**
 * SelectionManager
 * 
 * Manages selection state for nodes and connections.
 */
export interface SelectionState {
  selectedNodeIds: Set<string>;
  selectedConnectionIds: Set<string>;
}

export interface SelectionChangeListener {
  onSelectionChanged?: (state: SelectionState) => void;
}

export class SelectionManager {
  private state: SelectionState;
  private listener?: SelectionChangeListener;

  constructor(initialNodeIds?: string[]) {
    this.state = {
      selectedNodeIds: new Set(initialNodeIds ?? []),
      selectedConnectionIds: new Set(),
    };
  }

  /**
   * Get current selection state
   */
  getState(): SelectionState {
    return {
      selectedNodeIds: new Set(this.state.selectedNodeIds),
      selectedConnectionIds: new Set(this.state.selectedConnectionIds),
    };
  }

  /**
   * Check if a node is selected
   */
  isNodeSelected(nodeId: string): boolean {
    return this.state.selectedNodeIds.has(nodeId);
  }

  /**
   * Check if a connection is selected
   */
  isConnectionSelected(connectionId: string): boolean {
    return this.state.selectedConnectionIds.has(connectionId);
  }

  /**
   * Select a node
   */
  selectNode(nodeId: string, multiSelect: boolean = false): void {
    if (!multiSelect) {
      this.state.selectedNodeIds.clear();
      this.state.selectedConnectionIds.clear();
    }
    this.state.selectedNodeIds.add(nodeId);
    this.notifyChange();
  }

  /**
   * Deselect a node
   */
  deselectNode(nodeId: string): void {
    this.state.selectedNodeIds.delete(nodeId);
    this.notifyChange();
  }

  /**
   * Toggle node selection
   */
  toggleNode(nodeId: string, multiSelect: boolean = false): void {
    if (this.state.selectedNodeIds.has(nodeId)) {
      if (multiSelect) {
        this.deselectNode(nodeId);
      } else {
        // Single select - clear all and select this one
        this.clear();
        this.selectNode(nodeId, false);
      }
    } else {
      this.selectNode(nodeId, multiSelect);
    }
  }

  /**
   * Select multiple nodes
   */
  selectNodes(nodeIds: string[], clearFirst: boolean = true): void {
    if (clearFirst) {
      this.clear();
    }
    for (const nodeId of nodeIds) {
      this.state.selectedNodeIds.add(nodeId);
    }
    this.notifyChange();
  }

  /**
   * Select a connection
   */
  selectConnection(connectionId: string, multiSelect: boolean = false): void {
    if (!multiSelect) {
      this.state.selectedNodeIds.clear();
      this.state.selectedConnectionIds.clear();
    }
    this.state.selectedConnectionIds.add(connectionId);
    this.notifyChange();
  }

  /**
   * Deselect a connection
   */
  deselectConnection(connectionId: string): void {
    this.state.selectedConnectionIds.delete(connectionId);
    this.notifyChange();
  }

  /**
   * Toggle connection selection
   */
  toggleConnection(connectionId: string, multiSelect: boolean = false): void {
    if (this.state.selectedConnectionIds.has(connectionId)) {
      if (multiSelect) {
        this.deselectConnection(connectionId);
      } else {
        // Single select - clear all and select this one
        this.clear();
        this.selectConnection(connectionId, false);
      }
    } else {
      this.selectConnection(connectionId, multiSelect);
    }
  }

  /**
   * Clear all selections
   */
  clear(): void {
    this.state.selectedNodeIds.clear();
    this.state.selectedConnectionIds.clear();
    this.notifyChange();
  }

  /**
   * Get selected node IDs as array
   */
  getSelectedNodeIds(): string[] {
    return Array.from(this.state.selectedNodeIds);
  }

  /**
   * Get selected connection IDs as array
   */
  getSelectedConnectionIds(): string[] {
    return Array.from(this.state.selectedConnectionIds);
  }

  /**
   * Check if anything is selected
   */
  hasSelection(): boolean {
    return this.state.selectedNodeIds.size > 0 || this.state.selectedConnectionIds.size > 0;
  }

  /**
   * Set change listener
   */
  setListener(listener: SelectionChangeListener): void {
    this.listener = listener;
  }

  private notifyChange(): void {
    this.listener?.onSelectionChanged?.(this.state);
  }
}
