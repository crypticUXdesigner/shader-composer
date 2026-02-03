import type { NodeGraph, NodeSpec, CompilationResult } from '../types';
import { GraphValidator } from './compilation/GraphValidator';
import { TypeValidator } from './compilation/TypeValidator';
import { GraphAnalyzer } from './compilation/GraphAnalyzer';
import { VariableNameGenerator } from './compilation/VariableNameGenerator';
import { UniformGenerator } from './compilation/UniformGenerator';
import { FunctionGenerator } from './compilation/FunctionGenerator';
import { MainCodeGenerator } from './compilation/MainCodeGenerator';

/**
 * Node-based shader compiler
 * Converts a node graph into executable GLSL shader code
 * 
 * This class orchestrates the compilation process using focused components:
 * - GraphValidator: Validates graph structure
 * - TypeValidator: Validates type compatibility
 * - GraphAnalyzer: Calculates execution order
 * - VariableNameGenerator: Generates variable names
 * - UniformGenerator: Generates uniform names and metadata
 * - FunctionGenerator: Collects and deduplicates functions
 * - MainCodeGenerator: Generates main shader code
 */
export class NodeShaderCompiler {
  // nodeSpecs is passed to components but not stored as field (components hold references)
  private graphValidator: GraphValidator;
  private typeValidator: TypeValidator;
  private graphAnalyzer: GraphAnalyzer;
  private variableNameGenerator: VariableNameGenerator;
  private uniformGenerator: UniformGenerator;
  private functionGenerator: FunctionGenerator;
  private mainCodeGenerator: MainCodeGenerator;

  constructor(nodeSpecs: Map<string, NodeSpec>) {
    // Initialize components with shared helper methods
    this.graphValidator = new GraphValidator(nodeSpecs);
    this.typeValidator = new TypeValidator(nodeSpecs);
    this.graphAnalyzer = new GraphAnalyzer();
    this.variableNameGenerator = new VariableNameGenerator(nodeSpecs);
    this.uniformGenerator = new UniformGenerator(
      nodeSpecs,
      (spec) => this.isAudioNode(spec),
      (paramSpec, paramName) => this.getParameterDefaultValue(paramSpec, paramName)
    );
    this.functionGenerator = new FunctionGenerator(
      nodeSpecs,
      (str) => this.escapeRegex(str),
      (configValue, inputValue, mode, paramType) => this.generateParameterCombination(configValue, inputValue, mode, paramType)
    );
    this.mainCodeGenerator = new MainCodeGenerator(
      nodeSpecs,
      (spec) => this.isAudioNode(spec),
      (nodeId, paramName) => this.variableNameGenerator.generateArrayVariableName(nodeId, paramName),
      (str) => this.escapeRegex(str),
      (configValue, inputValue, mode, paramType) => this.generateParameterCombination(configValue, inputValue, mode, paramType),
      (code, swizzleValue, inputVars, outputVars) => this.generateSwizzleCode(code, swizzleValue, inputVars, outputVars),
      (pattern) => this.normalizeSwizzlePattern(pattern)
    );
  }

