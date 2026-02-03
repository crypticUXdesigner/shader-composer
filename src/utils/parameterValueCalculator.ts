/**
 * Utility to compute effective parameter values when inputs are connected,
 * and to snap values to parameter constraints (min/max/step/int).
 */

import type { NodeGraph, NodeInstance, Connection } from '../types/nodeGraph';
import type { NodeSpec, ParameterSpec } from '../types/nodeSpec';
import type { IAudioManager } from '../runtime/types';

/**
 * Snap a raw number to the parameter's constraints so that dragging/typing
 * can hit discrete values. Without this, only min/max are enforced and
 * paramSpec.step / type 'int' are ignored, making some values unreachable.
 *
 * - Clamps to [min, max]
 * - If step is defined: snaps to nearest step (min + k*step)
 * - If type is 'int' and no step: rounds to integer
 */
export function snapParameterValue(value: number, paramSpec: ParameterSpec): number {
  const min = paramSpec.min ?? 0;
  const max = paramSpec.max ?? 1;
  let v = Math.max(min, Math.min(max, value));

  if (typeof paramSpec.step === 'number' && paramSpec.step > 0) {
    const step = paramSpec.step;
    v = min + Math.round((v - min) / step) * step;
    v = Math.max(min, Math.min(max, v));
  } else if (paramSpec.type === 'int') {
    v = Math.round(v);
    v = Math.max(min, Math.min(max, v));
  }

  return v;
}

export type ParameterInputMode = 'override' | 'add' | 'subtract' | 'multiply';

/**
 * Compute the effective value of a parameter when it has an input connection
 */
export function computeEffectiveParameterValue(
  node: NodeInstance,
  paramName: string,
  paramSpec: ParameterSpec,
  graph: NodeGraph,
  nodeSpecs: Map<string, NodeSpec>,
  audioManager?: IAudioManager
): number | null {
  // Find connection that targets this parameter
  const connection = graph.connections.find(
    conn => conn.targetNodeId === node.id && conn.targetParameter === paramName
  );
  
  if (!connection) {
    // No input connection - return null to indicate static config value
    return null;
  }
  
  // Get input mode
  const inputMode: ParameterInputMode = 
    node.parameterInputModes?.[paramName] || 
    paramSpec.inputMode || 
    'override';
  
  // Get config value
  const configValue = node.parameters[paramName];
  const configNum: number = typeof configValue === 'number' ? configValue : (typeof paramSpec.default === 'number' ? paramSpec.default : 0);
  
  // Get input value from source node
  const inputValue = getInputValue(
    connection,
    graph,
    nodeSpecs,
    audioManager
  );
  
  if (inputValue === null) {
    // Can't compute input value - return null to show static config value
    return null;
  }
  
  // Apply input mode
  switch (inputMode) {
    case 'override':
      return inputValue;
    case 'add':
      return configNum + inputValue;
    case 'subtract':
      return configNum - inputValue;
    case 'multiply':
      return configNum * inputValue;
    default:
      return inputValue;
  }
}

/** Max depth when following input chains (e.g. one-minus -> audio-analyzer) to avoid infinite recursion */
const MAX_INPUT_CHAIN_DEPTH = 8;

/**
 * Get the value at a node's input port by following the connection and resolving the source.
 * When the port has no connection but has a fallbackParameter, returns that parameter's value
 * so the UI can show live values (e.g. Multiply's B slider when unconnected).
 */
function getNodeInputPortValue(
  nodeId: string,
  portName: string,
  graph: NodeGraph,
  nodeSpecs: Map<string, NodeSpec>,
  audioManager?: IAudioManager,
  depth: number = 0
): number | null {
  const conn = graph.connections.find(
    c => c.targetNodeId === nodeId && c.targetPort === portName
  );
  if (!conn) {
    const node = graph.nodes.find(n => n.id === nodeId);
    if (!node) return null;
    const spec = nodeSpecs.get(node.type);
    if (!spec?.inputs) return null;
    const inputSpec = spec.inputs.find(i => i.name === portName);
    if (!inputSpec?.fallbackParameter) return null;
    const paramNames = inputSpec.fallbackParameter.split(',').map(s => s.trim()).filter(Boolean);
    if (paramNames.length !== 1) return null;
    const paramName = paramNames[0];
    const paramSpec = spec.parameters[paramName];
    if (!paramSpec) return null;
    const v = node.parameters[paramName];
    if (typeof v === 'number' && isFinite(v)) return v;
    if (typeof paramSpec.default === 'number') return paramSpec.default;
    return paramSpec.type === 'int' ? 0 : 0.0;
  }
  return getInputValue(conn, graph, nodeSpecs, audioManager, depth);
}

