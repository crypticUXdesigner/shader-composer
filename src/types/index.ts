import type { ParameterInputMode } from './nodeSpec';

export interface ParameterConfig {
  type: 'float' | 'int';
  default: number;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  readOnly?: boolean; // If true, parameter is read-only (auto-synced from another element)
  disabled?: boolean; // If true, parameter is disabled (unavailable in current mode)
  inputMode?: ParameterInputMode; // How to combine input with config value (default: 'override')
}

export interface ParameterGroup {
  id: string;
  label: string;
  parameters: string[];
  collapsible: boolean;
  defaultCollapsed: boolean;
}


export interface OKLCHColor {
  l: number;  // Lightness (0-1)
  c: number;  // Chroma (0-1)
  h: number;  // Hue (0-360 degrees)
}

export interface CubicBezier {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export type ColorMode = 'bezier' | 'thresholds';

export interface ColorConfig {
  mode: ColorMode;
  startColor: OKLCHColor;
  endColor: OKLCHColor;
  stops: number;
  lCurve: CubicBezier;
  cCurve: CubicBezier;
  hCurve: CubicBezier;
  transitionWidth?: number; // For threshold mode: smoothstep transition width
  ditherStrength?: number; // For threshold mode: Bayer dithering strength
  pixelSize?: number; // For threshold mode: Bayer dithering pixel size
  toneMapping?: {
    exposure?: number; // Brightness multiplier (default: 1.0)
    contrast?: number; // Contrast adjustment (default: 1.0)
    saturation?: number; // Saturation multiplier (default: 1.0)
  };
}

export interface TimelineConfig {
  value: number;
  min: number;
  max: number;
  step: number;
}

export interface ExportConfig {
  resolution: [number, number];
  format: 'png' | 'jpeg' | 'webp';
  quality?: number;
  filename?: string;
}

export interface Layer {
  id: string;
  activeElements: string[];
  elementOrder: string[];
  parameters: Record<string, number>;
  blendingMode: number;  // 0=Normal, 1=Multiply, ..., 11=Exclusion
  opacity: number;       // 0.0-1.0
  visible: boolean;
  colorConfig: ColorConfig;  // Per-layer color configuration
}

// FX layer: post-processors applied to the final composited result
export interface FXLayer {
  id: string;  // Always 'fx'
  activeElements: string[];  // Only post-processor element IDs
  elementOrder: string[];  // Order of post-processors
  parameters: Record<string, number>;  // Parameters for FX post-processors
}

export interface SavedConfig {
  version: string;
  timestamp: string;
  
  // NEW: Layer-based config (version 2.0)
  layers?: Layer[];
  fxLayer?: FXLayer;  // Post-processors applied to final composited result
  
  // LEGACY: Single-layer config (version 1.0, for backward compatibility)
  activeElements?: string[];
  elementOrder?: string[];
  parameters?: Record<string, number>;
  
  // Shared (both versions)
  colorConfig: ColorConfig;
  timelineConfig: TimelineConfig;
  exportConfig: ExportConfig;
}

// Node-based shader system types (version 2.0) — canonical source: data-model/types.ts via nodeGraph
export type {
  ParameterValue,
  NodeInstance,
  Connection,
  NodeGraph,
  SerializedNodeGraph,
} from './nodeGraph';

// Node specification types (from Node Specification)
export type { NodeSpec, PortSpec, PortType, ParameterSpec } from './nodeSpec';

// Legacy types for backward compatibility
export interface NodePort {
  name: string;
  type: 'float' | 'vec2' | 'vec3' | 'vec4' | 'int' | 'bool';
}

export interface NodeParameter {
  type: 'float' | 'int' | 'string' | 'vec4' | 'array';
  default?: number | string | [number, number, number, number] | number[];
  min?: number;
  max?: number;
  step?: number;
}

// Compilation result types (from Runtime/Integration Specification)
export interface UniformMetadata {
  name: string;  // e.g., "uNodeN1Scale"
  nodeId: string;  // e.g., "node-123"
  paramName: string;  // e.g., "scale"
  type: 'float' | 'int' | 'vec2' | 'vec3' | 'vec4';
  defaultValue: number | [number, number] | [number, number, number] | [number, number, number, number];
}

export interface CompilationResult {
  shaderCode: string;
  uniforms: UniformMetadata[];
  metadata: {
    warnings: string[];
    errors: string[];
    executionOrder: string[];  // Node IDs in execution order
    finalOutputNodeId: string | null;  // ID of final output node
  };
}

