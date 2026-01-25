// Node Specification Types
// These define the available node types and their ports/parameters

export type PortType = 'float' | 'vec2' | 'vec3' | 'vec4' | 'int' | 'bool';

export interface PortSpec {
  name: string;
  type: PortType;
  label?: string;
}

export interface NodeSpec {
  id: string;                     // Node type ID (e.g., "fbm-noise")
  displayName: string;            // Human-readable name
  description?: string;           // Node description
  category: string;               // Category (Input, Transform, Generator, etc.)
  icon?: string;                  // Optional node-specific icon identifier (overrides category icon)
  
  // Ports
  inputs: PortSpec[];            // Input ports
  outputs: PortSpec[];            // Output ports
  
  // Parameters
  parameters: Record<string, ParameterSpec>;
  parameterGroups?: ParameterGroup[];
  
  // Parameter layout (optional - defaults to auto-grid)
  parameterLayout?: ParameterLayout;
  
  // GLSL code (required for shader compilation)
  mainCode: string;               // GLSL code with placeholders ($input, $output, $param, etc.)
  functions?: string;             // Optional GLSL functions
}

export type ParameterInputMode = 'override' | 'add' | 'subtract' | 'multiply';

export interface ParameterSpec {
  type: 'float' | 'int' | 'string' | 'vec4' | 'array';
  default: ParameterValue;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  inputMode?: ParameterInputMode;  // How to combine input with config value (default: 'override')
}

export type ParameterValue = 
  | number
  | string
  | [number, number, number, number]
  | number[]
  | number[][];  // For array parameters that are arrays of arrays (e.g., frequency bands)

export interface ParameterGroup {
  id: string;
  label: string;
  parameters: string[];
  collapsible: boolean;
  defaultCollapsed: boolean;
}

// Parameter Layout System
// Defines how parameters are laid out in the node body (slot container)
export interface ParameterLayout {
  elements: LayoutElement[];  // Ordered list of elements (rendered top to bottom)
}

export type LayoutElement = 
  | AutoGridElement
  | GridElement
  | SliderUIElement
  | BezierEditorElement
  | CustomElement;

// Default: auto-generates grid from all parameters, respects parameterGroups
export interface AutoGridElement {
  type: 'auto-grid';
  // No config needed - uses all parameters automatically, respects groups
}

// Explicit grid with layout control
export interface GridElement {
  type: 'grid';
  parameters: string[];  // Which parameters to include (in order)
  layout?: {
    columns?: number | 'auto';  // 'auto' uses calculateOptimalColumns
    cellHeight?: number;  // Override default cell height
    cellMinWidth?: number;  // Override default min width
    respectMinWidth?: boolean;  // Whether to respect cellMinWidth (default: true)
  };
  parameterUI?: Record<string, ParameterUISelection>;  // Override UI per param
}

// Range editor slider (maps to inMin/inMax/outMin/outMax)
export interface SliderUIElement {
  type: 'slider-ui';
  height?: number;  // Default: range-editor-height CSS token
}

// Bezier curve editor
export interface BezierEditorElement {
  type: 'bezier-editor';
  height?: number;  // Default: bezier-editor-height CSS token
  parameters?: ['x1', 'y1', 'x2', 'y2'];  // Optional, defaults to these
}

// Custom element (for future extensibility)
export interface CustomElement {
  type: 'custom';
  elementId: string;
  config?: Record<string, any>;
}

// Parameter UI element selection
export type ParameterUISelection = 
  | 'knob'      // Default for float/int
  | 'toggle'    // For int with min=0, max=1
  | 'enum'      // For int with known enum mappings
  | 'bezier'    // For bezier curve parameters
  | 'range'     // For range editor parameters
  | 'input'     // Simple draggable input field (no knob)
  | 'custom';   // Custom renderer
