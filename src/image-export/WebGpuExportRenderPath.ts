import type { NodeGraph } from '../data-model/types';
import type { AudioSetup } from '../data-model/audioSetupTypes';
import type { CompilationResult, ShaderCompiler } from '../runtime/types';
import { isRuntimeOnlyParameter } from '../utils/runtimeOnlyParams';
import type { BlurGaussianSeparableV1Runtime } from '../runtime/renderBackends/blurGaussianSeparablePassPlanRuntime';
import {
  createBlurGaussianSeparableV1Runtime,
  destroyBlurGaussianSeparableV1Runtime,
  encodeBlurGaussianSeparableV1Frame,
  validateBlurGaussianSeparableV1ShaderModules,
} from '../runtime/renderBackends/blurGaussianSeparablePassPlanRuntime';
import type { GlowBloomV1Runtime } from '../runtime/renderBackends/glowBloomPassPlanRuntime';
import {
  createGlowBloomV1Runtime,
  destroyGlowBloomV1Runtime,
  encodeGlowBloomV1Frame,
  validateGlowBloomV1ShaderModules,
} from '../runtime/renderBackends/glowBloomPassPlanRuntime';
import type { BokehV1Runtime } from '../runtime/renderBackends/bokehPassPlanRuntime';
import {
  createBokehV1Runtime,
  destroyBokehV1Runtime,
  encodeBokehV1Frame,
  validateBokehV1ShaderModules,
} from '../runtime/renderBackends/bokehPassPlanRuntime';
import type { CrepuscularRaysV1Runtime } from '../runtime/renderBackends/crepuscularRaysPassPlanRuntime';
import {
  createCrepuscularRaysV1Runtime,
  destroyCrepuscularRaysV1Runtime,
  encodeCrepuscularRaysV1Frame,
  validateCrepuscularRaysV1ShaderModules,
} from '../runtime/renderBackends/crepuscularRaysPassPlanRuntime';
import { selectWebGpuRgbaExportFormat } from '../runtime/renderBackends/webgpuPresentationFormat';

type NavigatorGpu = {
  gpu?: GPU;
};

function getNavigatorGpu(): GPU | undefined {
  const nav = typeof navigator !== 'undefined' ? (navigator as unknown as NavigatorGpu) : undefined;
  return nav?.gpu;
}

/** Chromium warns (and ignores) `powerPreference` on Windows; see https://crbug.com/369219127 */
function requestAdapterOptions(): GPURequestAdapterOptions {
  if (typeof navigator !== 'undefined' && /Windows/i.test(navigator.userAgent)) {
    return {};
  }
  return { powerPreference: 'high-performance' };
}

function computeParamSlotCount(layout: CompilationResult['paramLayout']): number {
  const vals = Object.values(layout);
  if (vals.length === 0) return 1;
  let max = 0;
  for (const v of vals) max = Math.max(max, v);
  return max + 1;
}

function alignTo(value: number, alignment: number): number {
  return Math.ceil(value / alignment) * alignment;
}

function packRgbaTightFromPaddedRows(
  width: number,
  height: number,
  padded: Uint8Array,
  bytesPerRow: number
): Uint8Array {
  const tightStride = width * 4;
  const out = new Uint8Array(tightStride * height);
  for (let y = 0; y < height; y++) {
    const srcOff = y * bytesPerRow;
    const dstOff = y * tightStride;
    out.set(padded.subarray(srcOff, srcOff + tightStride), dstOff);
  }
  return out;
}

function setParamSlot(
  paramsData: Float32Array,
  layout: CompilationResult['paramLayout'],
  nodeId: string,
  paramName: string,
  value: number | [number, number, number, number]
): void {
  const idx = layout[`${nodeId}.${paramName}`];
  if (idx == null) return;
  const o = idx * 4;
  if (typeof value === 'number') {
    paramsData[o + 0] = value;
    paramsData[o + 1] = 0;
    paramsData[o + 2] = 0;
    paramsData[o + 3] = 0;
    return;
  }
  paramsData[o + 0] = value[0];
  paramsData[o + 1] = value[1];
  paramsData[o + 2] = value[2];
  paramsData[o + 3] = value[3];
}

/**
 * Populate the WebGPU param buffer from the graph, mirroring the export WebGL behavior:
 * - skip runtime-only params
 * - if a parameter is connected and its mode is 'override', skip the literal value
 */
