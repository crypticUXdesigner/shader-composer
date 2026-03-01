/**
 * Node component types - Canvas DOM Migration WP 14A
 */

/** Port position for connection layer alignment */
export interface PortPosition {
  x: number;
  y: number;
  isOutput: boolean;
}

/** Minimal metrics for DOM node layout (matches NodeRenderMetrics shape) */
export interface DomNodeMetrics {
  width: number;
  height: number;
  headerHeight: number;
  /** Input port positions (canvas coords); key: input:portName */
  inputPortPositions?: Map<string, PortPosition>;
  /** Output port positions (canvas coords) for connection layer; key: output:portName */
  outputPortPositions?: Map<string, PortPosition>;
}
