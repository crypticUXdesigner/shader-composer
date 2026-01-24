/**
 * Utility to compute effective parameter values when inputs are connected
 */

import type { NodeGraph, NodeInstance, Connection } from '../types/nodeGraph';
import type { NodeSpec, ParameterSpec } from '../types/nodeSpec';
import type { AudioManager } from '../runtime/AudioManager';

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
  audioManager?: AudioManager
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

/**
 * Get the current value from an input connection
 */
function getInputValue(
  connection: Connection,
  graph: NodeGraph,
  nodeSpecs: Map<string, NodeSpec>,
  audioManager?: AudioManager
): number | null {
  const sourceNode = graph.nodes.find(n => n.id === connection.sourceNodeId);
  if (!sourceNode) return null;
  
  const sourceSpec = nodeSpecs.get(sourceNode.type);
  if (!sourceSpec) return null;
  
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
    
    // Extract band index from port name (e.g., "band0" -> 0)
    const bandMatch = connection.sourcePort.match(/^band(\d+)$/);
    if (!bandMatch) {
      return null; // Invalid port name
    }
    
    const bandIndex = parseInt(bandMatch[1], 10);
    
    // Validate band index is in range
    if (bandIndex < 0 || bandIndex >= analyzerState.smoothedBandValues.length) {
      return null; // Band index out of range
    }
    
    // Get band value - now we know it's safe to access
    const bandValue = analyzerState.smoothedBandValues[bandIndex];
    
    // Validate band value is a number
    if (typeof bandValue !== 'number' || isNaN(bandValue)) {
      return null; // Invalid band value
    }
    
    return bandValue;
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
    
    const bandMatch = audioInputConn.sourcePort.match(/^band(\d+)$/);
    if (!bandMatch) {
      return null; // Invalid port name
    }
    
    const bandIndex = parseInt(bandMatch[1], 10);
    
    // Validate band index is in range
    if (bandIndex < 0 || bandIndex >= analyzerState.smoothedBandValues.length) {
      return null; // Band index out of range
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
  
  // For other node types, we can't easily compute the value at runtime
  // Return null to indicate we can't compute it
  return null;
}

/**
 * Check if a parameter has an input connection that we can track
 */
export function hasTrackableInput(
  node: NodeInstance,
  paramName: string,
  graph: NodeGraph
): boolean {
  const connection = graph.connections.find(
    conn => conn.targetNodeId === node.id && conn.targetParameter === paramName
  );
  
  if (!connection) return false;
  
  const sourceNode = graph.nodes.find(n => n.id === connection.sourceNodeId);
  if (!sourceNode) return false;
  
  // We can track audio-analyzer and audio-remap nodes
  return sourceNode.type === 'audio-analyzer' || sourceNode.type === 'audio-remap';
}
