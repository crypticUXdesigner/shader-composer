/**
 * Insert an existing node into an existing connection (A→B becomes A→M→B).
 * Single atomic graph replace; validate-before-commit only.
 */

import type { NodeGraph, Connection } from './types';
import type { NodeSpecification } from './validationTypes';
import { removeConnection, addConnectionWithValidation } from './immutableUpdates';
import { isPortConnection } from './connectionUtils';
import { generateUUID } from './utils';
import { canConvertShaderPortTypes } from '../utils/shaderPortTypes';
import { getDownstreamExpectedInputType, getUpstreamOutputType } from './connectionWireTypes';

export type InsertNodeIntoConnectionErrorCode =
  | 'connection_not_found'
  | 'insert_node_not_found'
  | 'cannot_patch_endpoint_node'
  | 'no_valid_ports';

export type InsertNodeIntoConnectionResult =
  | { ok: true; graph: NodeGraph }
  | { ok: false; code: InsertNodeIntoConnectionErrorCode };

function inputPortOccupied(graph: NodeGraph, nodeId: string, portName: string): boolean {
  return graph.connections.some(
    (c) => c.targetNodeId === nodeId && c.targetPort === portName && c.targetPort !== ''
  );
}

/** True if this node already has at least one outgoing connection from `portName`. */
function outputPortOccupied(graph: NodeGraph, nodeId: string, portName: string): boolean {
  return graph.connections.some((c) => c.sourceNodeId === nodeId && c.sourcePort === portName);
}

/**
 * Patch tool port selection (deterministic):
 * 1. Inputs/outputs must be type-compatible with the wire (see `canConvertShaderPortTypes`).
 * 2. Prefer the first compatible input (spec order) with no incoming connection; else the first
 *    compatible input (addConnection replaces any existing wire to that input).
 * 3. Prefer the first compatible output (spec order) with no outgoing connection from that port;
 *    else the first compatible output (may fan out from an already-used output).
 */
function pickPatchPorts(
  graphAfterRemove: NodeGraph,
  conn: Connection,
  insertSpec: NodeSpecification,
  insertNodeId: string,
  specs: NodeSpecification[]
): { inName: string; outName: string } | null {
  const upstreamType = getUpstreamOutputType(graphAfterRemove, conn, specs);
  const downstreamType = getDownstreamExpectedInputType(graphAfterRemove, conn, specs);
  if (!upstreamType || !downstreamType) return null;

  const compatibleInputs = (insertSpec.inputs ?? []).filter((mi) =>
    canConvertShaderPortTypes(upstreamType, mi.type)
  );
  const compatibleOutputs = (insertSpec.outputs ?? []).filter((mo) =>
    canConvertShaderPortTypes(mo.type, downstreamType)
  );
  if (compatibleInputs.length === 0 || compatibleOutputs.length === 0) return null;

  let inPick = compatibleInputs.find((mi) => !inputPortOccupied(graphAfterRemove, insertNodeId, mi.name));
  if (!inPick) inPick = compatibleInputs[0];

  let outPick = compatibleOutputs.find((mo) => !outputPortOccupied(graphAfterRemove, insertNodeId, mo.name));
  if (!outPick) outPick = compatibleOutputs[0];

  return { inName: inPick.name, outName: outPick.name };
}

function tryBuildGraph(
  graphAfterRemove: NodeGraph,
  conn: Connection,
  insertNodeId: string,
  pair: { inName: string; outName: string },
  specs: NodeSpecification[]
): NodeGraph | null {
  const id1 = generateUUID();
  const id2 = generateUUID();

  const c1: Connection = {
    id: id1,
    sourceNodeId: conn.sourceNodeId,
    sourcePort: conn.sourcePort,
    targetNodeId: insertNodeId,
    targetPort: pair.inName,
  };

  const c2: Connection = isPortConnection(conn)
    ? {
        id: id2,
        sourceNodeId: insertNodeId,
        sourcePort: pair.outName,
        targetNodeId: conn.targetNodeId,
        targetPort: conn.targetPort,
      }
    : {
        id: id2,
        sourceNodeId: insertNodeId,
        sourcePort: pair.outName,
        targetNodeId: conn.targetNodeId,
        targetParameter: conn.targetParameter,
      };

  const r1 = addConnectionWithValidation(graphAfterRemove, c1, specs, { replaceExisting: true });
  if (r1.errors.length > 0) return null;
  const r2 = addConnectionWithValidation(r1.graph, c2, specs, { replaceExisting: true });
  if (r2.errors.length > 0) return null;
  return r2.graph;
}

/**
 * Remove `connectionId` and insert `insertNodeId` in the middle (A→B becomes A→M→B)
 * using deterministic port selection (see `pickPatchPorts`).
 */
export function insertNodeIntoConnection(
  graph: NodeGraph,
  connectionId: string,
  insertNodeId: string,
  specs: NodeSpecification[]
): InsertNodeIntoConnectionResult {
  const conn = graph.connections.find((c) => c.id === connectionId);
  if (!conn) return { ok: false, code: 'connection_not_found' };

  const insertNode = graph.nodes.find((n) => n.id === insertNodeId);
  if (!insertNode) return { ok: false, code: 'insert_node_not_found' };

  if (insertNodeId === conn.sourceNodeId || insertNodeId === conn.targetNodeId) {
    return { ok: false, code: 'cannot_patch_endpoint_node' };
  }

  const insertSpec = specs.find((s) => s.id === insertNode.type);
  if (!insertSpec) return { ok: false, code: 'no_valid_ports' };

  const graphWithout = removeConnection(graph, connectionId);
  const pair = pickPatchPorts(graphWithout, conn, insertSpec, insertNodeId, specs);
  if (!pair) return { ok: false, code: 'no_valid_ports' };

  const g = tryBuildGraph(graphWithout, conn, insertNodeId, pair, specs);
  if (g == null) return { ok: false, code: 'no_valid_ports' };

  return { ok: true, graph: g };
}
