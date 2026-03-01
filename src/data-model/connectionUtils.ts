/**
 * Connection helpers for the node graph data model.
 *
 * Enforces the invariant: exactly one of targetPort or targetParameter is set.
 * Use isPortConnection / isParameterConnection for type narrowing and branching.
 */

import type { Connection } from './types';

/**
 * Type guard: connection targets a node input port (not a parameter).
 */
export function isPortConnection(
  conn: Connection
): conn is Connection & { targetPort: string } {
  return conn.targetPort != null && conn.targetPort !== '';
}

/**
 * Type guard: connection targets a node parameter (e.g. for live/audio-driven values).
 */
export function isParameterConnection(
  conn: Connection
): conn is Connection & { targetParameter: string } {
  return conn.targetParameter != null && conn.targetParameter !== '';
}

/**
 * Returns a unique key for duplicate detection: one connection per target port or per target parameter.
 * Use only for connections that satisfy the invariant (exactly one of targetPort/targetParameter set).
 *
 * - Port connections: key = `p:targetNodeId:targetPort`
 * - Parameter connections: key = `param:targetNodeId:targetParameter`
 */
export function getConnectionTargetKey(conn: Connection): string {
  if (isPortConnection(conn)) {
    return `p:${conn.targetNodeId}:${conn.targetPort}`;
  }
  if (isParameterConnection(conn)) {
    return `param:${conn.targetNodeId}:${conn.targetParameter}`;
  }
  return '';
}
