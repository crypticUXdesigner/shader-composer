import type { NodeGraph, NodeInstance } from '../../data-model/types';
import type { NodeSpec } from '../../types/nodeSpec';
import { buildVariableDeclarations, getOutputInitialValue } from './MainCodeGeneratorDeclarations';
import { buildGenericRaymarcherSdfFunction, getGenericRaymarcherReplacements } from './MainCodeGeneratorRaymarcher';
import {
  findFinalOutputNode as findFinalOutputNodeImpl,
  generateFinalColorVariable as generateFinalColorVariableImpl,
  generateAutomationFunctions as generateAutomationFunctionsImpl,
  assembleShader as assembleShaderImpl,
  sanitizeAutomationLaneId,
  emitCurveEvalGlsl
} from './MainCodeGeneratorOutput';
import { generateNodeCode, type NodeCodeContext } from './MainCodeGeneratorNodeCode';

/**
 * Generates main shader code and assembles the final shader.
 * Delegates to modules: Declarations, NodeCode, Raymarcher, Output.
 */
export class MainCodeGenerator {
  constructor(
    private nodeSpecs: Map<string, NodeSpec>,
    _isAudioNode: (nodeSpec: NodeSpec) => boolean,
    private generateArrayVariableName: (nodeId: string, paramName: string) => string,
    private escapeRegex: (str: string) => string,
    private generateParameterCombination: (
      configValue: string,
      inputValue: string,
      mode: 'override' | 'add' | 'subtract' | 'multiply',
      paramType: 'float' | 'int'
    ) => string,
    private generateSwizzleCode: (
      code: string,
      swizzleValue: string,
      inputVars: Map<string, string>,
      outputVars: Map<string, string>
    ) => string,
    _normalizeSwizzlePattern: (pattern: string) => string | null
  ) {
    // Constructor parameter accepted but intentionally unused
  }

  private getNodeCodeContext(
    variableNames: Map<string, Map<string, string>>
  ): NodeCodeContext {
    const self = this;
    return {
      nodeSpecs: this.nodeSpecs,
      escapeRegex: this.escapeRegex,
      generateArrayVariableName: this.generateArrayVariableName,
      generateParameterCombination: this.generateParameterCombination,
      generateSwizzleCode: this.generateSwizzleCode,
      getGenericRaymarcherReplacements(node, graph, uniformNames, functionNameMap) {
        return getGenericRaymarcherReplacements(
          node,
          graph,
          variableNames,
          uniformNames,
          functionNameMap,
          self.nodeSpecs,
          self.generateParameterCombination,
          self.escapeRegex
        );
      }
    };
  }

  /**
   * Generate main code for all nodes in execution order.
   */
  generateMainCode(
    graph: NodeGraph,
    executionOrder: string[],
    variableNames: Map<string, Map<string, string>>,
    uniformNames: Map<string, string>,
    functionNameMap: Map<string, Map<string, string>> = new Map()
  ): { variableDeclarations: string; mainCode: string; genericRaymarcherSdfFunctions: string } {
    const { variableDeclarations: declLines } = buildVariableDeclarations(
      graph,
      this.nodeSpecs,
      variableNames,
      getOutputInitialValue
    );
    const variableDeclarations = declLines.join('\n');
    const mainCode: string[] = [];
    const genericRaymarcherSdfFunctions: string[] = [];
    const nodeCodeCtx = this.getNodeCodeContext(variableNames);

    for (const nodeId of executionOrder) {
      const node = graph.nodes.find(n => n.id === nodeId);
      if (!node) continue;

      const nodeSpec = this.nodeSpecs.get(node.type);
      if (!nodeSpec) continue;

      if (nodeSpec.id === 'final-output') continue;

      if (nodeSpec.id === 'generic-raymarcher') {
        const sdfFuncCode = buildGenericRaymarcherSdfFunction(
          node,
          graph,
          uniformNames,
          variableNames,
          functionNameMap,
          this.nodeSpecs,
          this.generateParameterCombination,
          this.escapeRegex
        );
        if (sdfFuncCode) genericRaymarcherSdfFunctions.push(sdfFuncCode);
      }

      const nodeCode = generateNodeCode(
        node,
        nodeSpec,
        graph,
        executionOrder,
        variableNames,
        uniformNames,
        functionNameMap,
        nodeCodeCtx
      );
      mainCode.push(`  // Node: ${nodeSpec.displayName} (${nodeId})`);
      mainCode.push('  {');
      const indentedCode = nodeCode.split('\n').map(line => line ? '  ' + line : line).join('\n');
      mainCode.push(indentedCode);
      mainCode.push('  }');
      mainCode.push('');
    }

    return {
      variableDeclarations,
      mainCode: mainCode.join('\n'),
      genericRaymarcherSdfFunctions: genericRaymarcherSdfFunctions.join('\n\n')
    };
  }

  findFinalOutputNode(graph: NodeGraph, executionOrder: string[]): NodeInstance | null {
    return findFinalOutputNodeImpl(graph, executionOrder, this.nodeSpecs);
  }

  generateFinalColorVariable(
    graph: NodeGraph,
    finalOutputNode: NodeInstance | null,
    variableNames: Map<string, Map<string, string>>
  ): string {
    return generateFinalColorVariableImpl(graph, finalOutputNode, variableNames, this.nodeSpecs);
  }

  generateAutomationFunctions(graph: NodeGraph, executionOrder: string[]): string {
    return generateAutomationFunctionsImpl(
      graph,
      executionOrder,
      this.nodeSpecs,
      sanitizeAutomationLaneId,
      emitCurveEvalGlsl
    );
  }

  assembleShader(
    functions: string,
    uniforms: Array<{ name: string; type: string }>,
    variableDeclarations: string,
    mainCode: string,
    finalColorVar: string,
    automationFunctions: string = ''
  ): string {
    return assembleShaderImpl(
      functions,
      uniforms,
      variableDeclarations,
      mainCode,
      finalColorVar,
      automationFunctions
    );
  }
}
