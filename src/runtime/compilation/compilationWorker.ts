/**
 * Compilation worker: receives init and compile messages, runs NodeShaderCompiler
 * (full or incremental), posts result or error. Worker-safe only (no DOM/WebGL).
 */

import { NodeShaderCompiler } from '../../shaders/NodeShaderCompiler';
import type { CompilationResult } from '../types';
import type { NodeSpec } from '../../types/nodeSpec';
import type {
  WorkerInitPayload,
  WorkerCompilePayload,
  WorkerReplyMessage
} from './workerMessages';

let compiler: NodeShaderCompiler | null = null;

function buildNodeSpecMap(nodeSpecs: Record<string, NodeSpec>): Map<string, NodeSpec> {
  return new Map(Object.entries(nodeSpecs));
}

self.onmessage = (event: MessageEvent<WorkerInitPayload | WorkerCompilePayload>) => {
  const data = event.data;

  if (data.type === 'init') {
    const map = buildNodeSpecMap(data.nodeSpecs);
    compiler = new NodeShaderCompiler(map);
    const reply: WorkerReplyMessage = { type: 'inited' };
    self.postMessage(reply);
    return;
  }

  if (data.type === 'compile') {
    const payload = data as WorkerCompilePayload;
    if (compiler == null) {
      self.postMessage({
        type: 'error',
        id: payload.id,
        message: 'Worker not initialized'
      } satisfies WorkerReplyMessage);
      return;
    }

    const { id, graph, audioSetup, previousResult, affectedNodeIds, tryIncremental } = payload;
    const affectedNodeIdsSet = new Set(affectedNodeIds);

    try {
      let result: CompilationResult;

      if (tryIncremental && previousResult != null) {
        const incrementalResult = compiler.compileIncremental(
          graph,
          previousResult,
          affectedNodeIdsSet,
          audioSetup ?? undefined
        );
        if (incrementalResult != null) {
          result = incrementalResult;
        } else {
          result = compiler.compile(graph, audioSetup ?? undefined);
        }
      } else {
        result = compiler.compile(graph, audioSetup ?? undefined);
      }

      self.postMessage({
        type: 'result',
        id,
        result
      } satisfies WorkerReplyMessage);
    } catch (e) {
      self.postMessage({
        type: 'error',
        id,
        message: e instanceof Error ? e.message : String(e)
      } satisfies WorkerReplyMessage);
    }
  }
};
