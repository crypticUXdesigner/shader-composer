import type { ErrorHandler } from '../../utils/errorHandling';
import { selectWebGpuPresentationFormat } from './webgpuPresentationFormat';

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

export type WebGpuContextInitResult =
  | { ok: true; context: WebGpuContext }
  | { ok: false; reason: string; error?: Error };

export class WebGpuContext {
  public readonly adapter: GPUAdapter;
  public readonly device: GPUDevice;
  public readonly canvasContext: GPUCanvasContext;

  /**
   * Presentation format + alpha mode (Task 02A):
   * - format: use `navigator.gpu.getPreferredCanvasFormat()` to align with UA/device best choice.
   * - alphaMode: `premultiplied` to match default Canvas compositing expectations.
   */
  public readonly presentationFormat: GPUTextureFormat;
  public readonly alphaMode: GPUCanvasAlphaMode = 'premultiplied';

  private readonly canvas: HTMLCanvasElement;
  private readonly errorHandler?: ErrorHandler;

  private lastConfiguredWidth = -1;
  private lastConfiguredHeight = -1;

  private constructor(args: {
    canvas: HTMLCanvasElement;
    adapter: GPUAdapter;
    device: GPUDevice;
    canvasContext: GPUCanvasContext;
    presentationFormat: GPUTextureFormat;
    errorHandler?: ErrorHandler;
  }) {
    this.canvas = args.canvas;
    this.adapter = args.adapter;
    this.device = args.device;
    this.canvasContext = args.canvasContext;
    this.presentationFormat = args.presentationFormat;
    this.errorHandler = args.errorHandler;

    // Device-lost handling (Task 02A): surface a clear error once; allow higher layers to recreate.
    void this.device.lost.then((info: GPUDeviceLostInfo) => {
      const message = `WebGPU device lost (${info.reason}). ${info.message || ''}`.trim();
      this.errorHandler?.report('runtime', 'error', message, {
        context: {
          webgpu: {
            reason: info.reason,
            message: info.message
          }
        }
      });
    });
  }

  public static async init(
    canvas: HTMLCanvasElement,
    errorHandler?: ErrorHandler
  ): Promise<WebGpuContextInitResult> {
    const gpu = getNavigatorGpu();
    if (!gpu) {
      return { ok: false, reason: 'navigator.gpu.absent' };
    }

    if (typeof gpu.requestAdapter !== 'function') {
      return { ok: false, reason: 'navigator.gpu.requestAdapter.missing' };
    }

    let adapter: GPUAdapter | null;
    try {
      adapter = await gpu.requestAdapter(requestAdapterOptions());
    } catch (e) {
      const err = e instanceof Error ? e : new Error('WebGPU requestAdapter failed', { cause: e });
      return { ok: false, reason: 'requestAdapter.failed', error: err };
    }

    if (!adapter) {
      return { ok: false, reason: 'requestAdapter.null' };
    }

    let device: GPUDevice;
    try {
      device = await adapter.requestDevice();
    } catch (e) {
      const err = e instanceof Error ? e : new Error('WebGPU requestDevice failed', { cause: e });
      return { ok: false, reason: 'requestDevice.failed', error: err };
    }

    let canvasContext: GPUCanvasContext;
    try {
      const maybe = canvas.getContext('webgpu');
      if (!maybe) {
        return { ok: false, reason: 'canvas.getContext.webgpu.null' };
      }
      canvasContext = maybe as GPUCanvasContext;
    } catch (e) {
      const err = e instanceof Error ? e : new Error('WebGPU canvas context creation failed', { cause: e });
      return { ok: false, reason: 'canvas.getContext.webgpu.failed', error: err };
    }

    const presentationFormat = selectWebGpuPresentationFormat(gpu);

    const context = new WebGpuContext({
      canvas,
      adapter,
      device,
      canvasContext,
      presentationFormat,
      errorHandler
    });
    context.configureToCanvasSize();

    return { ok: true, context };
  }

  public getDevice(): GPUDevice {
    return this.device;
  }

  public getQueue(): GPUQueue {
    return this.device.queue;
  }

  /**
   * (Task 02A) Resize/configure hook. Call when canvas size changes.
   */
  public configure(width: number, height: number): void {
    if (width <= 0 || height <= 0) return;
    if (this.lastConfiguredWidth === width && this.lastConfiguredHeight === height) return;

    this.canvasContext.configure({
      device: this.device,
      format: this.presentationFormat,
      alphaMode: this.alphaMode,
    });

    this.lastConfiguredWidth = width;
    this.lastConfiguredHeight = height;
  }

  public configureToCanvasSize(): void {
    this.configure(this.canvas.width, this.canvas.height);
  }

  public getCurrentTextureView(): GPUTextureView {
    return this.canvasContext.getCurrentTexture().createView();
  }
}