  /**
   * Incremental compilation - only regenerate code for changed parts.
   * Uses dependency tracking to identify affected nodes and allows execution
   * order changes when they don't affect the changed nodes.
   * 
   * @param graph - Current node graph
   * @param previousResult - Previous compilation result (for reference)
   * @param affectedNodeIds - Set of node IDs that are affected (changed nodes + their dependents)
   * @returns CompilationResult or null if incremental compilation not possible
   */
  compileIncremental(
    graph: NodeGraph,
    previousResult: CompilationResult | null,
    affectedNodeIds: Set<string>
  ): CompilationResult | null {
    if (!previousResult) {
      // No previous result - must do full compilation
      return null;
    }
    
    // If too many nodes affected, fall back to full compilation
    const changeThreshold = graph.nodes.length * 0.5; // 50% threshold
    if (affectedNodeIds.size > changeThreshold) {
      return null;
    }
    
    // Phase 2: Implement incremental compilation
    // Strategy:
    // 1. Find downstream dependents of changed nodes (nodes that depend on changed nodes)
    // 2. Regenerate code only for changed nodes + their dependents
    // 3. Reuse unchanged sections where possible
    
    try {
      // Step 1: Validate graph structure (quick check)
      const errors: string[] = [];
      const warnings: string[] = [];
      this.graphValidator.validateGraph(graph, errors, warnings);
      if (errors.length > 0) {
        // Validation errors - fall back to full compilation
        return null;
      }
      
      // Step 2: Calculate execution order and check if it changed significantly
      const previousExecutionOrder = previousResult.metadata.executionOrder || [];
      let executionOrder: string[];
      try {
        executionOrder = this.graphAnalyzer.topologicalSort(graph);
        executionOrder = this.audioNodesFirst(executionOrder, graph);
      } catch (error) {
        // Circular dependency or other error - fall back to full compilation
        return null;
      }
      
      // Step 3: Use affected nodes (already calculated by GraphChangeDetector)
      // Note: affectedNodeIds already includes changed nodes + their dependents
      
      // Step 4: Check if execution order changed in a way that affects incremental compilation
      // Allow execution order changes if:
      // 1. Node count is the same (no nodes added/removed)
      // 2. Affected nodes maintain their relative order
      // 3. Unaffected nodes can move freely (they don't affect compilation)
      
      // If node count changed, fall back to full compilation
      if (executionOrder.length !== previousExecutionOrder.length) {
        return null;
      }
      
      // Check if execution order changed
      const executionOrderChanged = executionOrder.some((id, idx) => id !== previousExecutionOrder[idx]);
      
      if (executionOrderChanged) {
        // Check if affected nodes maintain their relative order
        const previousAffectedOrder = previousExecutionOrder.filter(id => affectedNodeIds.has(id));
        const currentAffectedOrder = executionOrder.filter(id => affectedNodeIds.has(id));
        
        // If affected nodes changed order, fall back to full compilation
        if (previousAffectedOrder.length !== currentAffectedOrder.length ||
            previousAffectedOrder.some((id, idx) => id !== currentAffectedOrder[idx])) {
          // Affected nodes changed order - fall back to full compilation
          return null;
        }
        
        // Execution order changed but affected nodes maintain order - safe to proceed
        // Unaffected nodes can move freely without affecting incremental compilation
      }
      
      // Step 5: Generate code incrementally
      // Note: True incremental code patching (reusing unchanged sections) is complex
      // and may not provide significant benefits due to:
      // - Variable name generation dependencies
      // - Function deduplication dependencies  
      // - Uniform name generation dependencies
      // 
      // Instead, we optimize by:
      // - Skipping validation (already done)
      // - Reusing topological sort result (already calculated)
      // - The real performance benefit comes from change detection preventing
      //   unnecessary compilations in CompilationManager
      //
      // For future optimization, we could cache code sections per node and patch them,
      // but this requires careful handling of dependencies and may not be worth the complexity.
      
      // Generate variable names
      const variableNames = this.variableNameGenerator.generateVariableNames(graph);
      
      // Generate uniform names
      const uniformNames = this.uniformGenerator.generateUniformNameMapping(graph);
      
      // Collect functions
      const { functions, functionNameMap } = this.functionGenerator.collectAndDeduplicateFunctions(graph, uniformNames, variableNames);
      
      // Generate main code
      const { variableDeclarations, mainCode } = this.mainCodeGenerator.generateMainCode(graph, executionOrder, variableNames, uniformNames, functionNameMap);
      
      // Find final output node
      const finalOutputNode = this.mainCodeGenerator.findFinalOutputNode(graph, executionOrder);
      
      // Generate final color variable
      const finalColorVar = this.mainCodeGenerator.generateFinalColorVariable(graph, finalOutputNode, variableNames);
      
      // Track which uniforms are actually used
      const usedUniforms = this.uniformGenerator.findUsedUniforms(mainCode + '\n' + variableDeclarations, functions, uniformNames);
      
      // Generate uniform metadata
      const uniforms = this.uniformGenerator.generateUniformMetadata(graph, uniformNames, usedUniforms);
      
      // Check for disconnected nodes (warnings)
      const connectedNodes = new Set<string>();
      for (const conn of graph.connections) {
        connectedNodes.add(conn.sourceNodeId);
        connectedNodes.add(conn.targetNodeId);
      }
      for (const node of graph.nodes) {
        if (!connectedNodes.has(node.id)) {
          warnings.push(`[WARNING] Node '${node.id}' (${node.type}) has no connections`);
        }
      }
      
      // Assemble shader
      const shaderCode = this.mainCodeGenerator.assembleShader(functions, uniforms, variableDeclarations, mainCode, finalColorVar);
      
      return {
        shaderCode,
        uniforms,
        metadata: {
          warnings,
          errors: [],
          executionOrder,
          finalOutputNodeId: finalOutputNode?.id || null
        }
      };
      
    } catch (error) {
      // Any error during incremental compilation - fall back to full compilation
      console.warn('[NodeShaderCompiler] Incremental compilation failed, falling back to full compilation:', error);
      return null;
    }
  }

