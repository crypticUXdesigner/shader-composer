import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';
import { NodeShaderCompiler } from '../shaders/NodeShaderCompiler';
import { nodeSystemSpecs } from '../shaders/nodes/index';
import { toValidationSpecs } from './nodeSpecUtils';
import { loadPreset, loadPresetFromJson, listPresets } from './presetManager';
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
  it('loads blur-softening preset via loadPreset and compiles without errors', async () => {
    const validationSpecs = toValidationSpecs(nodeSystemSpecs);

    const loadResult = await loadPreset('blur-softening', validationSpecs);

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

  it('loads blur-softening preset via loadPresetFromJson and compiles without errors', async () => {
    const validationSpecs = toValidationSpecs(nodeSystemSpecs);
    const presetPath = join(__dirname, '../presets', 'blur-softening.json');
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

    const intensityVarEsc = intensityVar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const c00Pattern = new RegExp(
      `vec2\\(\\s*(?:clamp\\([^\\)]*${intensityVarEsc}[^\\)]*\\)|${intensityVarEsc})\\s*,`
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
    const presetPath = join(__dirname, '../presets', 'blur-softening.json');
    const json = readFileSync(presetPath, 'utf-8');

    const loadResult = await loadPresetFromJson(json, validationSpecs);
    expect(loadResult.errors, loadResult.errors.join('; ')).toHaveLength(0);
    expect(loadResult.graph).not.toBeNull();
    const graphAfterLoad = loadResult.graph!;

    const blurNode = graphAfterLoad.nodes.find((n) => n.type === 'blur');
    expect(blurNode).toBeDefined();
    const nodeId = blurNode!.id;
    const paramName = 'blurAmount';
    const originalValue = blurNode!.parameters[paramName] ?? 0;

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
    const presetPath = join(__dirname, '../presets', 'blur-softening.json');
    const json = readFileSync(presetPath, 'utf-8');

    const loadResult = await loadPresetFromJson(json, validationSpecs);
    expect(loadResult.errors, loadResult.errors.join('; ')).toHaveLength(0);
    expect(loadResult.graph).not.toBeNull();
    const graphAfterLoad = loadResult.graph!;

    const blurNode = graphAfterLoad.nodes.find((n) => n.type === 'blur');
    expect(blurNode).toBeDefined();
    const nodeId = blurNode!.id;
    const paramName = 'blurAmount';
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

  it.each(['color-lut-demo', 'color-gradient-demo'])(
    'loads %s preset via loadPreset and compiles without errors',
    async (presetName) => {
      const validationSpecs = toValidationSpecs(nodeSystemSpecs);
      const loadResult = await loadPreset(presetName, validationSpecs);
      expect(loadResult.errors, loadResult.errors.join('; ')).toHaveLength(0);
      expect(loadResult.graph).not.toBeNull();

      const compiler = new NodeShaderCompiler(new Map(nodeSystemSpecs.map((s) => [s.id, s])));
      const compileResult = compiler.compile(loadResult.graph!, loadResult.audioSetup ?? null);
      expect(compileResult.metadata.errors, compileResult.metadata.errors.join('; ')).toHaveLength(
        0
      );
    }
  );

  it('all bundled presets pass validateGraph (incl. automation hard rules)', async () => {
    const validationSpecs = toValidationSpecs(nodeSystemSpecs);
    const presets = await listPresets();
    expect(presets.length).toBeGreaterThan(0);
    for (const p of presets) {
      const r = await loadPreset(p.name, validationSpecs);
      expect(r.errors, `${p.name}: ${r.errors.join('; ')}`).toHaveLength(0);
      expect(r.graph).not.toBeNull();
    }
  });
});