/**
 * Get the current value from an input connection
 */
function getInputValue(
  connection: Connection,
  graph: NodeGraph,
  nodeSpecs: Map<string, NodeSpec>,
  audioManager?: IAudioManager,
  depth: number = 0
): number | null {
  if (depth > MAX_INPUT_CHAIN_DEPTH) return null;

  const sourceNode = graph.nodes.find(n => n.id === connection.sourceNodeId);
  if (!sourceNode) return null;
  
  const sourceSpec = nodeSpecs.get(sourceNode.type);
  if (!sourceSpec) return null;

  // --- Input / constant nodes (no inputs to follow) ---
  if (sourceNode.type === 'constant-float') {
    if (connection.sourcePort !== 'out') return null;
    const v = sourceNode.parameters['value'];
    return typeof v === 'number' && !isNaN(v) ? v : 0;
  }
  if (sourceNode.type === 'time') {
    if (connection.sourcePort !== 'out') return null;
    return performance.now() / 1000;
  }

  // Handle one-minus: follow input and return 1.0 - value (so UI shows live value)
  if (sourceNode.type === 'one-minus') {
    const inConn = graph.connections.find(
      c => c.targetNodeId === sourceNode.id && c.targetPort === 'in'
    );
    if (!inConn) return null;
    const inValue = getInputValue(inConn, graph, nodeSpecs, audioManager, depth + 1);
    if (inValue === null) return null;
    return 1.0 - inValue;
  }

  // Handle negate: follow input and return -value
  if (sourceNode.type === 'negate') {
    const inConn = graph.connections.find(
      c => c.targetNodeId === sourceNode.id && c.targetPort === 'in'
    );
    if (!inConn) return null;
    const inValue = getInputValue(inConn, graph, nodeSpecs, audioManager, depth + 1);
    if (inValue === null) return null;
    return -inValue;
  }

  // Handle audio-analyzer nodes - get current band values
  if (sourceNode.type === 'audio-analyzer') {
    // If no audio manager, return null (can't compute value)
    if (!audioManager) {
      return null;
    }
    
    // Try to get analyzer state - if audio hasn't loaded yet, this will be undefined
    const analyzerState = audioManager.getAnalyzerNodeState(sourceNode.id);
    
    // If analyzer state doesn't exist (audio not loaded yet), return null gracefully
    if (!analyzerState) {
      return null; // Audio not loaded yet - this is OK, UI should handle null values
    }
    
    // Check if smoothedBandValues exists and is valid
    if (!analyzerState.smoothedBandValues || analyzerState.smoothedBandValues.length === 0) {
      return null; // No band values available yet
    }
    
    // Port name: "band" / "remap" (single-band) or band0..bandN / remap0..remapN (legacy)
    const isBandPort = connection.sourcePort === 'band' || /^band(\d+)$/.test(connection.sourcePort);
    const isRemapPort = connection.sourcePort === 'remap' || /^remap(\d+)$/.test(connection.sourcePort);
    if (!isBandPort && !isRemapPort) return null;

    const bandMatch = connection.sourcePort.match(/^band(\d+)$/);
    const remapMatch = connection.sourcePort.match(/^remap(\d+)$/);
    const bandIndex = connection.sourcePort === 'band' || connection.sourcePort === 'remap'
      ? 0
      : parseInt((bandMatch ?? remapMatch)![1], 10);
    if (bandIndex < 0 || bandIndex >= analyzerState.smoothedBandValues.length) return null;

    const bandValue = analyzerState.smoothedBandValues[bandIndex];
    if (typeof bandValue !== 'number' || isNaN(bandValue)) return null;

    if (connection.sourcePort === 'band' || bandMatch) return bandValue;

    // remap or remap{N}: apply per-band remap
    const inMin = getBandRemapParam(sourceNode, bandIndex, 'InMin', 0);
    const inMax = getBandRemapParam(sourceNode, bandIndex, 'InMax', 1);
    const outMin = getBandRemapParam(sourceNode, bandIndex, 'OutMin', 0);
    const outMax = getBandRemapParam(sourceNode, bandIndex, 'OutMax', 1);
    const range = inMax - inMin;
    const normalized = range !== 0 ? (bandValue - inMin) / range : 0;
    const clamped = Math.max(0, Math.min(1, normalized));
    return outMin + clamped * (outMax - outMin);
  }

  // Handle audio-remap nodes - compute remapped value
  if (sourceNode.type === 'audio-remap') {
    // Get the input audio value
    const audioInputConn = graph.connections.find(
      c => c.targetNodeId === sourceNode.id && c.targetPort === 'audioValue'
    );
    
    // If no audio connection or no audio manager, return null (can't compute value)
    if (!audioInputConn || !audioManager) {
      return null;
    }
    
    const audioInputNode = graph.nodes.find(n => n.id === audioInputConn.sourceNodeId);
    
    // If audio input node doesn't exist or isn't an analyzer, return null
    if (!audioInputNode || audioInputNode.type !== 'audio-analyzer') {
      return null;
    }
    
    // Try to get analyzer state - if audio hasn't loaded yet, this will be undefined
    const analyzerState = audioManager.getAnalyzerNodeState(audioInputNode.id);
    
    // If analyzer state doesn't exist (audio not loaded yet), return null gracefully
    if (!analyzerState) {
      return null; // Audio not loaded yet - this is OK, UI should handle null values
    }
    
    // Check if smoothedBandValues exists and is valid
    if (!analyzerState.smoothedBandValues || analyzerState.smoothedBandValues.length === 0) {
      return null; // No band values available yet
    }
    
    // Single-band analyzer uses "band"; legacy uses band0, band1, ...
    const bandMatch = audioInputConn.sourcePort.match(/^band(\d+)$/);
    const bandIndex = audioInputConn.sourcePort === 'band' ? 0 : (bandMatch ? parseInt(bandMatch[1], 10) : -1);
    if (bandIndex < 0 || bandIndex >= analyzerState.smoothedBandValues.length) {
      return null; // Invalid port or band index out of range
    }
    
    // Get audio value - now we know it's safe to access
    const audioValue = analyzerState.smoothedBandValues[bandIndex];
    
    // Validate audio value is a number
    if (typeof audioValue !== 'number' || isNaN(audioValue)) {
      return null; // Invalid audio value
    }
    
    // Apply remap: remap from [inMin, inMax] to [outMin, outMax]
    const inMin = typeof sourceNode.parameters.inMin === 'number' ? sourceNode.parameters.inMin : 0;
    const inMax = typeof sourceNode.parameters.inMax === 'number' ? sourceNode.parameters.inMax : 1;
    const outMin = typeof sourceNode.parameters.outMin === 'number' ? sourceNode.parameters.outMin : 0;
    const outMax = typeof sourceNode.parameters.outMax === 'number' ? sourceNode.parameters.outMax : 1;
    const clamp = typeof sourceNode.parameters.clamp === 'number' ? Math.round(sourceNode.parameters.clamp) : 1;
    
    // Normalize to [0, 1] range
    const range = inMax - inMin;
    const normalized = range !== 0 ? (audioValue - inMin) / range : 0;
    
    // Clamp if enabled
    const clamped = clamp ? Math.max(0, Math.min(1, normalized)) : normalized;
    
    // Remap to output range
    const outRange = outMax - outMin;
    return outMin + clamped * outRange;
  }

  // --- Math nodes (float-in float-out): resolve inputs and apply operation ---
  const sid = sourceNode.id;
  const d = depth + 1;
  const g = graph;
  const specs = nodeSpecs;
  const audio = audioManager;

  const getA = () => getNodeInputPortValue(sid, 'a', g, specs, audio, d);
  const getB = () => getNodeInputPortValue(sid, 'b', g, specs, audio, d);
  const getIn = () => getNodeInputPortValue(sid, 'in', g, specs, audio, d);
  const getBase = () => getNodeInputPortValue(sid, 'base', g, specs, audio, d);
  const getExp = () => getNodeInputPortValue(sid, 'exponent', g, specs, audio, d);
  const getMin = () => getNodeInputPortValue(sid, 'min', g, specs, audio, d);
  const getMax = () => getNodeInputPortValue(sid, 'max', g, specs, audio, d);
  const getT = () => getNodeInputPortValue(sid, 't', g, specs, audio, d);
  const getEdge = () => getNodeInputPortValue(sid, 'edge', g, specs, audio, d);
  const getEdge0 = () => getNodeInputPortValue(sid, 'edge0', g, specs, audio, d);
  const getEdge1 = () => getNodeInputPortValue(sid, 'edge1', g, specs, audio, d);
  const getX = () => getNodeInputPortValue(sid, 'x', g, specs, audio, d);
  const getY = () => getNodeInputPortValue(sid, 'y', g, specs, audio, d);
  const getBg = () => getNodeInputPortValue(sid, 'bg', g, specs, audio, d);
  const getMask = () => getNodeInputPortValue(sid, 'mask', g, specs, audio, d);
  const getFg = () => getNodeInputPortValue(sid, 'fg', g, specs, audio, d);

  if (sourceNode.type === 'add') {
    const a = getA(), b = getB();
    if (a === null || b === null) return null;
    return a + b;
  }
  if (sourceNode.type === 'subtract') {
    const a = getA(), b = getB();
    if (a === null || b === null) return null;
    return a - b;
  }
  if (sourceNode.type === 'multiply') {
    const a = getA(), b = getB();
    if (a === null || b === null) return null;
    return a * b;
  }
  if (sourceNode.type === 'divide') {
    const a = getA(), b = getB();
    if (a === null || b === null || b === 0) return null;
    return a / b;
  }
  if (sourceNode.type === 'power') {
    const base = getBase(), exp = getExp();
    if (base === null || exp === null) return null;
    return Math.pow(base, exp);
  }
  if (sourceNode.type === 'square-root') {
    const x = getIn();
    if (x === null || x < 0) return null;
    return Math.sqrt(x);
  }
  if (sourceNode.type === 'absolute') {
    const x = getIn();
    if (x === null) return null;
    return Math.abs(x);
  }
  if (sourceNode.type === 'floor') {
    const x = getIn();
    if (x === null) return null;
    return Math.floor(x);
  }
  if (sourceNode.type === 'ceil') {
    const x = getIn();
    if (x === null) return null;
    return Math.ceil(x);
  }
  if (sourceNode.type === 'fract') {
    const x = getIn();
    if (x === null) return null;
    return x - Math.floor(x);
  }
  if (sourceNode.type === 'modulo') {
    const a = getA(), b = getB();
    if (a === null || b === null || b === 0) return null;
    return ((a % b) + b) % b;
  }
  if (sourceNode.type === 'min') {
    const a = getA(), b = getB();
    if (a === null || b === null) return null;
    return Math.min(a, b);
  }
  if (sourceNode.type === 'max') {
    const a = getA(), b = getB();
    if (a === null || b === null) return null;
    return Math.max(a, b);
  }
  if (sourceNode.type === 'clamp') {
    const x = getIn(), mn = getMin(), mx = getMax();
    if (x === null || mn === null || mx === null) return null;
    return Math.max(mn, Math.min(mx, x));
  }
  if (sourceNode.type === 'mix') {
    const a = getA(), b = getB(), t = getT();
    if (a === null || b === null || t === null) return null;
    return a + t * (b - a);
  }
  if (sourceNode.type === 'mask-composite-float') {
    const bg = getBg(), mask = getMask(), fg = getFg();
    if (bg === null || mask === null || fg === null) return null;
    return bg + mask * (fg - bg);
  }
  if (sourceNode.type === 'step') {
    const edge = getEdge(), x = getX();
    if (edge === null || x === null) return null;
    return x < edge ? 0 : 1;
  }
  if (sourceNode.type === 'smoothstep') {
    const edge0 = getEdge0(), edge1 = getEdge1(), x = getX();
    if (edge0 === null || edge1 === null || x === null) return null;
    const t = edge0 !== edge1 ? Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0))) : (x >= edge1 ? 1 : 0);
    return t * t * (3 - 2 * t);
  }
  if (sourceNode.type === 'sine') {
    const x = getIn();
    if (x === null) return null;
    return Math.sin(x);
  }
  if (sourceNode.type === 'cosine') {
    const x = getIn();
    if (x === null) return null;
    return Math.cos(x);
  }
  if (sourceNode.type === 'tangent') {
    const x = getIn();
    if (x === null) return null;
    return Math.tan(x);
  }
  if (sourceNode.type === 'arc-sine') {
    const x = getIn();
    if (x === null || x < -1 || x > 1) return null;
    return Math.asin(x);
  }
  if (sourceNode.type === 'arc-cosine') {
    const x = getIn();
    if (x === null || x < -1 || x > 1) return null;
    return Math.acos(x);
  }
  if (sourceNode.type === 'arc-tangent') {
    const x = getIn();
    if (x === null) return null;
    return Math.atan(x);
  }
  if (sourceNode.type === 'arc-tangent-2') {
    const y = getY(), x = getX();
    if (y === null || x === null) return null;
    return Math.atan2(y, x);
  }
  if (sourceNode.type === 'exponential') {
    const x = getIn();
    if (x === null) return null;
    return Math.exp(x);
  }
  if (sourceNode.type === 'natural-logarithm') {
    const x = getIn();
    if (x === null || x <= 0) return null;
    return Math.log(x);
  }

  // --- Utility nodes (float-in float-out) ---
  if (sourceNode.type === 'reciprocal') {
    const x = getIn();
    if (x === null || x === 0) return null;
    return 1 / x;
  }
  if (sourceNode.type === 'remap') {
    const x = getNodeInputPortValue(sid, 'in', g, specs, audio, d);
    if (x === null) return null;
    const inMin = getNodeInputPortValue(sid, 'inMin', g, specs, audio, d) ?? (typeof sourceNode.parameters.inMin === 'number' ? sourceNode.parameters.inMin : 0);
    const inMax = getNodeInputPortValue(sid, 'inMax', g, specs, audio, d) ?? (typeof sourceNode.parameters.inMax === 'number' ? sourceNode.parameters.inMax : 1);
    const outMin = getNodeInputPortValue(sid, 'outMin', g, specs, audio, d) ?? (typeof sourceNode.parameters.outMin === 'number' ? sourceNode.parameters.outMin : 0);
    const outMax = getNodeInputPortValue(sid, 'outMax', g, specs, audio, d) ?? (typeof sourceNode.parameters.outMax === 'number' ? sourceNode.parameters.outMax : 1);
    const range = inMax - inMin;
    const t = range !== 0 ? (x - inMin) / range : 0;
    return outMin + t * (outMax - outMin);
  }
  if (sourceNode.type === 'clamp-01' || sourceNode.type === 'saturate') {
    const x = getIn();
    if (x === null) return null;
    return Math.max(0, Math.min(1, x));
  }
  if (sourceNode.type === 'sign') {
    const x = getIn();
    if (x === null) return null;
    return x < 0 ? -1 : x > 0 ? 1 : 0;
  }
  
  // For other node types, we can't easily compute the value at runtime
  // Return null to indicate we can't compute it
  return null;
}