  /**
   * Compile a node graph into GLSL shader code
   */
  compile(graph: NodeGraph): CompilationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const executionOrder: string[] = [];

    // Handle empty graph
    if (graph.nodes.length === 0) {
      const emptyShader = this.mainCodeGenerator.assembleShader(
        '',
        [],
        '',
        '',
        'vec3(0.0)'
      );
      
      return {
        shaderCode: emptyShader,
        uniforms: [],
        metadata: {
          warnings: ['[WARNING] Empty graph - outputting black'],
          errors: [],
          executionOrder: [],
          finalOutputNodeId: null
        }
      };
    }

    // Step 1: Validate graph structure
    this.graphValidator.validateGraph(graph, errors, warnings);
    if (errors.length > 0) {
      return {
        shaderCode: '',
        uniforms: [],
        metadata: {
          warnings,
          errors,
          executionOrder: [],
          finalOutputNodeId: null
        }
      };
    }

    // Step 2: Graph traversal - topological sort
    try {
      let sorted = this.graphAnalyzer.topologicalSort(graph);
      // Ensure audio nodes (audio-file-input, audio-analyzer) run first so band/output
      // variables are assigned from uniforms before any node (e.g. audio-remap, one-minus,
      // hexagon) reads them. Otherwise the chain analyzer->remap->one-minus->param shows 0.
      sorted = this.audioNodesFirst(sorted, graph);
      executionOrder.push(...sorted);
    } catch (error) {
      errors.push(`[ERROR] Circular Dependency: ${error instanceof Error ? error.message : 'Graph contains cycles'}`);
      return {
        shaderCode: '',
        uniforms: [],
        metadata: {
          warnings,
          errors,
          executionOrder: [],
          finalOutputNodeId: null
        }
      };
    }

    // Step 3: Type validation
    const typeErrors = this.typeValidator.validateTypes(graph);
    if (typeErrors.length > 0) {
      errors.push(...typeErrors);
      return {
        shaderCode: '',
        uniforms: [],
        metadata: {
          warnings,
          errors,
          executionOrder,
          finalOutputNodeId: null
        }
      };
    }

    // Step 4: Generate variable names
    const variableNames = this.variableNameGenerator.generateVariableNames(graph);

    // Step 5: Generate uniform names
    const uniformNames = this.uniformGenerator.generateUniformNameMapping(graph);

    // Step 6: Collect functions (with uniform placeholders replaced)
    const { functions, functionNameMap } = this.functionGenerator.collectAndDeduplicateFunctions(graph, uniformNames, variableNames);

    // Step 7: Generate main code (returns both variable declarations and main code)
    const { variableDeclarations, mainCode } = this.mainCodeGenerator.generateMainCode(graph, executionOrder, variableNames, uniformNames, functionNameMap);

    // Step 8: Find final output node
    const finalOutputNode = this.mainCodeGenerator.findFinalOutputNode(graph, executionOrder);

    // Step 9: Generate final color variable
    const finalColorVar = this.mainCodeGenerator.generateFinalColorVariable(graph, finalOutputNode, variableNames);