function transferParametersFromGraph(graph: NodeGraph, result: CompilationResult, paramsData: Float32Array): void {
  for (const node of graph.nodes) {
    for (const [paramName, value] of Object.entries(node.parameters)) {
      if (isRuntimeOnlyParameter(node.type, paramName)) continue;

      const isConnected = graph.connections.some((c) => c.targetNodeId === node.id && c.targetParameter === paramName);
      if (isConnected && node.parameterInputModes?.[paramName] === 'override') continue;

      if (typeof value === 'number') {
        setParamSlot(paramsData, result.paramLayout, node.id, paramName, value);
      }
    }
  }
}

export interface WebGpuExportRenderOptions {
  width: number;
  height: number;
  timeSeconds: number;
  timelineTimeSeconds: number;
  /**
   * Parameter updates (e.g. audio uniforms) applied after transferring graph defaults.
   * Values are packed into `array<vec4<f32>>` with scalars in `.x`.
   */
  uniformUpdates?: Array<{ nodeId: string; paramName: string; value: number | [number, number, number, number] }>;
}

export type WebGpuExportRenderResult =
  | { ok: true; rgba8: Uint8Array; compilation: CompilationResult }
  | { ok: false; reason: string; compilation?: CompilationResult; error?: Error };

/**
 * Render a single deterministic frame via WebGPU and read back RGBA8 pixels.
 *
 * Color space notes:
 * - The default render target is `rgba8unorm` and readback returns raw unorm bytes.
 * - The golden harness can force `rgba8unorm-srgb` to test color-space hypotheses across paths.
 */
