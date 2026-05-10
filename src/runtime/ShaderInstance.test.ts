import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ShaderInstance,
  SHADER_INSTANCE_PROGRAM_PENDING_MESSAGE,
  type ShaderInstanceOptions,
} from './ShaderInstance';
import type { CompilationResult } from './types';

/** Fake enum value for parallel compile completion (must not collide with LINK_STATUS). */
const COMPLETION_KHR = 91_181;

function minimalCompilationResult(fragmentMain: string): CompilationResult {
  return {
    backend: 'webgl',
    supported: true,
    code: fragmentMain,
    shaderCode: fragmentMain,
    uniforms: [],
    metadata: {
      warnings: [],
      errors: [],
      executionOrder: [],
      finalOutputNodeId: 'out',
      previewDependencies: {
        usesWallTime: false,
        usesTimelineTime: false,
        usesAudioUniforms: false,
        usesRadialPulseVirtualDrive: false,
        usesRadialPulseSpawnUniformPass: false,
        usesResolutionUniform: false,
        usesMouseUniforms: false,
        usesFrameIndex: false,
      },
    },
    paramLayout: {},
  };
}

describe('ShaderInstance linkCompletionMode', () => {
  let completionQueries: number;

  beforeEach(() => {
    completionQueries = 0;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function createMockGl(): WebGL2RenderingContext {
    const program = {};
    const vs = {};
    const fs = {};
    const mock = {
      isContextLost: () => false,
      getExtension: vi.fn((name: string) =>
        name === 'KHR_parallel_shader_compile' ? { COMPLETION_STATUS_KHR: COMPLETION_KHR } : null
      ),
      VERTEX_SHADER: 35633,
      FRAGMENT_SHADER: 35632,
      COMPILE_STATUS: 35713,
      LINK_STATUS: 35714,
      ARRAY_BUFFER: 34962,
      STATIC_DRAW: 35044,
      createShader: vi.fn(() => vs),
      shaderSource: vi.fn(),
      compileShader: vi.fn(),
      getShaderParameter: vi.fn(() => true),
      createProgram: vi.fn(() => program),
      attachShader: vi.fn(),
      linkProgram: vi.fn(),
      getProgramParameter: vi.fn((_p: unknown, pname: number) => {
        if (pname === COMPLETION_KHR) {
          completionQueries += 1;
          return completionQueries >= 3;
        }
        if (pname === 35714) return true;
        return false;
      }),
      getUniformLocation: vi.fn(() => null),
      getAttribLocation: vi.fn(() => 0),
      createBuffer: vi.fn(() => ({})),
      bindBuffer: vi.fn(),
      bufferData: vi.fn(),
      useProgram: vi.fn(),
      deleteShader: vi.fn(),
      deleteProgram: vi.fn(),
    };
    return mock as unknown as WebGL2RenderingContext;
  }

  it('deferPending throws PROGRAM_PENDING while parallel link is in flight, then succeeds on a later attempt', () => {
    const gl = createMockGl();
    const result = minimalCompilationResult('#version 300 es\nprecision highp float;\nout vec4 fc;\nvoid main(){ fc=vec4(0.0); }');

    expect(() => new ShaderInstance(gl, result, { linkCompletionMode: 'deferPending' })).toThrow(
      SHADER_INSTANCE_PROGRAM_PENDING_MESSAGE
    );

    const inst = new ShaderInstance(gl, result, { linkCompletionMode: 'deferPending' });
    expect(inst).toBeDefined();
  });

  it('blocking waits until completion without throwing', () => {
    const gl = createMockGl();
    const result = minimalCompilationResult('#version 300 es\nprecision highp float;\nout vec4 fc;\nvoid main(){ fc=vec4(0.0); }');

    const opts: ShaderInstanceOptions = { linkCompletionMode: 'blocking' };
    const inst = new ShaderInstance(gl, result, opts);
    expect(inst).toBeDefined();
    expect(completionQueries).toBeGreaterThanOrEqual(3);
  });

  it('defaults to blocking semantics when options omitted', () => {
    const gl = createMockGl();
    const result = minimalCompilationResult('#version 300 es\nprecision highp float;\nout vec4 fc;\nvoid main(){ fc=vec4(0.0); }');

    const inst = new ShaderInstance(gl, result);
    expect(inst).toBeDefined();
    expect(completionQueries).toBeGreaterThanOrEqual(3);
  });
});