    // Step 10: Track which uniforms are actually used in the shader code
    const usedUniforms = this.uniformGenerator.findUsedUniforms(mainCode + '\n' + variableDeclarations, functions, uniformNames);

    // Step 11: Generate uniform metadata (only for used uniforms)
    const uniforms = this.uniformGenerator.generateUniformMetadata(graph, uniformNames, usedUniforms);

    // Step 12: Check for disconnected nodes (warnings)
    const connectedNodes = new Set<string>();
    for (const conn of graph.connections) {
      connectedNodes.add(conn.sourceNodeId);
      connectedNodes.add(conn.targetNodeId);
    }
    for (const node of graph.nodes) {
      if (!connectedNodes.has(node.id)) {
        warnings.push(`[WARNING] Node '${node.id}' (${node.type}) has no connections`);
      }
    }

    // Step 13: Assemble shader
    const shaderCode = this.mainCodeGenerator.assembleShader(functions, uniforms, variableDeclarations, mainCode, finalColorVar);

    return {
      shaderCode,
      uniforms,
      metadata: {
        warnings,
        errors: [],
        executionOrder,
        finalOutputNodeId: finalOutputNode?.id || null
      }
    };
  }

  // Helper methods used by components

  /**
   * Reorder execution order so audio-file-input and audio-analyzer nodes run first.
   * Their blocks assign band/output variables from uniforms; any node that reads
   * those (e.g. audio-remap, one-minus, hexagon with param connection) must run after.
   */
  private audioNodesFirst(sorted: string[], graph: NodeGraph): string[] {
    const audioProviderTypes = new Set(['audio-file-input', 'audio-analyzer']);
    const audioIds: string[] = [];
    const rest: string[] = [];
    for (const nodeId of sorted) {
      const node = graph.nodes.find(n => n.id === nodeId);
      if (node && audioProviderTypes.has(node.type)) {
        audioIds.push(nodeId);
      } else {
        rest.push(nodeId);
      }
    }
    return audioIds.length === 0 ? sorted : [...audioIds, ...rest];
  }

  /**
   * Check if a node is an audio node
   */
  private isAudioNode(nodeSpec: NodeSpec): boolean {
    return nodeSpec.category === 'Audio';
  }

  /**
   * Get default value for a parameter
   */
  private getParameterDefaultValue(
    paramSpec: { type: string; default?: any },
    _paramName: string
  ): number | [number, number] | [number, number, number] | [number, number, number, number] {
    if (paramSpec.default !== undefined) {
      if (typeof paramSpec.default === 'number') {
        return paramSpec.default;
      }
      if (Array.isArray(paramSpec.default)) {
        // Handle vec2, vec3, vec4 arrays
        if (paramSpec.default.length === 2) {
          return [paramSpec.default[0], paramSpec.default[1]] as [number, number];
        } else if (paramSpec.default.length === 3) {
          return [paramSpec.default[0], paramSpec.default[1], paramSpec.default[2]] as [number, number, number];
        } else if (paramSpec.default.length === 4) {
          return paramSpec.default as [number, number, number, number];
        }
        return paramSpec.default as any;
      }
    }

    // Type-appropriate defaults
    if (paramSpec.type === 'int') return 0;
    if (paramSpec.type === 'vec2') return [0, 0];
    if (paramSpec.type === 'vec3') return [0, 0, 0];
    if (paramSpec.type === 'vec4') return [0, 0, 0, 0];
    return 0.0;
  }

  /**
   * Generate swizzle code directly based on parameter value
   * Replaces the conditional block with direct swizzle operation
   * Note: This is called after input/output placeholders are replaced
   */
  private generateSwizzleCode(
    code: string,
    swizzleValue: string,
    inputVars: Map<string, string>,
    outputVars: Map<string, string>
  ): string {
    const inputVar = inputVars.get('in') || 'vec4(0.0)';
    const outputVar = outputVars.get('out') || 'vec4(0.0)';
    
    // Escape the output variable name for use in regex
    const escapedOutputVar = this.escapeRegex(outputVar);
    
    // Validate and normalize swizzle pattern
    const normalized = this.normalizeSwizzlePattern(swizzleValue);
    if (!normalized) {
      // Invalid pattern, use pass-through
      // Match the entire conditional block - the output var has already been replaced
      const passThroughRegex = new RegExp(`vec4\\s+v\\s*=\\s*[^;]+;[\\s\\S]*?if\\s*\\([^)]+\\)[\\s\\S]*?else\\s*\\{[\\s\\S]*?${escapedOutputVar}\\s*=\\s*v;[\\s\\S]*?\\}`);
      return code.replace(passThroughRegex, `${outputVar} = ${inputVar};`);
    }
    
    // Generate swizzle expression
    let swizzleExpr: string;
    const pattern = normalized.toLowerCase();
    
    if (pattern.length === 2) {
      // 2-component swizzle (e.g., "xy", "yx")
      swizzleExpr = `vec4(${inputVar}.${pattern}, 0.0, 1.0)`;
    } else if (pattern.length === 3) {
      // 3-component swizzle (e.g., "xyz", "zyx")
      swizzleExpr = `vec4(${inputVar}.${pattern}, 1.0)`;
    } else if (pattern.length === 4) {
      // 4-component swizzle (e.g., "xyzw", "wzyx")
      swizzleExpr = `${inputVar}.${pattern}`;
    } else {
      // Invalid length, pass through
      swizzleExpr = inputVar;
    }
    
    // Replace the entire conditional block
    // Match from "vec4 v = ..." through all the if/else if statements to the final else block
    // The output variable has already been replaced, so use the actual variable name
    // Match: vec4 v = ...; [anything] if (...) { ... } [else if (...) { ... }]* else { ... output = v; ... }
    // Use [\s\S] to match across newlines
    const swizzleBlockRegex = new RegExp(
      `vec4\\s+v\\s*=\\s*[^;]+;[\\s\\S]*?if\\s*\\([^)]+\\)[\\s\\S]*?(?:else\\s+if\\s*\\([^)]+\\)[\\s\\S]*?)*else\\s*\\{[\\s\\S]*?${escapedOutputVar}\\s*=\\s*v;[\\s\\S]*?\\}`
    );
    const replacement = `${outputVar} = ${swizzleExpr};`;
    
    const result = code.replace(swizzleBlockRegex, replacement);
    
    // If the replacement didn't work (regex didn't match), try a simpler approach
    // Just replace the parameter references and let the shader compile (it will fail but give better error)
    if (result === code) {
      // Fallback: remove all $param.swizzle references
      return code.replace(/\$param\.swizzle/g, '""');
    }
    
    return result;
  }
  
  /**
   * Normalize swizzle pattern to valid GLSL swizzle
   * Converts rgba/abgr to xyzw, validates characters
   */
  private normalizeSwizzlePattern(pattern: string): string | null {
    if (!pattern || typeof pattern !== 'string') return null;
    
    // Convert rgba notation to xyzw
    let normalized = pattern.toLowerCase();
    normalized = normalized.replace(/r/g, 'x');
    normalized = normalized.replace(/g/g, 'y');
    normalized = normalized.replace(/b/g, 'z');
    normalized = normalized.replace(/a/g, 'w');
    
    // Validate: only x, y, z, w allowed, length 1-4
    if (!/^[xyzw]{1,4}$/.test(normalized)) {
      return null;
    }
    
    return normalized;
  }

  /**
   * Generate parameter combination expression based on input mode
   */
  private generateParameterCombination(
    configValue: string,
    inputValue: string,
    mode: 'override' | 'add' | 'subtract' | 'multiply',
    _paramType: 'float' | 'int' = 'float'
  ): string {
    // For override mode, just return the input value
    if (mode === 'override') {
      return inputValue;
    }
    
    // For arithmetic operations, both values are already float-compatible
    switch (mode) {
      case 'add':
        return `(${configValue} + ${inputValue})`;
      case 'subtract':
        return `(${configValue} - ${inputValue})`;
      case 'multiply':
        return `(${configValue} * ${inputValue})`;
      default:
        return inputValue;
    }
  }

  /**
   * Escape regex special characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