/**
 * Get live incoming (audioValue) and outgoing (remapped) values for an audio-remap node.
 * Used to draw needle markers on the remap range UI.
 */
export function getAudioRemapLiveValues(
  node: NodeInstance,
  graph: NodeGraph,
  _nodeSpecs: Map<string, NodeSpec>,
  audioManager?: IAudioManager
): { incoming: number | null; outgoing: number | null } {
  if (node.type !== 'audio-remap') {
    return { incoming: null, outgoing: null };
  }

  const audioInputConn = graph.connections.find(
    (c) => c.targetNodeId === node.id && c.targetPort === 'audioValue'
  );
  if (!audioInputConn || !audioManager) {
    return { incoming: null, outgoing: null };
  }

  const audioInputNode = graph.nodes.find((n) => n.id === audioInputConn.sourceNodeId);
  if (!audioInputNode || audioInputNode.type !== 'audio-analyzer') {
    return { incoming: null, outgoing: null };
  }

  const analyzerState = audioManager.getAnalyzerNodeState(audioInputNode.id);
  if (!analyzerState?.smoothedBandValues?.length) {
    return { incoming: null, outgoing: null };
  }

  const bandMatch = audioInputConn.sourcePort.match(/^band(\d+)$/);
  const bandIndex = audioInputConn.sourcePort === 'band' ? 0 : (bandMatch ? parseInt(bandMatch[1], 10) : -1);
  if (bandIndex < 0 || bandIndex >= analyzerState.smoothedBandValues.length) {
    return { incoming: null, outgoing: null };
  }

  const audioValue = analyzerState.smoothedBandValues[bandIndex];
  if (typeof audioValue !== 'number' || isNaN(audioValue)) {
    return { incoming: null, outgoing: null };
  }

  const inMin = typeof node.parameters.inMin === 'number' ? node.parameters.inMin : 0;
  const inMax = typeof node.parameters.inMax === 'number' ? node.parameters.inMax : 1;
  const outMin = typeof node.parameters.outMin === 'number' ? node.parameters.outMin : 0;
  const outMax = typeof node.parameters.outMax === 'number' ? node.parameters.outMax : 1;
  const clamp = typeof node.parameters.clamp === 'number' ? Math.round(node.parameters.clamp) : 1;

  const range = inMax - inMin;
  const normalized = range !== 0 ? (audioValue - inMin) / range : 0;
  const clamped = clamp ? Math.max(0, Math.min(1, normalized)) : normalized;
  const outRange = outMax - outMin;
  const remapped = outMin + clamped * outRange;

  return { incoming: audioValue, outgoing: remapped };
}

