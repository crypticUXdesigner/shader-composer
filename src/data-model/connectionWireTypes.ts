/**
 * Shader wire types along connections (source output ↔ target input).
 * Shared by insert-node-into-connection and remove-node bridging.
 */

import type { NodeGraph, Connection } from './types';
import type { NodeSpecification } from './validationTypes';
import { isPortConnection, isParameterConnection } from './connectionUtils';

/** Type of the value leaving `connection.sourceNodeId` from `connection.sourcePort`. */
export function getUpstreamOutputType(
  graph: NodeGraph,
  conn: Connection,
  specs: NodeSpecification[]
): string | undefined {
  const src = graph.nodes.find((n) => n.id === conn.sourceNodeId);
  if (!src && conn.sourceNodeId.startsWith('audio-signal:')) {
    return conn.sourcePort === 'out' ? 'float' : undefined;
  }
  const srcSpec = src ? specs.find((s) => s.id === src.type) : undefined;
  if (!srcSpec) return undefined;
  const outSpec = srcSpec.outputs?.find((o) => o.name === conn.sourcePort);
  return outSpec?.type;
}

/** Type expected at the target end of `connection` (port input or float/int parameter). */
export function getDownstreamExpectedInputType(
  graph: NodeGraph,
  conn: Connection,
  specs: NodeSpecification[]
): string | undefined {
  const tgt = graph.nodes.find((n) => n.id === conn.targetNodeId);
  const tgtSpec = tgt ? specs.find((s) => s.id === tgt.type) : undefined;
  if (!tgtSpec) return undefined;
  if (isPortConnection(conn) && conn.targetPort) {
    const inp = tgtSpec.inputs?.find((i) => i.name === conn.targetPort);
    return inp?.type;
  }
  if (isParameterConnection(conn) && conn.targetParameter) {
    const p = tgtSpec.parameters?.[conn.targetParameter];
    if (p?.type === 'float' || p?.type === 'int') return p.type;
  }
  return undefined;
}
