import type { AudioSetup } from '../../data-model/audioSetupTypes';
import type { NodeGraph } from '../../data-model/types';
import type { NodeSpec } from '../../types/nodeSpec';
import { injectArrangementLanesNodeFunctions } from '../arrangement/packArrangementRegionsForGlsl';
import { injectArrangementNotesNodeFunctions } from '../arrangement/packArrangementNotesForGlsl';
import { emitLutGlslFunctions } from '../colorRamps/emitGlsl';
import { getBakedLutPresetIndex } from '../colorRamps/lutPresets';
import {
  buildFloatParamExpressions,
  getAutomationExpressionForParam,
  type FloatParamExpressionMap
} from './FloatParamExpressions';
import { formatParamLiteralForGlsl } from './MainCodeGeneratorUtils';

function clampFloatExpression(expr: string, paramSpec: NodeSpec['parameters'][string] | undefined): string {
  if (!paramSpec || paramSpec.type !== 'float') return expr;
  const min = typeof paramSpec.min === 'number' ? paramSpec.min : 0;
  const max = typeof paramSpec.max === 'number' ? paramSpec.max : 1;
  const minStr = formatParamLiteralForGlsl(min, { type: 'float' });
  const maxStr = formatParamLiteralForGlsl(max, { type: 'float' });
  return `clamp((${expr}), ${minStr}, ${maxStr})`;
}

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
    variableNames: Map<string, Map<string, string>>,
    executionOrder: string[],
    audioSetup?: AudioSetup | null
  ): { functions: string; functionNameMap: Map<string, Map<string, string>> } {
    const processedFunctions: Array<{ nodeId: string; funcCode: string }> = [];
    // Map: nodeId -> (originalFunctionName -> nodeSpecificFunctionName)
    const functionNameMap = new Map<string, Map<string, string>>();

    // Per-node Power: nodes dropped from execution order (bypassed) must not contribute helper
    // functions either, so the compiled shader stays free of bypassed-node code.
    const executionOrderSet = new Set(executionOrder);

    for (const node of graph.nodes) {
      if (!executionOrderSet.has(node.id)) continue;
      const nodeSpec = this.nodeSpecs.get(node.type);
      if (!nodeSpec?.functions) continue;

      // Process function code for this node: replace placeholders with actual uniform names or input values
      let funcCode = nodeSpec.functions;

      if (nodeSpec.id === 'arrangement-lanes') {
        funcCode = injectArrangementLanesNodeFunctions(
          funcCode,
          node,
          audioSetup?.arrangementSnapshot
        );
      } else if (nodeSpec.id === 'arrangement-notes') {
        funcCode = injectArrangementNotesNodeFunctions(
          funcCode,
          node,
          audioSetup?.arrangementSnapshot
        );
      } else if (nodeSpec.id === 'color-lut') {
        funcCode = emitLutGlslFunctions(getBakedLutPresetIndex(node, nodeSpec));
      }

      // Build GLSL expressions for float parameters (config value + automation + optional input connection).
      const floatParamExpressions: FloatParamExpressionMap = buildFloatParamExpressions(
        node,
        nodeSpec,
        graph,
        executionOrder,
        uniformNames,
        variableNames,
        this.nodeSpecs,
        this.generateParameterCombination,
        this.escapeRegex
      );

      for (const paramName of Object.keys(nodeSpec.parameters)) {
        const expr = floatParamExpressions[paramName];
        if (!expr) continue;
        const regex = new RegExp(`\\$param\\.${this.escapeRegex(paramName)}\\b`, 'g');
        funcCode = funcCode.replace(regex, expr);
      }
      
      // Replace global placeholders
      funcCode = funcCode.replace(/\$time/g, 'uTime');
      funcCode = funcCode.replace(/\$resolution/g, 'uResolution');
      
      // Final cleanup pass: catch any remaining $param.* placeholders that weren't replaced
      // This is a safety net for edge cases where placeholders exist in function code
      // but the uniform wasn't found or the parameter doesn't exist in the spec.
      // For int parameters (e.g. shape/enum), always prefer uniform over literal so the value
      // can change at runtime (e.g. box-torus-sdf Shape dropdown).
      // For float params with automation, use evalAutomation_*(uTimelineTime).
      funcCode = funcCode.replace(/\$param\.\w+/g, (match) => {
        const paramName = match.replace('$param.', '');
        const paramSpec = nodeSpec.parameters[paramName];
        const automationExpr = getAutomationExpressionForParam(node.id, paramName, graph, paramSpec);
        if (automationExpr) {
          return clampFloatExpression(automationExpr, paramSpec);
        }
        const uniformName = uniformNames.get(`${node.id}.${paramName}`);
        // Prefer uniform so runtime parameter changes (e.g. enum dropdown) take effect
        if (uniformName) {
          return clampFloatExpression(uniformName, paramSpec);
        }
        const paramValue = node.parameters[paramName];
        if (paramValue !== undefined) {
          return clampFloatExpression(String(paramValue), paramSpec);
        }
        return paramSpec?.type === 'int' ? '0' : '0.0';
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
      
      // CRITICAL FIX: Use node-specific function names when the function body is node-specific, so
      // deduplication doesn't keep one node's implementation for all. This is needed when:
      // 1) This node has parameter connections (embeds different variable references), or
      // 2) This node's function code contains any of its uniforms (e.g. box-torus-sdf sceneSDF with
      //    primitiveType). Otherwise e.g. multiple primitive nodes could both define sceneSDF(vec3);
      //    the first wins and the other node's uniforms are never read.
      const nodeUniformPrefix = node.id + '.';
      let funcCodeHasNodeUniforms = false;
      for (const [key, uname] of uniformNames) {
        if (key.startsWith(nodeUniformPrefix) && funcCode.includes(uname)) {
          funcCodeHasNodeUniforms = true;
          break;
        }
      }
      const hasParamInputConnections =
        (floatParamExpressions.__hasInputConnections ?? false) === true;
      const needsNodeSpecificNames =
        hasParamInputConnections ||
        funcCodeHasNodeUniforms ||
        nodeSpec.id === 'arrangement-lanes' ||
        nodeSpec.id === 'arrangement-notes';

      if (needsNodeSpecificNames) {
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
          // Match any valid GLSL identifier as return type so struct-returning functions are handled too.
          const functionDefRegex = new RegExp(`(\\b[a-zA-Z_][a-zA-Z0-9_]*\\s+)${this.escapeRegex(originalName)}(\\s*\\()`, 'g');
          funcCode = funcCode.replace(functionDefRegex, `$1${nodeSpecificName}$2`);
          const functionCallRegex = new RegExp(`\\b${this.escapeRegex(originalName)}\\s*\\(`, 'g');
          funcCode = funcCode.replace(functionCallRegex, `${nodeSpecificName}(`);
        }

        if (nodeFunctionNameMap.size > 0) {
          functionNameMap.set(node.id, nodeFunctionNameMap);
        }
      }

      processedFunctions.push({ nodeId: node.id, funcCode });
    }

    // Extract preamble (code before first function) and functions per node.
    // Preambles often define macros/consts used by that node's functions.
    //
    // Important: do not treat preprocessor directives like `#define foo(x) ...` as functions.
    // So we require a real function definition with `{` after the signature.
    const functionDefStartRegex = /\b[a-zA-Z_][a-zA-Z0-9_]*\s+\w+\s*\([^)]*\)\s*\{/m;
    const functionMap = new Map<string, { body: string; nodeId: string }>(); // signature -> { body, nodeId }
    const preambleByNode = new Map<string, string>(); // nodeId -> preamble (trimmed)

    for (const { nodeId, funcCode } of processedFunctions) {
      const maskedForDef = this.maskCommentsForFunctionScan(funcCode);
      const firstMatch = functionDefStartRegex.exec(maskedForDef);
      const firstFunctionIndex = firstMatch ? firstMatch.index : funcCode.length;
      const preamble = funcCode.substring(0, firstFunctionIndex).trim();
      if (preamble) {
        preambleByNode.set(nodeId, preamble);
      }

      const functions = this.extractFunctions(funcCode);
      for (const func of functions) {
        const signature = func.signature;
        if (!functionMap.has(signature)) {
          functionMap.set(signature, { body: func.body, nodeId });
        }
      }
    }

    // Emit preambles for nodes that contributed at least one function (first occurrence order), then all function bodies.
    const nodeOrder = Array.from(functionMap.values()).map((v) => v.nodeId);
    const seenNodes = new Set<string>();
    const preambleBlocks: string[] = [];
    for (const nodeId of nodeOrder) {
      if (seenNodes.has(nodeId)) continue;
      seenNodes.add(nodeId);
      const preamble = preambleByNode.get(nodeId);
      if (preamble) preambleBlocks.push(preamble);
    }
    const preamblesSection = preambleBlocks.length > 0 ? preambleBlocks.join('\n\n') + '\n\n' : '';
    const finalFunctions = preamblesSection + Array.from(functionMap.values()).map((v) => v.body).join('\n\n');

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
    
    // Scan a comment-masked copy so prose in // comments cannot match as functions, e.g.
    // `// Domain warping (strength...)` or `... single-color output` + newline + `for (...)`.
    const codeForScan = this.maskCommentsForFunctionScan(code);

    // Find all function definitions by looking for "returnType functionName(" pattern
    // Match: returnType functionName(params) { body }
    // Return type can be any GLSL identifier (builtins or user-defined structs).
    const functionStartRegex = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s+(\w+)\s*\(/g;
    let match;
    const functionStarts: Array<{index: number, returnType: string, name: string}> = [];
    
    // Collect all function start positions
    while ((match = functionStartRegex.exec(codeForScan)) !== null) {
      const returnType = match[1].trim();
      const functionName = match[2].trim();
      // "else if (...)" matches the pattern [identifier] [identifier] ( — not a function definition.
      // Treating "if" as a function name breaks GLSL when node-specific renaming turns if(...) into if_node_<id>(...).
      if (returnType === 'else' && functionName === 'if') continue;
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
      
      // Find the matching closing brace (handle nested braces; ignore braces inside // and /* */)
      const braceResult = this.findMatchingBraceEnd(code, bracePos + 1);
      let endPos = braceResult.endPos;
      let braceCount = braceResult.braceCount;
      
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

  /**
   * Replace line and block comments with spaces (same length) so regex match indices
   * stay aligned with the original source. Preserves double-quoted string literals.
   */
  private maskCommentsForFunctionScan(code: string): string {
    let out = '';
    let i = 0;
    const n = code.length;
    while (i < n) {
      const c = code[i];
      if (c === '/' && i + 1 < n) {
        if (code[i + 1] === '/') {
          while (i < n && code[i] !== '\n') {
            out += ' ';
            i++;
          }
          continue;
        }
        if (code[i + 1] === '*') {
          out += ' ';
          out += ' ';
          i += 2;
          while (i < n - 1 && (code[i] !== '*' || code[i + 1] !== '/')) {
            out += ' ';
            i++;
          }
          if (i < n - 1) {
            out += ' ';
            out += ' ';
            i += 2;
          }
          continue;
        }
      }
      if (c === '"') {
        out += '"';
        i++;
        while (i < n) {
          if (code[i] === '\\') {
            out += code[i];
            i++;
            if (i < n) {
              out += code[i];
              i++;
            }
            continue;
          }
          out += code[i];
          if (code[i] === '"') {
            i++;
            break;
          }
          i++;
        }
        continue;
      }
      out += c;
      i++;
    }
    return out;
  }

  /**
   * Find the position after the matching closing '}' for the brace at startPos-1,
   * ignoring any '{' or '}' inside line/block comments and inside "..." strings.
   * Returns endPos (index of character after the closing '}') and braceCount (0 if balanced).
   */
  private findMatchingBraceEnd(code: string, startPos: number): { endPos: number; braceCount: number } {
    let braceCount = 1;
    let pos = startPos;
    const n = code.length;
    while (pos < n && braceCount > 0) {
      const c = code[pos];
      if (c === '"') {
        pos++;
        while (pos < n && code[pos] !== '"') {
          if (code[pos] === '\\') pos++;
          pos++;
        }
        if (pos < n) pos++;
        continue;
      }
      if (c === '/' && pos + 1 < n) {
        if (code[pos + 1] === '/') {
          pos += 2;
          while (pos < n && code[pos] !== '\n') pos++;
          continue;
        }
        if (code[pos + 1] === '*') {
          pos += 2;
          while (pos < n - 1 && (code[pos] !== '*' || code[pos + 1] !== '/')) pos++;
          if (pos < n - 1) pos += 2;
          continue;
        }
      }
      if (c === '{') braceCount++;
      else if (c === '}') braceCount--;
      pos++;
    }
    return { endPos: pos, braceCount };
  }

}