function getBandRemapParam(node: NodeInstance, bandIndex: number, suffix: string, fallback: number): number {
  if (bandIndex === 0) {
    const singleKey = suffix === 'InMin' ? 'inMin' : suffix === 'InMax' ? 'inMax' : suffix === 'OutMin' ? 'outMin' : 'outMax';
    const v = (node.parameters as Record<string, unknown>)[singleKey];
    if (typeof v === 'number') return v;
  }
  const key = `band${bandIndex}Remap${suffix}`;
  const v = (node.parameters as Record<string, unknown>)[key];
  return typeof v === 'number' ? v : fallback;
}

/**
 * Get per-band live incoming (band value) and outgoing (remapped) values for an audio-analyzer node.
 * Used to draw needle markers on each band's optional remap UI.
 */
export function getAudioAnalyzerBandLiveValues(
  node: NodeInstance,
  _graph: NodeGraph,
  _nodeSpecs: Map<string, NodeSpec>,
  audioManager?: IAudioManager
): Map<number, { incoming: number | null; outgoing: number | null }> {
  const result = new Map<number, { incoming: number | null; outgoing: number | null }>();
  if (node.type !== 'audio-analyzer' || !audioManager) {
    return result;
  }

  const analyzerState = audioManager.getAnalyzerNodeState(node.id);
  if (!analyzerState?.smoothedBandValues?.length) {
    return result;
  }

  const bandCount = analyzerState.smoothedBandValues.length;
  for (let i = 0; i < bandCount; i++) {
    const incoming = analyzerState.smoothedBandValues[i];
    if (typeof incoming !== 'number' || isNaN(incoming)) {
      result.set(i, { incoming: null, outgoing: null });
      continue;
    }
    const inMin = getBandRemapParam(node, i, 'InMin', 0);
    const inMax = getBandRemapParam(node, i, 'InMax', 1);
    const outMin = getBandRemapParam(node, i, 'OutMin', 0);
    const outMax = getBandRemapParam(node, i, 'OutMax', 1);
    const range = inMax - inMin;
    const normalized = range !== 0 ? (incoming - inMin) / range : 0;
    const clamped = Math.max(0, Math.min(1, normalized));
    const outRange = outMax - outMin;
    const outgoing = outMin + clamped * outRange;
    result.set(i, { incoming, outgoing });
  }
  return result;
}

