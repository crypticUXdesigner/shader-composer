import { ResourcePool } from './ResourcePool';
import type { WebGpuBufferDesc, WebGpuTextureDesc } from './resourceDescriptors';
import { bufferDescKey, textureDescKey } from './resourceDescriptors';

export type CanvasSizeProvider = () => { width: number; height: number };

export class WebGpuTexturePool {
  private readonly pool: ResourcePool<GPUTexture>;

  constructor(
    private readonly device: GPUDevice,
    private readonly canvasSize: CanvasSizeProvider
  ) {
    this.pool = new ResourcePool<GPUTexture>({
      create: (key) => {
        // key format: "tex:<w>:<h>:<format>:<usage>:<sampleCount>"
        const parts = key.split(':');
        if (parts.length < 6 || parts[0] !== 'tex') {
          throw new Error(`Unexpected texture key: ${key}`);
        }
        const width = Math.max(1, parseInt(parts[1] ?? '1', 10));
        const height = Math.max(1, parseInt(parts[2] ?? '1', 10));
        const format = parts[3] as GPUTextureFormat;
        const usage = Number(parts[4] ?? 0) as GPUTextureUsageFlags;
        const sampleCount = Math.max(1, parseInt(parts[5] ?? '1', 10));
        return this.device.createTexture({ size: { width, height }, format, usage, sampleCount });
      },
      destroy: (tex) => tex.destroy(),
    });
  }

  beginFrame(frameIndex: number): void {
    this.pool.beginFrame(frameIndex);
  }

  acquire(desc: WebGpuTextureDesc): GPUTexture {
    const key = textureDescKey(desc, this.canvasSize());
    return this.pool.acquire(key);
  }

  release(tex: GPUTexture): void {
    this.pool.release(tex);
  }

  retireFreeResources(maxAgeFrames: number): void {
    this.pool.retireFreeResources(maxAgeFrames);
  }

  destroyAll(): void {
    this.pool.destroyAll();
  }
}

export class WebGpuBufferPool {
  private readonly pool: ResourcePool<GPUBuffer>;

  constructor(private readonly device: GPUDevice) {
    this.pool = new ResourcePool<GPUBuffer>({
      create: (key) => {
        // key format: "buf:<size>:<usage>"
        const parts = key.split(':');
        if (parts.length < 3 || parts[0] !== 'buf') {
          throw new Error(`Unexpected buffer key: ${key}`);
        }
        const size = Math.max(1, parseInt(parts[1] ?? '1', 10));
        const usage = Number(parts[2] ?? 0) as GPUBufferUsageFlags;
        return this.device.createBuffer({ size, usage });
      },
      destroy: (buf) => buf.destroy(),
    });
  }

  beginFrame(frameIndex: number): void {
    this.pool.beginFrame(frameIndex);
  }

  acquire(desc: WebGpuBufferDesc): GPUBuffer {
    return this.pool.acquire(bufferDescKey(desc));
  }

  release(buf: GPUBuffer): void {
    this.pool.release(buf);
  }

  retireFreeResources(maxAgeFrames: number): void {
    this.pool.retireFreeResources(maxAgeFrames);
  }

  destroyAll(): void {
    this.pool.destroyAll();
  }
}

