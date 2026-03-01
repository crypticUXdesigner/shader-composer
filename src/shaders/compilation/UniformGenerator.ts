import type { NodeGraph } from '../../data-model/types';
import type { NodeSpec, ParameterValue } from '../../types/nodeSpec';
import type { UniformMetadata } from '../../types';
import type { AudioSetup } from '../../data-model/audioSetupTypes';
import { getPrimaryFileId } from '../../data-model/audioSetupTypes';
import { getVirtualNodeId } from '../../utils/virtualNodes';
import { isRuntimeOnlyParameter } from '../../utils/runtimeOnlyParams';

/**
 * Generates uniform names and metadata
 */
export class UniformGenerator {
  constructor(
    private nodeSpecs: Map<string, NodeSpec>,
    _isAudioNode: (nodeSpec: NodeSpec) => boolean,
    private getParameterDefaultValue: (paramSpec: { type: string; default?: ParameterValue }, paramName: string) => number | [number, number] | [number, number, number] | [number, number, number, number]
  ) {}

  /**
   * Sanitize uniform name according to specification
   */
  private sanitizeUniformName(nodeId: string, paramName: string): string {
    // Sanitize node ID
    let sanitizedId = nodeId.replace(/[^a-zA-Z0-9]/g, '_');
    if (/^\d/.test(sanitizedId)) {
      sanitizedId = 'n' + sanitizedId;
    }

    // Sanitize parameter name
    let sanitizedParam = paramName.replace(/[^a-zA-Z0-9]/g, '');
    sanitizedParam = sanitizedParam.charAt(0).toUpperCase() + sanitizedParam.slice(1);

    return `u${sanitizedId}${sanitizedParam}`;
  }

  /**
   * Generate uniform name mapping
   * @param audioSetup - Optional panel audio setup; adds uniforms for band/remap per band (WP 09)
   */
  generateUniformNameMapping(graph: NodeGraph, audioSetup?: AudioSetup | null): Map<string, string> {
    const uniformNames = new Map<string, string>();

    // Panel audio bands (WP 09): one analyzer per band, outputs band (raw) and remap
    // WP 11: Also map virtual node ids to uniform names for param connections
    if (audioSetup?.bands) {
      for (const band of audioSetup.bands) {
        const bandUniformName = this.sanitizeUniformName(band.id, 'band');
        const remapUniformName = this.sanitizeUniformName(band.id, 'remap');
        uniformNames.set(`${band.id}.band`, bandUniformName);
        uniformNames.set(`${band.id}.remap`, remapUniformName);
        uniformNames.set(getVirtualNodeId(`band-${band.id}-raw`), bandUniformName);
        uniformNames.set(getVirtualNodeId(`band-${band.id}-remap`), remapUniformName);
      }
    }
    // WP 11: Remapper outputs (virtual nodes remap-{id})
    if (audioSetup?.remappers) {
      for (const remapper of audioSetup.remappers) {
        const uniformName = this.sanitizeUniformName(`remap-${remapper.id}`, 'out');
        uniformNames.set(`remap-${remapper.id}.out`, uniformName);
        uniformNames.set(getVirtualNodeId(`remap-${remapper.id}`), uniformName);
      }
    }
    // WP 15B: Primary file uniforms (currentTime, duration, isPlaying) for video export
    const primaryFileId = getPrimaryFileId(audioSetup);
    if (primaryFileId) {
      for (const outputName of ['currentTime', 'duration', 'isPlaying'] as const) {
        const uniformName = this.sanitizeUniformName(primaryFileId, outputName);
        uniformNames.set(`${primaryFileId}.${outputName}`, uniformName);
      }
    }

    for (const node of graph.nodes) {
      const nodeSpec = this.nodeSpecs.get(node.type);
      if (!nodeSpec) continue;

      // Generate uniforms for all parameters in the spec (not just those in node.parameters)
      // This ensures we have uniforms for parameters that use default values
      // Skip array and string parameters - they are handled specially at compile time
      // Skip parameters that are connected to outputs - they get their value from the connection
      // Skip runtime-only parameters that are not shader uniforms
      for (const [paramName, paramSpec] of Object.entries(nodeSpec.parameters)) {
        // Skip array parameters - they can't be uniforms
        if (paramSpec.type === 'array') {
          continue;
        }
        // Skip string parameters - they are handled at compile time (e.g., swizzle node)
        if (paramSpec.type === 'string') {
          continue;
        }
        // Skip runtime-only parameters (no shader uniform)
        if (isRuntimeOnlyParameter(nodeSpec.id, paramName)) {
          continue;
        }
        const isConnected = graph.connections.some(
          conn => conn.targetNodeId === node.id && conn.targetParameter === paramName
        );
        if (isConnected) {
          const inputMode = node.parameterInputModes?.[paramName] ?? paramSpec.inputMode ?? 'override';
          if (inputMode === 'override') continue;
        }
        const uniformName = this.sanitizeUniformName(node.id, paramName);
        uniformNames.set(`${node.id}.${paramName}`, uniformName);
      }
    }

    return uniformNames;
  }

