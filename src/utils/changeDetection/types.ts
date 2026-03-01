/**
 * Change Detection Types
 * 
 * Types and interfaces for unified graph change detection system.
 */

/**
 * Types of changes that can occur in a graph
 */
export enum ChangeType {
  /** No changes detected */
  NONE = 'none',
  /** Only node positions or viewState changed */
  POSITION_ONLY = 'position_only',
  /** Node structure changed (added/removed nodes) */
  STRUCTURE = 'structure',
  /** Connections changed */
  CONNECTIONS = 'connections',
  /** Node parameters changed */
  PARAMETERS = 'parameters',
  /** Node types changed */
  NODE_TYPES = 'node_types',
  /** Multiple types of changes */
  MIXED = 'mixed'
}

/**
 * Detailed change detection result
 */
export interface ChangeDetectionResult {
  /** Primary change type */
  changeType: ChangeType;
  
  /** True if only positions/viewState changed */
  isOnlyPositionChange: boolean;
  
  /** True if graph structure changed (nodes added/removed) */
  isStructureChanged: boolean;
  
  /** True if connections changed */
  isConnectionsChanged: boolean;
  
  /** True if node parameters changed */
  isParametersChanged: boolean;
  
  /** True if node types changed */
  isNodeTypesChanged: boolean;
  
  /** List of added node IDs */
  addedNodeIds: string[];
  
  /** List of removed node IDs */
  removedNodeIds: string[];
  
  /** List of changed node IDs (type or parameters changed) */
  changedNodeIds: string[];
  
  /** Set of affected node IDs (for incremental compilation) */
  affectedNodeIds: Set<string>;
  
  /** List of added connection IDs */
  addedConnectionIds: string[];
  
  /** List of removed connection IDs */
  removedConnectionIds: string[];
}

/**
 * Options for change detection
 */
export interface ChangeDetectionOptions {
  /** Track affected nodes for incremental compilation (default: false) */
  trackAffectedNodes?: boolean;
  
  /** Include connection IDs in result (default: true) */
  includeConnectionIds?: boolean;
}