export async function renderWebGpuExportRgba8(
  graph: NodeGraph,
  compiler: ShaderCompiler,
  audioSetup: AudioSetup | null,
  opts: WebGpuExportRenderOptions
): Promise<WebGpuExportRenderResult> {
  const gpu = getNavigatorGpu();
  if (!gpu) return { ok: false, reason: 'navigator.gpu.absent' };

  let adapter: GPUAdapter | null;
  try {
    adapter = await gpu.requestAdapter(requestAdapterOptions());
  } catch (e) {
    const err = e instanceof Error ? e : new Error('WebGPU requestAdapter failed', { cause: e });
    return { ok: false, reason: 'requestAdapter.failed', error: err };
  }
  if (!adapter) return { ok: false, reason: 'requestAdapter.null' };

  let device: GPUDevice;
  try {
    device = await adapter.requestDevice();
  } catch (e) {
    const err = e instanceof Error ? e : new Error('WebGPU requestDevice failed', { cause: e });
    return { ok: false, reason: 'requestDevice.failed', error: err };
  }

  const compilation = compiler.compile(graph, audioSetup, { backend: 'webgpu' });
  if (compilation.metadata.errors.length > 0) {
    return { ok: false, reason: `compile.errors`, compilation };
  }
  if (compilation.backend !== 'webgpu') {
    return { ok: false, reason: `compile.backend.${compilation.backend}`, compilation };
  }
  if (!compilation.supported) {
    return { ok: false, reason: 'compile.unsupported', compilation };
  }

  const width = Math.max(1, Math.floor(opts.width));
  const height = Math.max(1, Math.floor(opts.height));

  if (compilation.webgpuPassPlan) {
    const plan = compilation.webgpuPassPlan;
    if (plan.kind === 'pass.blur.gaussian-separable.v1') {
      let rt: BlurGaussianSeparableV1Runtime | null = null;
      try {
        const wgslErr = await validateBlurGaussianSeparableV1ShaderModules(device, plan);
        if (wgslErr) {
          return { ok: false, reason: 'wgsl.compile', compilation, error: new Error(wgslErr) };
        }

        device.pushErrorScope('validation');
        const colorFormat = selectWebGpuRgbaExportFormat();
        rt = createBlurGaussianSeparableV1Runtime(device, plan, compilation.paramLayout, colorFormat);
        const validationErr = await device.popErrorScope();
        if (validationErr) {
          destroyBlurGaussianSeparableV1Runtime(rt);
          rt = null;
          return {
            ok: false,
            reason: 'webgpu.validation',
            compilation,
            error: new Error(validationErr.message ?? String(validationErr)),
          };
        }

        transferParametersFromGraph(graph, compilation, rt.paramsData);
        if (opts.uniformUpdates) {
          for (const u of opts.uniformUpdates) {
            setParamSlot(rt.paramsData, compilation.paramLayout, u.nodeId, u.paramName, u.value);
          }
        }
        rt.paramsDirty = true;
        rt.time = opts.timeSeconds;
        rt.timelineTime = opts.timelineTimeSeconds;

        const target = device.createTexture({
          size: { width, height },
          format: colorFormat,
          usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
        });

        let readback: GPUBuffer | null = null;
        try {
          encodeBlurGaussianSeparableV1Frame(device, device.queue, rt, width, height, target.createView());

          const bytesPerRow = alignTo(width * 4, 256);
          readback = device.createBuffer({
            size: bytesPerRow * height,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
          });

          const copyEnc = device.createCommandEncoder();
          copyEnc.copyTextureToBuffer(
            { texture: target },
            { buffer: readback, bytesPerRow, rowsPerImage: height },
            { width, height }
          );
          device.queue.submit([copyEnc.finish()]);
          await device.queue.onSubmittedWorkDone();

          await readback.mapAsync(GPUMapMode.READ);
          const mapped = new Uint8Array(readback.getMappedRange());
          const tight = packRgbaTightFromPaddedRows(width, height, mapped, bytesPerRow);
          readback.unmap();

          return { ok: true, rgba8: tight, compilation };
        } finally {
          try {
            target.destroy();
          } catch {
            // ignore
          }
          if (readback) {
            try {
              readback.destroy();
            } catch {
              // ignore
            }
          }
        }
      } catch (e) {
        const err = e instanceof Error ? e : new Error('WebGPU export render failed', { cause: e });
        return { ok: false, reason: 'render.failed', compilation, error: err };
      } finally {
        destroyBlurGaussianSeparableV1Runtime(rt);
      }
    }

    if (plan.kind === 'pass.crepuscular-rays.v1') {
      let rt: CrepuscularRaysV1Runtime | null = null;
      try {
        const wgslErr = await validateCrepuscularRaysV1ShaderModules(device, plan);
        if (wgslErr) {
          return { ok: false, reason: 'wgsl.compile', compilation, error: new Error(wgslErr) };
        }

        device.pushErrorScope('validation');
        const colorFormat = selectWebGpuRgbaExportFormat();
        rt = createCrepuscularRaysV1Runtime(device, plan, compilation.paramLayout, colorFormat);
        const validationErr = await device.popErrorScope();
        if (validationErr) {
          destroyCrepuscularRaysV1Runtime(rt);
          rt = null;
          return {
            ok: false,
            reason: 'webgpu.validation',
            compilation,
            error: new Error(validationErr.message ?? String(validationErr)),
          };
        }

        transferParametersFromGraph(graph, compilation, rt.paramsData);
        if (opts.uniformUpdates) {
          for (const u of opts.uniformUpdates) {
            setParamSlot(rt.paramsData, compilation.paramLayout, u.nodeId, u.paramName, u.value);
          }
        }
        rt.paramsDirty = true;
        rt.time = opts.timeSeconds;
        rt.timelineTime = opts.timelineTimeSeconds;

        const target = device.createTexture({
          size: { width, height },
          format: colorFormat,
          usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
        });

        let readback: GPUBuffer | null = null;
        try {
          encodeCrepuscularRaysV1Frame(device, device.queue, rt, width, height, target.createView());

          const bytesPerRow = alignTo(width * 4, 256);
          readback = device.createBuffer({
            size: bytesPerRow * height,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
          });

          const copyEnc = device.createCommandEncoder();
          copyEnc.copyTextureToBuffer(
            { texture: target },
            { buffer: readback, bytesPerRow, rowsPerImage: height },
            { width, height }
          );
          device.queue.submit([copyEnc.finish()]);
          await device.queue.onSubmittedWorkDone();

          await readback.mapAsync(GPUMapMode.READ);
          const mapped = new Uint8Array(readback.getMappedRange());
          const tight = packRgbaTightFromPaddedRows(width, height, mapped, bytesPerRow);
          readback.unmap();

          return { ok: true, rgba8: tight, compilation };
        } finally {
          try {
            target.destroy();
          } catch {
            // ignore
          }
          if (readback) {
            try {
              readback.destroy();
            } catch {
              // ignore
            }
          }
        }
      } catch (e) {
        const err = e instanceof Error ? e : new Error('WebGPU export render failed', { cause: e });
        return { ok: false, reason: 'render.failed', compilation, error: err };
      } finally {
        destroyCrepuscularRaysV1Runtime(rt);
      }
    }

    if (plan.kind === 'pass.glow-bloom.v1') {
      let rt: GlowBloomV1Runtime | null = null;
      try {
        const wgslErr = await validateGlowBloomV1ShaderModules(device, plan);
        if (wgslErr) {
          return { ok: false, reason: 'wgsl.compile', compilation, error: new Error(wgslErr) };
        }

        device.pushErrorScope('validation');
        const colorFormat = selectWebGpuRgbaExportFormat();
        rt = createGlowBloomV1Runtime(device, plan, compilation.paramLayout, colorFormat);
        const validationErr = await device.popErrorScope();
        if (validationErr) {
          destroyGlowBloomV1Runtime(rt);
          rt = null;
          return {
            ok: false,
            reason: 'webgpu.validation',
            compilation,
            error: new Error(validationErr.message ?? String(validationErr)),
          };
        }

        transferParametersFromGraph(graph, compilation, rt.paramsData);
        if (opts.uniformUpdates) {
          for (const u of opts.uniformUpdates) {
            setParamSlot(rt.paramsData, compilation.paramLayout, u.nodeId, u.paramName, u.value);
          }
        }
        rt.paramsDirty = true;
        rt.time = opts.timeSeconds;
        rt.timelineTime = opts.timelineTimeSeconds;

        const target = device.createTexture({
          size: { width, height },
          format: colorFormat,
          usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
        });

        let readback: GPUBuffer | null = null;
        try {
          encodeGlowBloomV1Frame(device, device.queue, rt, width, height, target.createView());

          const bytesPerRow = alignTo(width * 4, 256);
          readback = device.createBuffer({
            size: bytesPerRow * height,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
          });

          const copyEnc = device.createCommandEncoder();
          copyEnc.copyTextureToBuffer(
            { texture: target },
            { buffer: readback, bytesPerRow, rowsPerImage: height },
            { width, height }
          );
          device.queue.submit([copyEnc.finish()]);
          await device.queue.onSubmittedWorkDone();

          await readback.mapAsync(GPUMapMode.READ);
          const mapped = new Uint8Array(readback.getMappedRange());
          const tight = packRgbaTightFromPaddedRows(width, height, mapped, bytesPerRow);
          readback.unmap();

          return { ok: true, rgba8: tight, compilation };
        } finally {
          try {
            target.destroy();
          } catch {
            // ignore
          }
          if (readback) {
            try {
              readback.destroy();
            } catch {
              // ignore
            }
          }
        }
      } catch (e) {
        const err = e instanceof Error ? e : new Error('WebGPU export render failed', { cause: e });
        return { ok: false, reason: 'render.failed', compilation, error: err };
      } finally {
        destroyGlowBloomV1Runtime(rt);
      }
    }

    if (plan.kind === 'pass.bokeh.v1') {
      let rt: BokehV1Runtime | null = null;
      try {
        const wgslErr = await validateBokehV1ShaderModules(device, plan);
        if (wgslErr) {
          return { ok: false, reason: 'wgsl.compile', compilation, error: new Error(wgslErr) };
        }

        device.pushErrorScope('validation');
        const colorFormat = selectWebGpuRgbaExportFormat();
        rt = createBokehV1Runtime(device, plan, compilation.paramLayout, colorFormat);
        const validationErr = await device.popErrorScope();
        if (validationErr) {
          destroyBokehV1Runtime(rt);
          rt = null;
          return {
            ok: false,
            reason: 'webgpu.validation',
            compilation,
            error: new Error(validationErr.message ?? String(validationErr)),
          };
        }

        transferParametersFromGraph(graph, compilation, rt.paramsData);
        if (opts.uniformUpdates) {
          for (const u of opts.uniformUpdates) {
            setParamSlot(rt.paramsData, compilation.paramLayout, u.nodeId, u.paramName, u.value);
          }
        }
        rt.paramsDirty = true;
        rt.time = opts.timeSeconds;
        rt.timelineTime = opts.timelineTimeSeconds;

        const target = device.createTexture({
          size: { width, height },
          format: colorFormat,
          usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
        });

        let readback: GPUBuffer | null = null;
        try {
          encodeBokehV1Frame(device, device.queue, rt, width, height, target.createView());

          const bytesPerRow = alignTo(width * 4, 256);
          readback = device.createBuffer({
            size: bytesPerRow * height,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
          });

          const copyEnc = device.createCommandEncoder();
          copyEnc.copyTextureToBuffer(
            { texture: target },
            { buffer: readback, bytesPerRow, rowsPerImage: height },
            { width, height }
          );
          device.queue.submit([copyEnc.finish()]);
          await device.queue.onSubmittedWorkDone();

          await readback.mapAsync(GPUMapMode.READ);
          const mapped = new Uint8Array(readback.getMappedRange());
          const tight = packRgbaTightFromPaddedRows(width, height, mapped, bytesPerRow);
          readback.unmap();

          return { ok: true, rgba8: tight, compilation };
        } finally {
          try {
            target.destroy();
          } catch {
            // ignore
          }
          if (readback) {
            try {
              readback.destroy();
            } catch {
              // ignore
            }
          }
        }
      } catch (e) {
        const err = e instanceof Error ? e : new Error('WebGPU export render failed', { cause: e });
        return { ok: false, reason: 'render.failed', compilation, error: err };
      } finally {
        destroyBokehV1Runtime(rt);
      }
    }

    /** Known pass-plan kinds are handled above; surface unexpected kinds for callers that can fall back. */
    const fallbackKind = (plan as unknown as { kind: string }).kind;
    return {
      ok: false,
      reason: `compile.passplan.unsupported.${fallbackKind}`,
      compilation,
    };
  }

  try {
    // Surface validation issues (invalid WGSL, layout mismatches, etc.) as explicit errors.
    device.pushErrorScope('validation');
    const module = device.createShaderModule({ code: compilation.code });
    if (typeof module.getCompilationInfo === 'function') {
      const info = await module.getCompilationInfo();
      const errs = info.messages.filter((m) => m.type === 'error');
      if (errs.length > 0) {
        device.popErrorScope().catch(() => null);
        const msg = errs
          .slice(0, 8)
          .map((m) => `[wgsl:${m.lineNum}:${m.linePos}] ${m.message}`.trim())
          .join('; ');
        return { ok: false, reason: 'wgsl.compile', compilation, error: new Error(msg) };
      }
    }

    const globalsBuffer = device.createBuffer({
      size: 8 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const slotCount = computeParamSlotCount(compilation.paramLayout);
    const paramsData = new Float32Array(slotCount * 4);
    transferParametersFromGraph(graph, compilation, paramsData);
    if (opts.uniformUpdates) {
      for (const u of opts.uniformUpdates) {
        setParamSlot(paramsData, compilation.paramLayout, u.nodeId, u.paramName, u.value);
      }
    }
    const paramsBuffer = device.createBuffer({
      size: paramsData.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    const bindGroupLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'read-only-storage' } },
      ],
    });

    const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] });
    const colorFormat = selectWebGpuRgbaExportFormat();
    const pipeline = device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: { module, entryPoint: 'vs' },
      fragment: { module, entryPoint: 'fs', targets: [{ format: colorFormat }] },
      primitive: { topology: 'triangle-list' },
    });
    const validationErr = await device.popErrorScope();
    if (validationErr) {
      return {
        ok: false,
        reason: 'webgpu.validation',
        compilation,
        error: new Error(validationErr.message ?? String(validationErr))
      };
    }

    const bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: globalsBuffer } },
        { binding: 1, resource: { buffer: paramsBuffer } },
      ],
    });

    const target = device.createTexture({
      size: { width, height },
      format: colorFormat,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
    });

    // globals.v0 = (time, timelineTime, res.x, res.y); v1 reserved (flags).
    const globalsData = new Float32Array(8);
    globalsData[0] = opts.timeSeconds;
    globalsData[1] = opts.timelineTimeSeconds;
    globalsData[2] = width;
    globalsData[3] = height;
    globalsData[4] = 0;
    globalsData[5] = 0;
    globalsData[6] = 0;
    globalsData[7] = 0;

    device.queue.writeBuffer(
      globalsBuffer,
      0,
      globalsData.buffer as ArrayBuffer,
      globalsData.byteOffset,
      globalsData.byteLength
    );
    device.queue.writeBuffer(
      paramsBuffer,
      0,
      paramsData.buffer as ArrayBuffer,
      paramsData.byteOffset,
      paramsData.byteLength
    );

    const bytesPerRow = alignTo(width * 4, 256);
    const readback = device.createBuffer({
      size: bytesPerRow * height,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: target.createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });
    pass.setViewport(0, 0, width, height, 0, 1);
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.draw(3, 1, 0, 0);
    pass.end();

    encoder.copyTextureToBuffer(
      { texture: target },
      { buffer: readback, bytesPerRow, rowsPerImage: height },
      { width, height }
    );

    device.queue.submit([encoder.finish()]);
    await device.queue.onSubmittedWorkDone();

    await readback.mapAsync(GPUMapMode.READ);
    const mapped = new Uint8Array(readback.getMappedRange());
    const tight = packRgbaTightFromPaddedRows(width, height, mapped, bytesPerRow);
    readback.unmap();

    return { ok: true, rgba8: tight, compilation };
  } catch (e) {
    const err = e instanceof Error ? e : new Error('WebGPU export render failed', { cause: e });
    return { ok: false, reason: 'render.failed', compilation, error: err };
  }
}