  /**
   * Find which uniforms are actually used in the shader code
   */
  findUsedUniforms(
    mainCode: string,
    functions: string,
    uniformNames: Map<string, string>
  ): Set<string> {
    const usedUniforms = new Set<string>();
    const allCode = mainCode + '\n' + functions;
    
    // Check each uniform name to see if it appears in the code
    for (const uniformName of uniformNames.values()) {
      // Check if uniform name appears in the code
      // Use indexOf for simple substring match - this is more reliable than regex for uniform names
      // Uniform names are unique identifiers, so substring match is safe
      if (allCode.includes(uniformName)) {
        usedUniforms.add(uniformName);
      }
    }
    
    // Always include global uniforms
    usedUniforms.add('uTime');
    usedUniforms.add('uResolution');
    
    return usedUniforms;
  }

  /**
   * Generate uniform metadata
   * @param audioSetup - Optional panel audio setup; adds metadata for band uniforms (WP 09)
   */
  generateUniformMetadata(
    graph: NodeGraph,
    uniformNames: Map<string, string>,
    usedUniforms: Set<string>,
    audioSetup?: AudioSetup | null
  ): UniformMetadata[] {
    const uniforms: UniformMetadata[] = [];

    // Panel audio bands (WP 09): only include band/remap uniforms when actually used in shader.
    // Unused uniforms are optimized out by the GLSL compiler, causing "location not found" warnings.
    if (audioSetup?.bands) {
      for (const band of audioSetup.bands) {
        const bandUniformName = uniformNames.get(`${band.id}.band`);
        const remapUniformName = uniformNames.get(`${band.id}.remap`);
        if (bandUniformName && usedUniforms.has(bandUniformName)) {
          uniforms.push({
            name: bandUniformName,
            nodeId: band.id,
            paramName: 'band',
            type: 'float',
            defaultValue: 0.0
          });
        }
        if (remapUniformName && usedUniforms.has(remapUniformName)) {
          uniforms.push({
            name: remapUniformName,
            nodeId: band.id,
            paramName: 'remap',
            type: 'float',
            defaultValue: 0.0
          });
        }
      }
    }
    // WP 11: Remapper output uniforms - only when used in shader
    if (audioSetup?.remappers) {
      for (const remapper of audioSetup.remappers) {
        const uniformName = uniformNames.get(`remap-${remapper.id}.out`);
        if (uniformName && usedUniforms.has(uniformName)) {
          uniforms.push({
            name: uniformName,
            nodeId: `remap-${remapper.id}`,
            paramName: 'out',
            type: 'float',
            defaultValue: 0.0
          });
        }
      }
    }
    // WP 15B: Primary file uniforms (currentTime, duration, isPlaying) for video export
    const primaryFileId = getPrimaryFileId(audioSetup);
    if (primaryFileId) {
      for (const outputName of ['currentTime', 'duration', 'isPlaying'] as const) {
        const uniformName = uniformNames.get(`${primaryFileId}.${outputName}`);
        if (uniformName) {
          uniforms.push({
            name: uniformName,
            nodeId: primaryFileId,
            paramName: outputName,
            type: 'float',
            defaultValue: outputName === 'isPlaying' ? 1 : 0.0
          });
        }
      }
    }

    for (const node of graph.nodes) {
      const nodeSpec = this.nodeSpecs.get(node.type);
      if (!nodeSpec) continue;

      // Process all parameters from the spec (not just those in node.parameters)
      // This ensures we generate uniforms for all parameters, even if they use defaults
      for (const [paramName, paramSpec] of Object.entries(nodeSpec.parameters)) {
        // Skip array parameters - they are inlined as constants
        if (paramSpec.type === 'array') {
          continue;
        }
        
        const uniformName = uniformNames.get(`${node.id}.${paramName}`);
        if (!uniformName) continue;
        
        // Only include uniforms that are actually used in the shader code
        // This prevents WebGL from optimizing them out and causing warnings
        // Exception: Audio output uniforms are always included (handled above)
        if (!usedUniforms.has(uniformName)) {
          continue;
        }

        // Determine GLSL type
        let glslType: 'float' | 'int' | 'vec2' | 'vec3' | 'vec4' = 'float';
        if (paramSpec.type === 'int') {
          glslType = 'int';
        } else if (paramSpec.type === 'vec4') {
          glslType = 'vec4';
        }

        // Get default value - prefer node's parameter value over spec default
        type UniformDefault = number | [number, number] | [number, number, number] | [number, number, number, number];
        let defaultValue: UniformDefault;
        const paramValue: ParameterValue | undefined = node.parameters[paramName];
        if (paramValue !== undefined && typeof paramValue === 'number') {
          defaultValue = paramValue;
        } else if (paramValue !== undefined && Array.isArray(paramValue) && paramValue.length >= 2 && paramValue.length <= 4) {
          defaultValue = paramValue as UniformDefault;
        } else {
          defaultValue = this.getParameterDefaultValue(paramSpec, paramName);
        }

        uniforms.push({
          name: uniformName,
          nodeId: node.id,
          paramName: paramName,
          type: glslType,
          defaultValue
        });
      }
    }

    return uniforms;
  }
}
