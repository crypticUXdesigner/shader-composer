import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';
import { NodeShaderCompiler } from '../shaders/NodeShaderCompiler';
import { nodeSystemSpecs } from '../shaders/nodes/index';
import { toValidationSpecs } from './nodeSpecUtils';
import { loadPreset, loadPresetFromJson } from './presetManager';
import { UndoRedoManager } from '../ui/editor';
import { updateNodeParameter, validateGraph } from '../data-model';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Same convention as VariableNameGenerator / NodeShaderCompiler.test.ts */
function expectedOutputVariableName(nodeId: string, portName: string): string {
  const sanitizedId = nodeId.replace(/[^a-zA-Z0-9]/g, '_');
  const sanitizedPort = portName.replace(/[^a-zA-Z0-9]/g, '_');
  return `node_${sanitizedId}_${sanitizedPort}`;
}

describe('presetManager scenario tests', () => {
  it('loads testing preset via loadPreset and compiles without errors', async () => {
    const validationSpecs = toValidationSpecs(nodeSystemSpecs);

    const loadResult = await loadPreset('testing', validationSpecs);

    expect(loadResult.errors, loadResult.errors.join('; ')).toHaveLength(0);
    expect(loadResult.graph).not.toBeNull();

    const graph = loadResult.graph!;
    const audioSetup = loadResult.audioSetup ?? null;

    const nodeSpecsMap = new Map(nodeSystemSpecs.map((s) => [s.id, s]));
    const compiler = new NodeShaderCompiler(nodeSpecsMap);

    const compileResult = compiler.compile(graph, audioSetup);

    expect(compileResult.metadata.errors, compileResult.metadata.errors.join('; ')).toHaveLength(
      0
    );
    expect(typeof compileResult.shaderCode).toBe('string');
    expect(compileResult.shaderCode.length).toBeGreaterThan(0);

    expect(Array.isArray(compileResult.metadata.executionOrder)).toBe(true);
    expect(compileResult.metadata.executionOrder.length).toBeGreaterThan(0);

    const finalOutputId = compileResult.metadata.finalOutputNodeId;
    expect(finalOutputId).toBeTruthy();
    const hasFinalOutputNode = graph.nodes.some((n) => n.id === finalOutputId);
    expect(hasFinalOutputNode).toBe(true);
  });

  it('loads testing preset via loadPresetFromJson and compiles without errors', async () => {
    const validationSpecs = toValidationSpecs(nodeSystemSpecs);
    const presetPath = join(__dirname, '../presets', 'testing.json');
    const json = readFileSync(presetPath, 'utf-8');

    const loadResult = await loadPresetFromJson(json, validationSpecs);

    expect(loadResult.errors, loadResult.errors.join('; ')).toHaveLength(0);
    expect(loadResult.graph).not.toBeNull();

    const graph = loadResult.graph!;
    const audioSetup = loadResult.audioSetup ?? null;

    const nodeSpecsMap = new Map(nodeSystemSpecs.map((s) => [s.id, s]));
    const compiler = new NodeShaderCompiler(nodeSpecsMap);

    const compileResult = compiler.compile(graph, audioSetup);

    expect(compileResult.metadata.errors, compileResult.metadata.errors.join('; ')).toHaveLength(
      0
    );
    expect(typeof compileResult.shaderCode).toBe('string');
    expect(compileResult.shaderCode.length).toBeGreaterThan(0);

    expect(Array.isArray(compileResult.metadata.executionOrder)).toBe(true);
    expect(compileResult.metadata.executionOrder.length).toBeGreaterThan(0);

    const finalOutputId = compileResult.metadata.finalOutputNodeId;
    expect(finalOutputId).toBeTruthy();
    const hasFinalOutputNode = graph.nodes.some((n) => n.id === finalOutputId);
    expect(hasFinalOutputNode).toBe(true);
  });

  it('quad-warp param chain: loadPresetFromJson compiles with intensity before quad-warp and correct variable', async () => {
    const validationSpecs = toValidationSpecs(nodeSystemSpecs);
    const fixturePath = join(__dirname, '__fixtures__', 'quad-warp-param-chain.json');
    const json = readFileSync(fixturePath, 'utf-8');

    const loadResult = await loadPresetFromJson(json, validationSpecs);

    expect(loadResult.errors, loadResult.errors.join('; ')).toHaveLength(0);
    expect(loadResult.graph).not.toBeNull();

    const graph = loadResult.graph!;
    const audioSetup = loadResult.audioSetup ?? null;

    const nodeSpecsMap = new Map(nodeSystemSpecs.map((s) => [s.id, s]));
    const compiler = new NodeShaderCompiler(nodeSpecsMap);

    const compileResult = compiler.compile(graph, audioSetup);

    expect(compileResult.metadata.errors, compileResult.metadata.errors.join('; ')).toHaveLength(0);
    expect(typeof compileResult.shaderCode).toBe('string');
    expect(compileResult.shaderCode.length).toBeGreaterThan(0);

    const order = compileResult.metadata.executionOrder;
    expect(Array.isArray(order)).toBe(true);
    expect(order.length).toBeGreaterThan(0);

    const intensityId = 'n-intensity';
    const quadWarpId = 'n-quadwarp';
    const intensityIndex = order.indexOf(intensityId);
    const quadWarpIndex = order.indexOf(quadWarpId);
    expect(intensityIndex).toBeGreaterThanOrEqual(0);
    expect(quadWarpIndex).toBeGreaterThanOrEqual(0);
    expect(
      intensityIndex,
      `Execution order should have Intensity before quad-warp; got: ${order.join(' -> ')}`
    ).toBeLessThan(quadWarpIndex);

    const intensityVar = expectedOutputVariableName(intensityId, 'out');
    expect(compileResult.shaderCode).toContain(intensityVar);

    const c00Pattern = new RegExp(
      `vec2\\(\\s*${intensityVar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*,`
    );
    expect(
      compileResult.shaderCode,
      'quad-warp c00 must use Intensity variable (vec2(intensityVar, ...)), not default'
    ).toMatch(c00Pattern);

    const finalOutputId = compileResult.metadata.finalOutputNodeId;
    expect(finalOutputId).toBe('n-output');
    expect(graph.nodes.some((n) => n.id === finalOutputId)).toBe(true);
  });

  it('Scenario 4 — Load + undo: load preset, apply one change, undo restores graph invariants', async () => {
    const validationSpecs = toValidationSpecs(nodeSystemSpecs);
    const presetPath = join(__dirname, '../presets', 'testing.json');
    const json = readFileSync(presetPath, 'utf-8');

    const loadResult = await loadPresetFromJson(json, validationSpecs);
    expect(loadResult.errors, loadResult.errors.join('; ')).toHaveLength(0);
    expect(loadResult.graph).not.toBeNull();
    const graphAfterLoad = loadResult.graph!;

    const raymarcherNode = graphAfterLoad.nodes.find((n) => n.type === 'generic-raymarcher');
    expect(raymarcherNode).toBeDefined();
    const nodeId = raymarcherNode!.id;
    const paramName = 'brightness';
    const originalValue = raymarcherNode!.parameters[paramName] ?? 0;

    const undoManager = new UndoRedoManager();
    undoManager.clear();
    undoManager.pushState(graphAfterLoad);

    const graphAfterEdit = updateNodeParameter(graphAfterLoad, nodeId, paramName, 0.5);
    undoManager.pushState(graphAfterEdit);

    expect(undoManager.canUndo()).toBe(true);
    const restoredGraph = undoManager.undo();
    expect(restoredGraph).not.toBeNull();

    const restored = restoredGraph!;
    const validation = validateGraph(restored, validationSpecs);
    expect(validation.valid, validation.errors.join('; ')).toBe(true);

    const restoredParamValue = restored.nodes.find((n) => n.id === nodeId)?.parameters[paramName];
    expect(restoredParamValue).toBe(originalValue);

    const nodeSpecsMap = new Map(nodeSystemSpecs.map((s) => [s.id, s]));
    const compiler = new NodeShaderCompiler(nodeSpecsMap);
    const compileAfterLoad = compiler.compile(graphAfterLoad, loadResult.audioSetup ?? null);
    const compileRestored = compiler.compile(restored, loadResult.audioSetup ?? null);
    expect(compileRestored.metadata.errors, compileRestored.metadata.errors.join('; ')).toHaveLength(
      0
    );
    expect(compileRestored.metadata.finalOutputNodeId).toBe(
      compileAfterLoad.metadata.finalOutputNodeId
    );
  });

  it('Scenario 5 — Load + undo + redo: redo restores edited state', async () => {
    const validationSpecs = toValidationSpecs(nodeSystemSpecs);
    const presetPath = join(__dirname, '../presets', 'testing.json');
    const json = readFileSync(presetPath, 'utf-8');

    const loadResult = await loadPresetFromJson(json, validationSpecs);
    expect(loadResult.errors, loadResult.errors.join('; ')).toHaveLength(0);
    expect(loadResult.graph).not.toBeNull();
    const graphAfterLoad = loadResult.graph!;

    const raymarcherNode = graphAfterLoad.nodes.find((n) => n.type === 'generic-raymarcher');
    expect(raymarcherNode).toBeDefined();
    const nodeId = raymarcherNode!.id;
    const paramName = 'brightness';
    const editedValue = 0.5;

    const undoManager = new UndoRedoManager();
    undoManager.clear();
    undoManager.pushState(graphAfterLoad);

    const graphAfterEdit = updateNodeParameter(graphAfterLoad, nodeId, paramName, editedValue);
    undoManager.pushState(graphAfterEdit);

    undoManager.undo();
    expect(undoManager.canRedo()).toBe(true);
    const redoneGraph = undoManager.redo();
    expect(redoneGraph).not.toBeNull();

    const redone = redoneGraph!;
    const validation = validateGraph(redone, validationSpecs);
    expect(validation.valid, validation.errors.join('; ')).toBe(true);

    const redoneParamValue = redone.nodes.find((n) => n.id === nodeId)?.parameters[paramName];
    expect(redoneParamValue).toBe(editedValue);

    const nodeSpecsMap = new Map(nodeSystemSpecs.map((s) => [s.id, s]));
    const compiler = new NodeShaderCompiler(nodeSpecsMap);
    const compileRedone = compiler.compile(redone, loadResult.audioSetup ?? null);
    const compileAfterEdit = compiler.compile(graphAfterEdit, loadResult.audioSetup ?? null);
    expect(compileRedone.metadata.errors, compileRedone.metadata.errors.join('; ')).toHaveLength(
      0
    );
    expect(compileRedone.metadata.finalOutputNodeId).toBe(
      compileAfterEdit.metadata.finalOutputNodeId
    );
  });

  it('loads sphere preset via loadPreset and compiles without errors', async () => {
    const validationSpecs = toValidationSpecs(nodeSystemSpecs);

    const loadResult = await loadPreset('sphere', validationSpecs);

    expect(loadResult.errors, loadResult.errors.join('; ')).toHaveLength(0);
    expect(loadResult.graph).not.toBeNull();

    const graph = loadResult.graph!;
    const audioSetup = loadResult.audioSetup ?? null;

    const nodeSpecsMap = new Map(nodeSystemSpecs.map((s) => [s.id, s]));
    const compiler = new NodeShaderCompiler(nodeSpecsMap);

    const compileResult = compiler.compile(graph, audioSetup);

    expect(compileResult.metadata.errors, compileResult.metadata.errors.join('; ')).toHaveLength(
      0
    );
    expect(typeof compileResult.shaderCode).toBe('string');
    expect(compileResult.shaderCode.length).toBeGreaterThan(0);
    expect(Array.isArray(compileResult.metadata.executionOrder)).toBe(true);
    expect(compileResult.metadata.executionOrder.length).toBeGreaterThan(0);

    const finalOutputId = compileResult.metadata.finalOutputNodeId;
    expect(finalOutputId).toBeTruthy();
    expect(graph.nodes.some((n) => n.id === finalOutputId)).toBe(true);
  });

  it('loads warped-drops preset via loadPreset and compiles without errors', async () => {
    const validationSpecs = toValidationSpecs(nodeSystemSpecs);

    const loadResult = await loadPreset('warped-drops', validationSpecs);

    expect(loadResult.errors, loadResult.errors.join('; ')).toHaveLength(0);
    expect(loadResult.graph).not.toBeNull();

    const graph = loadResult.graph!;
    const audioSetup = loadResult.audioSetup ?? null;

    const nodeSpecsMap = new Map(nodeSystemSpecs.map((s) => [s.id, s]));
    const compiler = new NodeShaderCompiler(nodeSpecsMap);

    const compileResult = compiler.compile(graph, audioSetup);

    expect(compileResult.metadata.errors, compileResult.metadata.errors.join('; ')).toHaveLength(
      0
    );
    expect(typeof compileResult.shaderCode).toBe('string');
    expect(compileResult.shaderCode.length).toBeGreaterThan(0);
    expect(Array.isArray(compileResult.metadata.executionOrder)).toBe(true);
    expect(compileResult.metadata.executionOrder.length).toBeGreaterThan(0);

    const finalOutputId = compileResult.metadata.finalOutputNodeId;
    expect(finalOutputId).toBeTruthy();
    expect(graph.nodes.some((n) => n.id === finalOutputId)).toBe(true);
  });

  it('loads sdf-raymarcher-ether-audio preset and compiles with audio uniform on ether-sdf param', async () => {
    const validationSpecs = toValidationSpecs(nodeSystemSpecs);

    const loadResult = await loadPreset('sdf-raymarcher-ether-audio', validationSpecs);

    expect(loadResult.errors, loadResult.errors.join('; ')).toHaveLength(0);
    expect(loadResult.graph).not.toBeNull();

    const graph = loadResult.graph!;
    const audioSetup = loadResult.audioSetup ?? null;

    const etherNode = graph.nodes.find((n) => n.type === 'ether-sdf');
    expect(etherNode).toBeDefined();
    const etherId = etherNode!.id;

    const paramConn = graph.connections.find(
      (c) => c.targetNodeId === etherId && c.targetParameter === 'timeOffset'
    );
    expect(paramConn).toBeDefined();
    expect(paramConn!.sourceNodeId).toBe('audio-signal:remap-ether-audio-remap');

    const nodeSpecsMap = new Map(nodeSystemSpecs.map((s) => [s.id, s]));
    const compiler = new NodeShaderCompiler(nodeSpecsMap);

    const compileResult = compiler.compile(graph, audioSetup);

    expect(compileResult.metadata.errors, compileResult.metadata.errors.join('; ')).toHaveLength(
      0
    );

    // Expected uniform for remap-ether-audio-remap.out (must match UniformGenerator.sanitizeUniformName)
    const sanitizeUniformName = (nodeId: string, paramName: string): string => {
      let sanitizedId = nodeId.replace(/[^a-zA-Z0-9]/g, '_');
      if (/^\d/.test(sanitizedId)) {
        sanitizedId = 'n' + sanitizedId;
      }
      let sanitizedParam = paramName.replace(/[^a-zA-Z0-9]/g, '');
      sanitizedParam = sanitizedParam.charAt(0).toUpperCase() + sanitizedParam.slice(1);
      return `u${sanitizedId}${sanitizedParam}`;
    };

    const expectedUniform = sanitizeUniformName('remap-ether-audio-remap', 'out');

    expect(
      compileResult.shaderCode,
      'Compiled shader must reference audio uniform for ether-sdf.timeOffset'
    ).toContain(expectedUniform);
    expect(
      compileResult.shaderCode,
      'Compiled shader must not contain raw $param.timeOffset placeholder when audio connection is present'
    ).not.toContain('$param.timeOffset');
  });

  it('loads sdf-raymarcher-hex-audio preset and compiles with audio uniform on hex SDF param', async () => {
    const validationSpecs = toValidationSpecs(nodeSystemSpecs);

    const loadResult = await loadPreset('sdf-raymarcher-hex-audio', validationSpecs);

    expect(loadResult.errors, loadResult.errors.join('; ')).toHaveLength(0);
    expect(loadResult.graph).not.toBeNull();

    const graph = loadResult.graph!;
    const audioSetup = loadResult.audioSetup ?? null;

    const hexNode = graph.nodes.find((n) => n.type === 'repeated-hex-prism-sdf');
    expect(hexNode).toBeDefined();
    const hexId = hexNode!.id;

    const paramConn = graph.connections.find(
      (c) => c.targetNodeId === hexId && c.targetParameter === 'hexRadius'
    );
    expect(paramConn).toBeDefined();
    expect(paramConn!.sourceNodeId).toBe('audio-signal:remap-hex-audio-remap');

    const nodeSpecsMap = new Map(nodeSystemSpecs.map((s) => [s.id, s]));
    const compiler = new NodeShaderCompiler(nodeSpecsMap);

    const compileResult = compiler.compile(graph, audioSetup);

    expect(compileResult.metadata.errors, compileResult.metadata.errors.join('; ')).toHaveLength(
      0
    );

    const sanitizeUniformName = (nodeId: string, paramName: string): string => {
      let sanitizedId = nodeId.replace(/[^a-zA-Z0-9]/g, '_');
      if (/^\d/.test(sanitizedId)) {
        sanitizedId = 'n' + sanitizedId;
      }
      let sanitizedParam = paramName.replace(/[^a-zA-Z0-9]/g, '');
      sanitizedParam = sanitizedParam.charAt(0).toUpperCase() + sanitizedParam.slice(1);
      return `u${sanitizedId}${sanitizedParam}`;
    };

    const expectedUniform = sanitizeUniformName('remap-hex-audio-remap', 'out');

    expect(
      compileResult.shaderCode,
      'Compiled shader must reference audio uniform for repeated-hex-prism-sdf.hexRadius'
    ).toContain(expectedUniform);
    expect(
      compileResult.shaderCode,
      'Compiled shader must not contain raw $param.hexRadius placeholder when audio connection is present'
    ).not.toContain('$param.hexRadius');
  });
});