/** Input port names per node type for trackable math/utility nodes (all must be trackable). */
const TRACKABLE_NODE_INPUT_PORTS: Record<string, string[]> = {
  'add': ['a', 'b'],
  'subtract': ['a', 'b'],
  'multiply': ['a', 'b'],
  'divide': ['a', 'b'],
  'power': ['base', 'exponent'],
  'square-root': ['in'],
  'absolute': ['in'],
  'floor': ['in'],
  'ceil': ['in'],
  'fract': ['in'],
  'modulo': ['a', 'b'],
  'min': ['a', 'b'],
  'max': ['a', 'b'],
  'clamp': ['in', 'min', 'max'],
  'mix': ['a', 'b', 't'],
  'step': ['edge', 'x'],
  'smoothstep': ['edge0', 'edge1', 'x'],
  'sine': ['in'],
  'cosine': ['in'],
  'tangent': ['in'],
  'arc-sine': ['in'],
  'arc-cosine': ['in'],
  'arc-tangent': ['in'],
  'arc-tangent-2': ['y', 'x'],
  'exponential': ['in'],
  'natural-logarithm': ['in'],
  'reciprocal': ['in'],
  'remap': ['in'],  // inMin, inMax, outMin, outMax can be parameters
  'clamp-01': ['in'],
  'saturate': ['in'],
  'sign': ['in'],
  'mask-composite-float': ['bg', 'mask', 'fg'],
  'mask-composite-vec3': ['bg', 'mask', 'fg']
};

