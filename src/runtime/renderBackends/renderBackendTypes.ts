export type RenderBackendMode = 'auto' | 'webgpu' | 'webgl';

export type RenderBackendSelected = 'webgl2' | 'webgpu';

export type RenderBackendSelection = {
  mode: RenderBackendMode;
  selected: RenderBackendSelected;
  reason: string;
};

