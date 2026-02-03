import type { NodeGraph, NodeSpec } from '../../types';

/**
 * Generates and deduplicates function code
 */
export class FunctionGenerator {
  constructor(
    private nodeSpecs: Map<string, NodeSpec>,
    private escapeRegex: (str: string) => string,
    private generateParameterCombination: (
      configValue: string,
      inputValue: string,
      mode: 'override' | 'add' | 'subtract' | 'multiply',
      paramType: 'float' | 'int'
    ) => string
  ) {}

  /**
   * Collect and deduplicate functions
   * Processes functions per-node to replace uniform placeholders with actual uniform names
   * Deduplicates at the individual function level by signature
   */
  collectAndDeduplicateFunctions(
    graph: NodeGraph, 
    uniformNames: Map<string, string>,
    variableNames: Map<string, Map<string, string>>
  ): { functions: string, functionNameMap: Map<string, Map<string, string>> } {
    const processedFunctions: string[] = [];
    // Map: nodeId -> (originalFunctionName -> nodeSpecificFunctionName)
    const functionNameMap = new Map<string, Map<string, string>>();

    for (const node of graph.nodes) {
      const nodeSpec = this.nodeSpecs.get(node.type);
      if (!nodeSpec?.functions) continue;

      // Process function code for this node: replace placeholders with actual uniform names or input values
      let funcCode = nodeSpec.functions;
      
      // Build map of parameter input variables (for parameters with input connections)
      const parameterInputVars = new Map<string, string>();

      for (const conn of graph.connections) {
        if (conn.targetNodeId === node.id && conn.targetParameter) {
          const sourceNode = graph.nodes.find(n => n.id === conn.sourceNodeId);
          if (!sourceNode) {
            // Source node doesn't exist - skip this connection
            // This can happen if a node was deleted but connections weren't cleaned up
            // Validation should catch this, but we handle it gracefully here
            continue;
          }

          const sourceSpec = this.nodeSpecs.get(sourceNode.type);
          if (!sourceSpec) continue;

          // Resolve source output: prefer connection's sourcePort, then first output (e.g. one-minus "out")
          const sourceOutput = sourceSpec.outputs.find(o => o.name === conn.sourcePort)
            ?? sourceSpec.outputs[0];
          const paramSpec = nodeSpec.parameters[conn.targetParameter];
          if (!sourceOutput || !paramSpec || paramSpec.type !== 'float') continue;

          const sourcePortName = sourceOutput.name;

          // CRITICAL: Only use variable names that actually exist in variableNames
          const sourceNodeInGraph = graph.nodes.find(n => n.id === conn.sourceNodeId);
          if (!sourceNodeInGraph) continue;

          if (!variableNames.has(conn.sourceNodeId)) continue;

          const sourceVarName = variableNames.get(conn.sourceNodeId)?.get(sourcePortName);
          if (!sourceVarName) continue;

          // Promote to appropriate type based on parameter type (float only)
          let promotedVar = sourceVarName;
          // Parameter is float - convert int inputs to float, extract first component for vec types
          if (sourceOutput.type === 'int') {
            promotedVar = `float(${sourceVarName})`;
          } else if (sourceOutput.type !== 'float') {
            // Extract first component for vec types
            promotedVar = `${sourceVarName}.x`;
          }
          parameterInputVars.set(conn.targetParameter, promotedVar);
        }
      }
      
      // CRITICAL VALIDATION: Verify all variable references in parameterInputVars will exist
      // This catches invalid variable references before they're embedded in function code
      // This is especially important when multiple parameter connections exist
      const allValidVars = new Set<string>();
      for (const nodeVars of variableNames.values()) {
        for (const varName of nodeVars.values()) {
          allValidVars.add(varName);
        }
      }
      
      // Extract variable names from parameterInputVars values (handle combined expressions)
      const paramVarNamePattern = /\bnode_[a-zA-Z0-9_]+_[a-zA-Z0-9_]+\b/g;
      for (const [paramName, varRef] of parameterInputVars.entries()) {
        const matches = varRef.match(paramVarNamePattern);
        if (matches) {
          for (const varName of matches) {
            if (!allValidVars.has(varName)) {
              console.error(
                `[NodeShaderCompiler] CRITICAL: Node ${node.id} (${nodeSpec.id}), parameter ${paramName}: ` +
                `Variable ${varName} referenced in expression "${varRef}" will not be declared. ` +
                `Source connection may be invalid or variable name mismatch. Removing invalid reference.`
              );
              // Remove invalid entry to prevent embedding wrong reference in function code
              parameterInputVars.delete(paramName);
              break; // Break inner loop, continue to next parameter
            }
          }
        }
      }

      // Replace parameter placeholders with actual uniform names or input variable names
      for (const paramName of Object.keys(nodeSpec.parameters)) {
        // Check if parameter has an input connection
        const paramInputVar = parameterInputVars.get(paramName);
        if (paramInputVar) {
          const paramSpec = nodeSpec.parameters[paramName];
          const inputMode = node.parameterInputModes?.[paramName] || paramSpec?.inputMode || 'override';
          if (inputMode === 'override') {
            const regex = new RegExp(`\\$param\\.${this.escapeRegex(paramName)}\\b`, 'g');
            funcCode = funcCode.replace(regex, paramInputVar);
          } else {
            const uniformName = uniformNames.get(`${node.id}.${paramName}`);
            const configValue = uniformName ?? String(node.parameters[paramName] ?? paramSpec?.default ?? (paramSpec?.type === 'int' ? '0' : '0.0'));
            const paramType = (paramSpec?.type === 'float' || paramSpec?.type === 'int') ? paramSpec.type : 'float';
            const combinedExpr = this.generateParameterCombination(configValue, paramInputVar, inputMode, paramType);
            const regex = new RegExp(`\\$param\\.${this.escapeRegex(paramName)}\\b`, 'g');
            funcCode = funcCode.replace(regex, combinedExpr);
          }
        } else {
          // No input connection - use uniform name
          const uniformName = uniformNames.get(`${node.id}.${paramName}`);
          if (uniformName) {
            const regex = new RegExp(`\\$param\\.${this.escapeRegex(paramName)}\\b`, 'g');
            funcCode = funcCode.replace(regex, uniformName);
          }
        }
      }
      
      // Replace global placeholders
      funcCode = funcCode.replace(/\$time/g, 'uTime');
      funcCode = funcCode.replace(/\$resolution/g, 'uResolution');
      
      // Final cleanup pass: catch any remaining $param.* placeholders that weren't replaced
      // This is a safety net for edge cases where placeholders exist in function code
      // but the uniform wasn't found or the parameter doesn't exist in the spec
      funcCode = funcCode.replace(/\$param\.\w+/g, (match) => {
        // Extract parameter name
        const paramName = match.replace('$param.', '');
        // Try to find it in node.parameters as fallback
        const paramValue = node.parameters[paramName];
        if (paramValue !== undefined) {
          return String(paramValue);
        }
        // Try to find uniform name one more time (in case it was added after first pass)
        const uniformName = uniformNames.get(`${node.id}.${paramName}`);
        if (uniformName) {
          return uniformName;
        }
        // Default to 0.0 if nothing found (safe default for GLSL)
        return '0.0';
      });
      
      // Final safety check: verify all variable names used in function code will be declared
      // Build set of all valid output variable names for O(1) lookup
      const validOutputVars = new Set<string>();
      for (const nodeVars of variableNames.values()) {
        for (const varName of nodeVars.values()) {
          validOutputVars.add(varName);
        }
      }
      
      // Build set of all uniform names to exclude them from validation
      // Uniform names follow pattern: u<sanitizedId><CapitalizedParamName>
      const allUniformNames = new Set(uniformNames.values());
      
      // Extract all variable names that match the pattern node_<id>_<port>
      // Use word boundaries to avoid partial matches within larger identifiers
      const variableNamePattern = /\bnode_[a-zA-Z0-9_]+_[a-zA-Z0-9_]+\b/g;
      const usedVariableNames = new Set<string>();
      let match;
      while ((match = variableNamePattern.exec(funcCode)) !== null) {
        const varName = match[0];
        // Skip if it's a uniform name (uniforms start with 'u' and shouldn't be validated as variables)
        // Also skip if it matches a uniform name pattern (starts with 'u' followed by node pattern)
        if (allUniformNames.has(varName) || varName.startsWith('u')) {
          continue;
        }
        // Only check if it's a potential output variable (starts with 'node_')
        if (varName.startsWith('node_')) {
          usedVariableNames.add(varName);
        }
      }
      
      // Check each used variable name to ensure it will be declared
      for (const varName of usedVariableNames) {
        if (!validOutputVars.has(varName)) {
          // Variable name is used but won't be declared - replace with safe default
          // This can happen if a connection references a deleted node or invalid output
          console.warn(`[NodeShaderCompiler] Variable ${varName} used in function code but won't be declared. Replacing with 0.0`);
          const escapedVarName = varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          funcCode = funcCode.replace(new RegExp(`\\b${escapedVarName}\\b`, 'g'), '0.0');
        }
      }
      
      // CRITICAL FIX: If this node has parameter connections, we need to create node-specific function names
      // to prevent incorrect deduplication. When multiple nodes have the same function but different
      // parameter connections, they embed different variable references, so they must not be deduplicated.
      if (parameterInputVars.size > 0) {
        const functions = this.extractFunctions(funcCode);
        const nodeFunctionNameMap = new Map<string, string>();

        for (const func of functions) {
          const parts = func.signature.split('_');
          if (parts.length >= 2) {
            const originalFunctionName = parts[1];
            const sanitizedNodeId = node.id.replace(/[^a-zA-Z0-9_]/g, '_');
            const nodeSpecificName = `${originalFunctionName}_${sanitizedNodeId}`;
            nodeFunctionNameMap.set(originalFunctionName, nodeSpecificName);
          }
        }

        for (const [originalName, nodeSpecificName] of nodeFunctionNameMap.entries()) {
          const functionDefRegex = new RegExp(`(\\b(?:float|vec2|vec3|vec4|int|bool|void)\\s+)${this.escapeRegex(originalName)}(\\s*\\()`, 'g');
          funcCode = funcCode.replace(functionDefRegex, `$1${nodeSpecificName}$2`);
          const functionCallRegex = new RegExp(`\\b${this.escapeRegex(originalName)}\\s*\\(`, 'g');
          funcCode = funcCode.replace(functionCallRegex, `${nodeSpecificName}(`);
        }

        if (nodeFunctionNameMap.size > 0) {
          functionNameMap.set(node.id, nodeFunctionNameMap);
        }
      }
      
      processedFunctions.push(funcCode);
    }

    // Extract and deduplicate individual functions by signature
    const functionMap = new Map<string, string>(); // signature -> function body
    
    for (const funcCode of processedFunctions) {
      const functions = this.extractFunctions(funcCode);
      for (const func of functions) {
        // Use function signature as key (return type + name + parameter types)
        const signature = func.signature;
        // Only keep the first occurrence of each function signature
        if (!functionMap.has(signature)) {
          functionMap.set(signature, func.body);
        }
      }
    }

    // Combine all unique functions
    const finalFunctions = Array.from(functionMap.values()).join('\n\n');

    return {
      functions: finalFunctions,
      functionNameMap
    };
  }