/**
 * Check if we can get a live value from the source of this connection (direct or via resolvable chain).
 */
function isConnectionTrackable(
  connection: Connection,
  graph: NodeGraph,
  depth: number,
  nodeSpecs?: Map<string, NodeSpec>
): boolean {
  if (depth > MAX_INPUT_CHAIN_DEPTH) return false;

  const sourceNode = graph.nodes.find(n => n.id === connection.sourceNodeId);
  if (!sourceNode) return false;

  // No inputs: always trackable (we can resolve the value)
  if (sourceNode.type === 'constant-float' || sourceNode.type === 'time' ||
      sourceNode.type === 'audio-analyzer' || sourceNode.type === 'audio-remap') {
    return true;
  }
  if (sourceNode.type === 'one-minus' || sourceNode.type === 'negate') {
    const inConn = graph.connections.find(
      c => c.targetNodeId === sourceNode.id && c.targetPort === 'in'
    );
    if (!inConn) return false;
    return isConnectionTrackable(inConn, graph, depth + 1, nodeSpecs);
  }
  const inputPorts = TRACKABLE_NODE_INPUT_PORTS[sourceNode.type];
  if (inputPorts && nodeSpecs) {
    for (const portName of inputPorts) {
      const inConn = graph.connections.find(
        c => c.targetNodeId === sourceNode.id && c.targetPort === portName
      );
      if (!inConn || !isConnectionTrackable(inConn, graph, depth + 1, nodeSpecs)) return false;
    }
    return true;
  }
  return false;
}

/**
 * Check if a parameter has an input connection that we can track (live value from audio, math, or constants).
 */
export function hasTrackableInput(
  node: NodeInstance,
  paramName: string,
  graph: NodeGraph,
  nodeSpecs?: Map<string, NodeSpec>
): boolean {
  const connection = graph.connections.find(
    conn => conn.targetNodeId === node.id && conn.targetParameter === paramName
  );
  if (!connection) return false;
  return isConnectionTrackable(connection, graph, 0, nodeSpecs);
}
