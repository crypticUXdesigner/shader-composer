export type WebGpuTextureSize =
  | { kind: 'fixed'; width: number; height: number }
  | { kind: 'canvas' };

export type WebGpuTextureDesc = {
  size: WebGpuTextureSize;
  format: GPUTextureFormat;
  usage: GPUTextureUsageFlags;
  sampleCount?: number;
  label?: string;
};

export type WebGpuBufferDesc = {
  size: number;
  usage: GPUBufferUsageFlags;
  label?: string;
};

export function textureDescKey(desc: WebGpuTextureDesc, canvasSize: { width: number; height: number }): string {
  const w = desc.size.kind === 'canvas' ? canvasSize.width : desc.size.width;
  const h = desc.size.kind === 'canvas' ? canvasSize.height : desc.size.height;
  return [
    'tex',
    w,
    h,
    desc.format,
    desc.usage,
    desc.sampleCount ?? 1,
  ].join(':');
}

export function bufferDescKey(desc: WebGpuBufferDesc): string {
  return ['buf', desc.size, desc.usage].join(':');
}

