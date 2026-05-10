/**
 * Tests for CompilationManager: no-worker path, worker path (mock), and destroy.
 * Ensures recompile applies result on main thread when worker is null, and posts
 * correct payload / applies result when worker is set; destroy terminates worker.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { NodeGraph } from '../data-model/types';
import type { CompilationResult } from './types';
import { createCompilationManager } from './factories';
import type { ShaderCompiler } from './types';
import type { RenderBackendSelection } from './renderBackends/renderBackendTypes';

// Mock ShaderInstance so we don't need WebGL. CompilationManager and parameterTransfer
// only need: setParameter, getParameters, setTimelineTime, setTime, getTimelineTime, getTime, destroy.
const mockInstanceMethods = {
  setParameter: vi.fn(),
  getParameters: vi.fn(() => [] as [string, number | [number, number, number, number]][]),
  setTimelineTime: vi.fn(),
  setTime: vi.fn(),
  getTimelineTime: vi.fn(() => 0),
  getTime: vi.fn(() => 0),
  destroy: vi.fn(),
};

vi.mock('./ShaderInstance', () => ({
  ShaderInstance: class MockShaderInstance {
    constructor(_gl: unknown, _result: CompilationResult, _opts?: unknown) {
      Object.assign(this, mockInstanceMethods);
    }
  },
  SHADER_INSTANCE_PROGRAM_PENDING_MESSAGE: 'WEBGL_PROGRAM_PENDING',
}));

function minimalCompilationResult(finalOutputNodeId: string | null = 'n2'): CompilationResult {
  return {
    backend: 'webgl',
    supported: true,
    unsupportedReasons: undefined,
    code: 'void main() { gl_FragColor = vec4(0.0); }',
    shaderCode: 'void main() { gl_FragColor = vec4(0.0); }',
    uniforms: [],
    metadata: {
      warnings: [],
      errors: [],
      executionOrder: [],
      finalOutputNodeId,
      previewDependencies: {
        usesWallTime: false,
        usesTimelineTime: false,
        usesAudioUniforms: false,
        usesRadialPulseVirtualDrive: false,
        usesRadialPulseSpawnUniformPass: false,
        usesResolutionUniform: false,
        usesMouseUniforms: false,
        usesFrameIndex: false
      }
    },
    paramLayout: {},
    resources: undefined,
    webgpuPassPlan: undefined,
  };
}

function minimalGraph(): NodeGraph {
  return {
    id: 'g1',
    name: 'Test',
    version: '2.0',
    nodes: [
      { id: 'n1', type: 'time', position: { x: 0, y: 0 }, parameters: {} },
      { id: 'n2', type: 'final-output', position: { x: 0, y: 0 }, parameters: {} },
    ],
    connections: [{ id: 'c1', sourceNodeId: 'n1', sourcePort: 'out', targetNodeId: 'n2', targetPort: 'in' }],
  };
}

function createMockCompiler(): ShaderCompiler {
  return {
    compile: vi.fn(() => minimalCompilationResult()),
    compileIncremental: vi.fn(() => null),
  };
}

function createMockRenderer() {
  const setShaderInstance = vi.fn();
  const markDirty = vi.fn();
  const render = vi.fn();
  const mockGL = {
    isContextLost: vi.fn(() => false),
  };
  const selection: RenderBackendSelection = { mode: 'auto', selected: 'webgl2', reason: 'test' };
  return {
    selection,
    setShaderInstance,
    markDirty,
    render,
    getGLContext: vi.fn(() => mockGL),
    getCanvas: vi.fn(() => ({ width: 1, height: 1 }) as unknown as HTMLCanvasElement),
    setOnContextRestored: vi.fn(),
    setOnContextLost: vi.fn(),
  };
}

// CompilationManager uses window.setTimeout / window.cancelIdleCallback; ensure window exists in Node test env.
function ensureWindow() {
  if (typeof (globalThis as unknown as { window?: unknown }).window === 'undefined') {
    (globalThis as unknown as { window: typeof globalThis }).window = globalThis as unknown as Window;
  }
}

describe('CompilationManager', () => {
  beforeEach(() => {
    ensureWindow();
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('no-worker path', () => {
    it('applies compilation result when recompile runs on main thread', () => {
      const compiler = createMockCompiler();
      const renderer = createMockRenderer();
      const cm = createCompilationManager(compiler, renderer);

      cm.setGraph(minimalGraph());
      cm.onGraphStructureChange(true); // immediate → setTimeout(0) then recompile

      vi.runAllTimers();

      expect(compiler.compile).toHaveBeenCalledWith(minimalGraph(), null, { backend: 'webgl' });
      expect(renderer.setShaderInstance).toHaveBeenCalled();
      expect(cm.getShaderInstance()).not.toBeNull();
      expect(cm.getPreviewDependencyMask()).toEqual({
        usesWallTime: false,
        usesTimelineTime: false,
        usesAudioUniforms: false,
        usesRadialPulseVirtualDrive: false,
        usesRadialPulseSpawnUniformPass: false,
        usesResolutionUniform: false,
        usesMouseUniforms: false,
        usesFrameIndex: false
      });
    });

    it('falls back to WebGL when WebGPU compile returns metadata errors (main thread)', () => {
      const compiler = createMockCompiler();
      const renderer = createMockRenderer();
      renderer.selection.selected = 'webgpu';
      compiler.compile = vi.fn((_g, _a, opts?: { backend?: string }) => {
        if (opts?.backend === 'webgpu') {
          return {
            ...minimalCompilationResult(),
            backend: 'webgpu',
            supported: true,
            metadata: {
              ...minimalCompilationResult().metadata,
              errors: ['WGSL failure'],
            },
          } satisfies CompilationResult;
        }
        return minimalCompilationResult();
      });
      const cm = createCompilationManager(compiler, renderer);

      cm.setGraph(minimalGraph());
      cm.onGraphStructureChange(true);
      vi.runAllTimers();

      expect(compiler.compile).toHaveBeenCalledTimes(2);
      expect(compiler.compile).toHaveBeenNthCalledWith(1, minimalGraph(), null, { backend: 'webgpu' });
      expect(compiler.compile).toHaveBeenNthCalledWith(2, minimalGraph(), null, { backend: 'webgl' });
      expect(renderer.setShaderInstance).toHaveBeenCalled();
      expect(cm.getShaderInstance()).not.toBeNull();
    });

    it('skips recompilation when only disconnected nodes change', () => {
      const compiler = createMockCompiler();
      const renderer = createMockRenderer();
      const cm = createCompilationManager(compiler, renderer);

      const g1 = minimalGraph();
      cm.setGraph(g1);
      cm.onGraphStructureChange(true);
      vi.runAllTimers();

      expect(compiler.compile).toHaveBeenCalledTimes(1);

      // Add a disconnected node (idle slice): no connections added/removed.
      const g2: NodeGraph = {
        ...g1,
        nodes: [...g1.nodes, { id: 'idle1', type: 'float', position: { x: 10, y: 10 }, parameters: { value: 1 } }],
      };
      cm.setGraph(g2);
      cm.onGraphStructureChange(true);
      vi.runAllTimers();

      // Should not recompile because output-reachable slice is unchanged.
      expect(compiler.compile).toHaveBeenCalledTimes(1);
    });

    it('skips recompilation when only idle-to-idle connections change', () => {
      const compiler = createMockCompiler();
      const renderer = createMockRenderer();
      const cm = createCompilationManager(compiler, renderer);

      const g1: NodeGraph = {
        ...minimalGraph(),
        nodes: [
          ...minimalGraph().nodes,
          { id: 'idle1', type: 'float', position: { x: 1, y: 1 }, parameters: { value: 0.5 } },
          { id: 'idle2', type: 'float', position: { x: 2, y: 2 }, parameters: { value: 0.25 } },
        ],
      };
      cm.setGraph(g1);
      cm.onGraphStructureChange(true);
      vi.runAllTimers();
      expect(compiler.compile).toHaveBeenCalledTimes(1);

      const g2: NodeGraph = {
        ...g1,
        connections: [
          ...g1.connections,
          {
            id: 'cIdle',
            sourceNodeId: 'idle2',
            sourcePort: 'out',
            targetNodeId: 'idle1',
            targetParameter: 'value',
          },
        ],
      };
      cm.setGraph(g2);
      cm.onGraphStructureChange(true);
      vi.runAllTimers();

      expect(compiler.compile).toHaveBeenCalledTimes(1);
    });

    it('recompiles when output path is rewired to a previously idle node', () => {
      const compiler = createMockCompiler();
      const renderer = createMockRenderer();
      const cm = createCompilationManager(compiler, renderer);

      const g1: NodeGraph = {
        ...minimalGraph(),
        nodes: [
          ...minimalGraph().nodes,
          { id: 'idle1', type: 'float', position: { x: 1, y: 1 }, parameters: { value: 0.9 } },
        ],
      };
      cm.setGraph(g1);
      cm.onGraphStructureChange(true);
      vi.runAllTimers();
      expect(compiler.compile).toHaveBeenCalledTimes(1);

      const g2: NodeGraph = {
        ...g1,
        connections: [
          {
            id: 'c2',
            sourceNodeId: 'idle1',
            sourcePort: 'out',
            targetNodeId: 'n2',
            targetPort: 'in',
          },
        ],
      };
      cm.setGraph(g2);
      cm.onGraphStructureChange(true);
      vi.runAllTimers();

      expect(compiler.compile).toHaveBeenCalledTimes(2);
    });

    it('ignores parameter updates for nodes outside the preview slice', () => {
      const compiler = createMockCompiler();
      const renderer = createMockRenderer();
      const cm = createCompilationManager(compiler, renderer);

      const g1: NodeGraph = {
        ...minimalGraph(),
        nodes: [
          ...minimalGraph().nodes,
          { id: 'idle1', type: 'float', position: { x: 1, y: 1 }, parameters: { value: 1 } },
        ],
      };
      cm.setGraph(g1);
      cm.onGraphStructureChange(true);
      vi.runAllTimers();

      mockInstanceMethods.setParameter.mockClear();
      cm.onParameterChange('idle1', 'value', 2);
      vi.runAllTimers();

      expect(mockInstanceMethods.setParameter).not.toHaveBeenCalled();
    });

    it('coalesces multiple immediate structure changes into one compile', () => {
      const compiler = createMockCompiler();
      const renderer = createMockRenderer();
      const cm = createCompilationManager(compiler, renderer);

      cm.setGraph(minimalGraph());
      cm.onGraphStructureChange(true);
      cm.onGraphStructureChange(true);
      cm.onGraphStructureChange(true);

      vi.runAllTimers();

      expect(compiler.compile).toHaveBeenCalledTimes(1);
    });
  });

  describe('worker path (mock)', () => {
    /** Node test env may lack rAF; stub so worker path runs, with immediate callback like production's next frame. */
    beforeEach(() => {
      vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
        cb(0);
        return 0;
      });
      vi.stubGlobal('cancelAnimationFrame', () => {});
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('posts compile payload and applies result when worker replies with matching id', () => {
      const postMessageCalls: unknown[] = [];
      const mockWorker = {
        postMessage: vi.fn((payload: unknown) => postMessageCalls.push(payload)),
        onmessage: null as ((ev: MessageEvent) => void) | null,
        terminate: vi.fn(),
      };

      const compiler = createMockCompiler();
      const renderer = createMockRenderer();
      const cm = createCompilationManager(compiler, renderer, undefined, mockWorker as unknown as Worker);

      cm.setGraph(minimalGraph());
      cm.onGraphStructureChange(true);

      vi.runAllTimers();

      expect(postMessageCalls.length).toBeGreaterThanOrEqual(1);
      const payload = postMessageCalls[0] as {
        type: string;
        id: number;
        targetBackend: string;
        graph: NodeGraph;
        audioSetup: unknown;
        affectedNodeIds: string[];
        tryIncremental: boolean;
      };
      expect(payload.type).toBe('compile');
      expect(typeof payload.id).toBe('number');
      expect(payload.targetBackend).toBe('webgl');
      expect(payload.graph).toEqual(minimalGraph());
      expect(payload.audioSetup).toBeNull();
      expect(Array.isArray(payload.affectedNodeIds)).toBe(true);
      expect(typeof payload.tryIncremental).toBe('boolean');

      // Main-thread compiler should not be used when worker is set
      expect(compiler.compile).not.toHaveBeenCalled();

      // Simulate worker reply with matching id
      const result = minimalCompilationResult();
      const replyId = payload.id;
      mockWorker.onmessage?.({
        data: { type: 'result', id: replyId, result },
      } as MessageEvent);

      expect(renderer.setShaderInstance).toHaveBeenCalled();
      expect(cm.getShaderInstance()).not.toBeNull();
      expect(cm.getPreviewDependencyMask()).toEqual(result.metadata.previewDependencies);
    });

    it('captures `unsupportedReasons` and emits a single info notice when WebGPU compile falls back to WebGL', () => {
      const postMessageCalls: unknown[] = [];
      const mockWorker = {
        postMessage: vi.fn((payload: unknown) => postMessageCalls.push(payload)),
        onmessage: null as ((ev: MessageEvent) => void) | null,
        terminate: vi.fn(),
      };
      const compiler = createMockCompiler();
      const renderer = createMockRenderer();
      // Force WebGPU as the requested backend so the fallback path is exercised.
      renderer.selection.selected = 'webgpu';
      const reportCalls: Array<{
        category: string;
        severity: string;
        message: string;
        details: string[] | undefined;
      }> = [];
      const errorHandler = {
        reportError: vi.fn(),
        report: vi.fn(
          (
            category: string,
            severity: string,
            message: string,
            details?: string[] | Record<string, unknown>
          ) => {
            reportCalls.push({
              category,
              severity,
              message,
              details: Array.isArray(details) ? details : undefined,
            });
          }
        ),
        onError: vi.fn(),
        offError: vi.fn(),
      };
      const cm = createCompilationManager(compiler, renderer, errorHandler, mockWorker as unknown as Worker);

      cm.setGraph(minimalGraph());
      cm.onGraphStructureChange(true);
      vi.runAllTimers();

      expect(postMessageCalls.length).toBeGreaterThanOrEqual(1);
      const initialPayload = postMessageCalls[0] as { id: number; targetBackend: string };
      expect(initialPayload.targetBackend).toBe('webgpu');

      // Reply with an unsupported WebGPU result mirroring leftover WebGL-only fragments.
      const webgpuUnsupported: CompilationResult = {
        ...minimalCompilationResult(),
        backend: 'webgpu',
        supported: false,
        unsupportedReasons: ['unsupported node type: ___webgpu_fixture_placeholder_node___'],
        code: '',
      };
      mockWorker.onmessage?.({
        data: { type: 'result', id: initialPayload.id, result: webgpuUnsupported },
      } as MessageEvent);

      // Manager must request a WebGL recompile and emit a single info notice with the reasons.
      expect(postMessageCalls.length).toBe(2);
      const fallbackPayload = postMessageCalls[1] as { targetBackend: string };
      expect(fallbackPayload.targetBackend).toBe('webgl');
      expect(reportCalls).toHaveLength(1);
      expect(reportCalls[0].severity).toBe('info');
      expect(reportCalls[0].message).toBe('Switching to WebGL fallback...');
      expect(reportCalls[0].details).toEqual(webgpuUnsupported.unsupportedReasons);

      // Replaying the same fallback (same reasons) must not double-toast.
      cm.setGraph(minimalGraph());
      cm.onGraphStructureChange(true);
      vi.runAllTimers();
      const followupPayload = postMessageCalls[postMessageCalls.length - 1] as { id: number };
      mockWorker.onmessage?.({
        data: { type: 'result', id: followupPayload.id, result: webgpuUnsupported },
      } as MessageEvent);
      expect(reportCalls).toHaveLength(1);
    });

    it('requests WebGL recompile when WebGPU result has metadata errors (no broken preview)', () => {
      const postMessageCalls: unknown[] = [];
      const mockWorker = {
        postMessage: vi.fn((payload: unknown) => postMessageCalls.push(payload)),
        onmessage: null as ((ev: MessageEvent) => void) | null,
        terminate: vi.fn(),
      };
      const compiler = createMockCompiler();
      const renderer = createMockRenderer();
      renderer.selection.selected = 'webgpu';

      const cm = createCompilationManager(compiler, renderer, undefined, mockWorker as unknown as Worker);

      cm.setGraph(minimalGraph());
      cm.onGraphStructureChange(true);
      vi.runAllTimers();

      const initialPayload = postMessageCalls[0] as { id: number; targetBackend: string };
      expect(initialPayload.targetBackend).toBe('webgpu');

      const webgpuWithErrors: CompilationResult = {
        ...minimalCompilationResult(),
        backend: 'webgpu',
        supported: true,
        metadata: {
          ...minimalCompilationResult().metadata,
          errors: ['WGSL compile failed (fixture)'],
        },
      };
      mockWorker.onmessage?.({
        data: { type: 'result', id: initialPayload.id, result: webgpuWithErrors },
      } as MessageEvent);

      expect(postMessageCalls.length).toBe(2);
      const fallbackPayload = postMessageCalls[1] as { targetBackend: string };
      expect(fallbackPayload.targetBackend).toBe('webgl');

      const okGl = minimalCompilationResult();
      mockWorker.onmessage?.({
        data: { type: 'result', id: (postMessageCalls[1] as { id: number }).id, result: okGl },
      } as MessageEvent);

      expect(renderer.setShaderInstance).toHaveBeenCalled();
      expect(cm.getShaderInstance()).not.toBeNull();
    });

    it('ignores worker result when id does not match', () => {
      const postMessageCalls: unknown[] = [];
      const mockWorker = {
        postMessage: vi.fn((payload: unknown) => postMessageCalls.push(payload)),
        onmessage: null as ((ev: MessageEvent) => void) | null,
        terminate: vi.fn(),
      };

      const compiler = createMockCompiler();
      const renderer = createMockRenderer();
      const cm = createCompilationManager(compiler, renderer, undefined, mockWorker as unknown as Worker);

      cm.setGraph(minimalGraph());
      cm.onGraphStructureChange(true);
      vi.runAllTimers();

      const payload = postMessageCalls[0] as { id: number };
      const wrongId = payload.id + 999;
      mockWorker.onmessage?.({
        data: { type: 'result', id: wrongId, result: minimalCompilationResult() },
      } as MessageEvent);

      // setShaderInstance should not have been called from this stale reply
      expect(renderer.setShaderInstance).not.toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('terminates worker when destroy is called', () => {
      const terminate = vi.fn();
      const mockWorker = {
        postMessage: vi.fn(),
        onmessage: null,
        terminate,
      };

      const compiler = createMockCompiler();
      const renderer = createMockRenderer();
      const cm = createCompilationManager(compiler, renderer, undefined, mockWorker as unknown as Worker);

      cm.destroy();
      expect(terminate).toHaveBeenCalledTimes(1);
    });
  });
});
