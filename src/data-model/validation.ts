/**
 * Validation System for Node-Based Shader System (v2.0)
 *
 * Graph-level validation and re-exports. Node/connection validation in validationNode.ts and validationConnection.ts.
 */

import type { NodeGraph, Connection, ValidationResult, AutomationState } from './types';
import { isPortConnection, getConnectionTargetKey } from './connectionUtils';
import type { NodeSpecification } from './validationTypes';
import { validateNode } from './validationNode';
import { validateConnection } from './validationConnection';

export type { NodeSpecification } from './validationTypes';

/**
 * Validates a complete node graph.
 */
export function validateGraph(
  graph: NodeGraph,
  nodeSpecs: NodeSpecification[] = []
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!graph.id) errors.push('Graph missing id');
  if (!graph.name) errors.push('Graph missing name');
  if (graph.name && graph.name.length > 256) errors.push('Graph name exceeds maximum length of 256 characters');
  if (graph.version !== '2.0') errors.push(`Invalid graph version: ${graph.version} (expected "2.0")`);
  if (!Array.isArray(graph.nodes)) errors.push('Graph missing or invalid nodes array');
  if (!Array.isArray(graph.connections)) errors.push('Graph missing or invalid connections array');

  if (!graph.nodes || !graph.connections) {
    return { valid: false, errors, warnings };
  }

  const nodeIds = new Set<string>();
  for (const node of graph.nodes) {
    if (nodeIds.has(node.id)) errors.push(`Duplicate node ID: ${node.id}`);
    nodeIds.add(node.id);
  }
  const connectionIds = new Set<string>();
  for (const conn of graph.connections) {
    if (connectionIds.has(conn.id)) errors.push(`Duplicate connection ID: ${conn.id}`);
    connectionIds.add(conn.id);
  }

  for (const node of graph.nodes) {
    validateNode(node, nodeSpecs, errors, warnings);
  }
  for (const conn of graph.connections) {
    validateConnection(conn, graph, nodeSpecs, errors, warnings);
  }

  const targetKeyToConn = new Map<string, Connection>();
  for (const conn of graph.connections) {
    const key = getConnectionTargetKey(conn);
    if (!key) continue;
    if (targetKeyToConn.has(key)) {
      const existing = targetKeyToConn.get(key)!;
      const targetLabel = isPortConnection(conn) ? `port ${conn.targetPort}` : `parameter ${conn.targetParameter}`;
      errors.push(`Duplicate connection to ${targetLabel} on node ${conn.targetNodeId} (connection ${existing.id})`);
    } else {
      targetKeyToConn.set(key, conn);
    }
  }

  if (graph.viewState) {
    if (typeof graph.viewState.zoom !== 'number') {
      errors.push('View state zoom must be a number');
    } else if (graph.viewState.zoom < 0.10 || graph.viewState.zoom > 10.0) {
      warnings.push(`View state zoom is out of recommended range: ${graph.viewState.zoom}`);
    }
    if (typeof graph.viewState.panX !== 'number') errors.push('View state panX must be a number');
    if (typeof graph.viewState.panY !== 'number') errors.push('View state panY must be a number');
  }

  if (graph.automation) {
    validateAutomation(graph.automation, graph, nodeSpecs, warnings);
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validates automation state. Pushes issues to warnings only so graph load never fails due to invalid automation.
 */
export function validateAutomation(
  automation: AutomationState,
  graph: NodeGraph,
  nodeSpecs: NodeSpecification[],
  warnings: string[]
): void {
  if (typeof automation.bpm !== 'number' || automation.bpm <= 0) {
    warnings.push('Automation: bpm must be a positive number');
  }
  if (typeof automation.durationSeconds !== 'number' || automation.durationSeconds < 0) {
    warnings.push('Automation: durationSeconds must be a non-negative number');
  }
  if (!Array.isArray(automation.lanes)) {
    warnings.push('Automation: lanes must be an array');
    return;
  }

  const nodeById = new Map(graph.nodes.map(n => [n.id, n]));

  for (const lane of automation.lanes) {
    if (!lane.id) {
      warnings.push('Automation: lane missing id');
      continue;
    }
    const node = nodeById.get(lane.nodeId);
    if (!node) {
      warnings.push(`Automation lane ${lane.id}: node "${lane.nodeId}" not found`);
      continue;
    }
    const nodeSpec = nodeSpecs.find(s => s.id === node.type);
    if (!nodeSpec) {
      warnings.push(`Automation lane ${lane.id}: no spec for node type "${node.type}"`);
      continue;
    }
    const paramSpec = nodeSpec.parameters?.[lane.paramName];
    if (!paramSpec) {
      warnings.push(`Automation lane ${lane.id}: parameter "${lane.paramName}" not found on node type ${node.type}`);
      continue;
    }
    if (paramSpec.type !== 'float') {
      if (paramSpec.type === 'int') {
        warnings.push(`Automation lane ${lane.id}: parameter "${lane.paramName}" is int; automation supports float parameters only`);
      } else {
        warnings.push(`Automation lane ${lane.id}: parameter "${lane.paramName}" must be float (got ${paramSpec.type})`);
      }
      continue;
    }
    if (!Array.isArray(lane.regions)) {
      warnings.push(`Automation lane ${lane.id}: regions must be an array`);
      continue;
    }
    const sortedRegions = [...lane.regions].sort((a, b) => a.startTime - b.startTime);
    for (let i = 0; i < sortedRegions.length; i++) {
      const r = sortedRegions[i];
      if (typeof r.startTime !== 'number' || r.startTime < 0) {
        warnings.push(`Automation region ${r.id}: startTime must be >= 0`);
      }
      if (typeof r.duration !== 'number' || r.duration < 0) {
        warnings.push(`Automation region ${r.id}: duration must be >= 0`);
      }
      if (r.curve?.keyframes) {
        for (const kf of r.curve.keyframes) {
          if (typeof kf.time !== 'number' || kf.time < 0 || kf.time > 1) {
            warnings.push(`Automation region ${r.id}: keyframe time must be in [0, 1], got ${kf.time}`);
          }
        }
      }
      if (i < sortedRegions.length - 1) {
        const next = sortedRegions[i + 1];
        const end = r.startTime + r.duration;
        if (end > next.startTime) {
          warnings.push(`Automation lane ${lane.id}: overlapping regions (${r.id} ends at ${end}, next starts at ${next.startTime})`);
        }
      }
    }
  }
}

export function validateUniqueNodeIds(graph: NodeGraph): string[] {
  const errors: string[] = [];
  const nodeIds = new Set<string>();
  for (const node of graph.nodes) {
    if (nodeIds.has(node.id)) errors.push(`Duplicate node ID: ${node.id}`);
    nodeIds.add(node.id);
  }
  return errors;
}

export function validateUniqueConnectionIds(graph: NodeGraph): string[] {
  const errors: string[] = [];
  const connectionIds = new Set<string>();
  for (const conn of graph.connections) {
    if (connectionIds.has(conn.id)) errors.push(`Duplicate connection ID: ${conn.id}`);
    connectionIds.add(conn.id);
  }
  return errors;
}

export function validateConnectionNodeReferences(graph: NodeGraph): string[] {
  const errors: string[] = [];
  const nodeIds = new Set(graph.nodes.map(n => n.id));
  for (const conn of graph.connections) {
    if (!nodeIds.has(conn.sourceNodeId)) {
      errors.push(`Connection ${conn.id} references non-existent source node: ${conn.sourceNodeId}`);
    }
    if (!nodeIds.has(conn.targetNodeId)) {
      errors.push(`Connection ${conn.id} references non-existent target node: ${conn.targetNodeId}`);
    }
  }
  return errors;
}

export function validateNoDuplicateConnections(
  connection: Connection,
  existingConnections: Connection[]
): { valid: boolean; error?: string } {
  const key = getConnectionTargetKey(connection);
  if (!key) {
    return { valid: false, error: 'Connection must have exactly one of targetPort or targetParameter set' };
  }
  const duplicate = existingConnections.find(c => getConnectionTargetKey(c) === key);
  if (duplicate) {
    const targetLabel = isPortConnection(connection)
      ? `Input port '${connection.targetPort}'`
      : `Parameter '${connection.targetParameter}'`;
    return { valid: false, error: `${targetLabel} on node '${connection.targetNodeId}' already has a connection` };
  }
  return { valid: true };
}