  /**
   * Extract individual function definitions from a code block
   * Returns array of {signature, body} objects
   */
  private extractFunctions(code: string): Array<{signature: string, body: string}> {
    const functions: Array<{signature: string, body: string}> = [];
    
    // Find all function definitions by looking for "returnType functionName(" pattern
    // Match: returnType functionName(params) { body }
    // Match common return types: float, vec2, vec3, vec4, int, bool, void
    const functionStartRegex = /\b(float|vec2|vec3|vec4|int|bool|void)\s+(\w+)\s*\(/g;
    let match;
    const functionStarts: Array<{index: number, returnType: string, name: string}> = [];
    
    // Collect all function start positions
    while ((match = functionStartRegex.exec(code)) !== null) {
      const returnType = match[1].trim();
      const functionName = match[2].trim();
      functionStarts.push({
        index: match.index,
        returnType,
        name: functionName
      });
    }
    
    // For each function start, extract the full function body
    for (let i = 0; i < functionStarts.length; i++) {
      const funcStart = functionStarts[i];
      const startPos = funcStart.index;
      
      // Find the opening brace by looking for '{' after the parameter list
      let parenCount = 0;
      let bracePos = -1;
      
      // Skip to the opening parenthesis
      let pos = startPos;
      while (pos < code.length && code[pos] !== '(') pos++;
      if (pos >= code.length) continue;
      
      // Skip over parameters (handle nested parens)
      parenCount = 1;
      pos++;
      while (pos < code.length && parenCount > 0) {
        if (code[pos] === '(') parenCount++;
        else if (code[pos] === ')') parenCount--;
        pos++;
      }
      if (parenCount !== 0) continue;
      
      // Now find the opening brace
      while (pos < code.length && /\s/.test(code[pos])) pos++;
      if (pos >= code.length || code[pos] !== '{') continue;
      
      bracePos = pos;
      
      // Find the matching closing brace (handle nested braces)
      let braceCount = 1;
      let endPos = bracePos + 1;
      while (endPos < code.length && braceCount > 0) {
        if (code[endPos] === '{') braceCount++;
        else if (code[endPos] === '}') braceCount--;
        endPos++;
      }
      
      if (braceCount !== 0) continue;
      
      // Extract the full function
      const fullFunction = code.substring(startPos, endPos);
      
      // Extract parameter list and types for signature
      const paramsMatch = fullFunction.match(/\(([^)]*)\)/);
      const params = paramsMatch?.[1] || '';
      
      // Extract parameter types
      const paramTypes: string[] = [];
      if (params.trim()) {
        const paramList = params.split(',').map(p => p.trim());
        for (const param of paramList) {
          // Match "type name" or "type name = default" patterns
          const paramMatch = param.match(/^(\w+)\s+\w+/);
          if (paramMatch) {
            paramTypes.push(paramMatch[1]);
          }
        }
      }
      
      // Create signature: returnType_functionName_paramTypes (normalized, no whitespace)
      const signature = `${funcStart.returnType.trim()}_${funcStart.name.trim()}_${paramTypes.map(t => t.trim()).join('_')}`;
      
      functions.push({ signature, body: fullFunction });
    }
    
    return functions;
  }
}
