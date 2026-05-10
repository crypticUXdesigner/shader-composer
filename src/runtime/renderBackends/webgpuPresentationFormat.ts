type WebGpuHarnessGlobals = {
  __webgpuForceSrgbPresentation?: boolean;
};

function shouldForceSrgbPresentation(): boolean {
  if (typeof window === 'undefined') return false;
  return (window as unknown as WebGpuHarnessGlobals).__webgpuForceSrgbPresentation === true;
}

function srgbVariant(format: GPUTextureFormat): GPUTextureFormat {
  if (format === 'bgra8unorm') return 'bgra8unorm-srgb';
  if (format === 'rgba8unorm') return 'rgba8unorm-srgb';
  return format;
}

export function selectWebGpuPresentationFormat(gpu: GPU): GPUTextureFormat {
  const preferred = gpu.getPreferredCanvasFormat();
  return shouldForceSrgbPresentation() ? srgbVariant(preferred) : preferred;
}

export function selectWebGpuRgbaExportFormat(): GPUTextureFormat {
  return shouldForceSrgbPresentation() ? 'rgba8unorm-srgb' : 'rgba8unorm';
}
