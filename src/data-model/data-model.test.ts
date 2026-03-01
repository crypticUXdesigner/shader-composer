/**
 * Unit Tests for Data Model Module
 *
 * Run: npm test (or npx vitest run src/data-model/data-model.test.ts)
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { describe, it } from 'vitest';
import {
  type NodeGraph,
  type NodeInstance,
  validateGraph,
  validateNoDuplicateConnections,
  addConnectionWithValidation,
  serializeGraph,
  deserializeGraph,
  deserializeGraphUnvalidated,
  generateNodeId,
  generateConnectionId,
  generateGraphId,
  getParameterValue,
  coerceParameterValue,
  createEmptyGraph,
  findNode,
  findConnection,
  getConnectionsFromNode,
  getConnectionsToNode,
  setAutomationDuration,
  type NodeSpecification,
} from './index';

// Simple test helper (can be replaced with test framework assertions)
function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(
      `Assertion failed: ${message || 'Values not equal'}\n  Expected: ${expected}\n  Actual: ${actual}`
    );
  }
}

const __dirname = dirname(fileURLToPath(import.meta.url));

// Test data: Sample node specifications
const mockNodeSpecs: NodeSpecification[] = [
  {
    id: 'uv-coordinates',
    outputs: [{ name: 'out', type: 'vec2' }],
    parameters: {},
  },
  {
    id: 'noise',
    inputs: [{ name: 'in', type: 'vec2' }],
    outputs: [{ name: 'out', type: 'float' }],
    parameters: {
      noiseScale: { type: 'float', default: 2.0, min: 0.1, max: 10.0 },
      noiseOctaves: { type: 'int', default: 4, min: 1, max: 8 },
      noiseIntensity: { type: 'float', default: 0.5, min: 0.0, max: 1.0 },
    },
  },
  {
    id: 'final-output',
    inputs: [{ name: 'in', type: 'vec4' }],
    parameters: {
      alpha: { type: 'float', default: 1.0, min: 0.0, max: 1.0 },
    },
  },
  {
    id: 'multiply',
    inputs: [
      { name: 'a', type: 'float' },
      { name: 'b', type: 'float' },
    ],
    outputs: [{ name: 'out', type: 'float' }],
    parameters: {},
  },
];

// Test: Create empty graph
export function testCreateEmptyGraph(): void {
  const graph = createEmptyGraph('Test Graph');
  assert(graph.name === 'Test Graph', 'Graph name should match');
  assert(graph.version === '2.0', 'Graph version should be 2.0');
  assert(graph.nodes.length === 0, 'Graph should have no nodes');
  assert(graph.connections.length === 0, 'Graph should have no connections');
  assert(graph.id.length > 0, 'Graph should have an ID');
}

// Test: ID generation
export function testIdGeneration(): void {
  const nodeId1 = generateNodeId();
  const nodeId2 = generateNodeId();
  assert(nodeId1 !== nodeId2, 'Generated node IDs should be unique');

  const connId1 = generateConnectionId();
  const connId2 = generateConnectionId();
  assert(connId1 !== connId2, 'Generated connection IDs should be unique');

  const graphId1 = generateGraphId();
  const graphId2 = generateGraphId();
  assert(graphId1 !== graphId2, 'Generated graph IDs should be unique');

  // Test collision avoidance
  const existingIds = new Set(['node-1', 'node-2']);
  const newId = generateNodeId(existingIds);
  assert(!existingIds.has(newId), 'Generated ID should not collide with existing IDs');
}

// Test: Parameter value retrieval
export function testGetParameterValue(): void {
  const nodeSpec = mockNodeSpecs.find(s => s.id === 'noise')!;
  const node: NodeInstance = {
    id: 'n1',
    type: 'noise',
    position: { x: 0, y: 0 },
    parameters: {
      noiseScale: 3.0,
    },
  };

  // Parameter exists in node
  const scale = getParameterValue(node, 'noiseScale', nodeSpec);
  assertEqual(scale, 3.0, 'Should return parameter value from node');

  // Parameter missing, use default
  const octaves = getParameterValue(node, 'noiseOctaves', nodeSpec);
  assertEqual(octaves, 4, 'Should return default value from spec');

  // Parameter missing, no spec, use type default
  const intensity = getParameterValue(node, 'noiseIntensity', nodeSpec);
  assertEqual(intensity, 0.5, 'Should return default value from spec');
}

// Test: Parameter value coercion
export function testCoerceParameterValue(): void {
  assertEqual(coerceParameterValue('5', 'int'), 5, 'String "5" should coerce to int 5');
  assertEqual(coerceParameterValue(5.7, 'int'), 6, 'Float 5.7 should round to int 6');
  assertEqual(coerceParameterValue('2.5', 'float'), 2.5, 'String "2.5" should coerce to float 2.5');
  assertEqual(coerceParameterValue(5, 'string'), '5', 'Number 5 should coerce to string "5"');

  const vec4 = coerceParameterValue([1, 2, 3, 4], 'vec4');
  assert(Array.isArray(vec4) && vec4.length === 4, 'Should coerce to vec4 array');
  if (Array.isArray(vec4)) {
    assertEqual(vec4[0], 1, 'Vec4 first element should be 1');
  }
}

// Test: Graph validation - valid graph
export function testValidateValidGraph(): void {
  const graph: NodeGraph = {
    id: 'g1',
    name: 'Test Graph',
    version: '2.0',
    nodes: [
      {
        id: 'n1',
        type: 'uv-coordinates',
        position: { x: 0, y: 0 },
        parameters: {},
      },
      {
        id: 'n2',
        type: 'noise',
        position: { x: 100, y: 0 },
        parameters: {
          noiseScale: 2.0,
          noiseOctaves: 4,
        },
      },
    ],
    connections: [
      {
        id: 'c1',
        sourceNodeId: 'n1',
        sourcePort: 'out',
        targetNodeId: 'n2',
        targetPort: 'in',
      },
    ],
  };

  const result = validateGraph(graph, mockNodeSpecs);
  assert(result.valid === true, 'Valid graph should pass validation');
  assert(result.errors.length === 0, 'Valid graph should have no errors');
}

// Test: Graph validation - missing required fields
export function testValidateMissingFields(): void {
  const graph = {
    name: 'Test',
    version: '2.0',
    nodes: [],
    connections: [],
  } as unknown as NodeGraph;

  const result = validateGraph(graph, mockNodeSpecs);
  assert(result.valid === false, 'Graph missing id should fail validation');
  assert(result.errors.length > 0, 'Should have validation errors');
}

// Test: Graph validation - duplicate node IDs
export function testValidateDuplicateNodeIds(): void {
  const graph: NodeGraph = {
    id: 'g1',
    name: 'Test',
    version: '2.0',
    nodes: [
      {
        id: 'n1',
        type: 'uv-coordinates',
        position: { x: 0, y: 0 },
        parameters: {},
      },
      {
        id: 'n1', // Duplicate!
        type: 'uv-coordinates',
        position: { x: 100, y: 0 },
        parameters: {},
      },
    ],
    connections: [],
  };

  const result = validateGraph(graph, mockNodeSpecs);
  assert(result.valid === false, 'Graph with duplicate node IDs should fail validation');
  assert(
    result.errors.some(e => e.includes('Duplicate node ID')),
    'Should have error about duplicate node ID'
  );
}

// Test: Graph validation - orphaned connection
export function testValidateOrphanedConnection(): void {
  const graph: NodeGraph = {
    id: 'g1',
    name: 'Test',
    version: '2.0',
    nodes: [
      {
        id: 'n1',
        type: 'uv-coordinates',
        position: { x: 0, y: 0 },
        parameters: {},
      },
    ],
    connections: [
      {
        id: 'c1',
        sourceNodeId: 'n1',
        sourcePort: 'out',
        targetNodeId: 'n2', // Non-existent node!
        targetPort: 'in',
      },
    ],
  };

  const result = validateGraph(graph, mockNodeSpecs);
  assert(result.valid === false, 'Graph with orphaned connection should fail validation');
  assert(
    result.errors.some(e => e.includes('non-existent')),
    'Should have error about non-existent node'
  );
}

// Test: Graph validation - invalid parameter value
export function testValidateInvalidParameter(): void {
  const graph: NodeGraph = {
    id: 'g1',
    name: 'Test',
    version: '2.0',
    nodes: [
      {
        id: 'n1',
        type: 'noise',
        position: { x: 0, y: 0 },
        parameters: {
          noiseScale: 'invalid', // Should be number!
        },
      },
    ],
    connections: [],
  };

  const result = validateGraph(graph, mockNodeSpecs);
  assert(result.valid === false, 'Graph with invalid parameter should fail validation');
  assert(
    result.errors.some(e => e.includes('invalid parameter value type')),
    'Should have error about invalid parameter type'
  );
}

// Test: Graph validation - parameter out of range
export function testValidateParameterOutOfRange(): void {
  const graph: NodeGraph = {
    id: 'g1',
    name: 'Test',
    version: '2.0',
    nodes: [
      {
        id: 'n1',
        type: 'noise',
        position: { x: 0, y: 0 },
        parameters: {
          noiseScale: 20.0, // Out of range (max is 10.0)!
        },
      },
    ],
    connections: [],
  };

  const result = validateGraph(graph, mockNodeSpecs);
  assert(result.valid === false, 'Graph with parameter out of range should fail validation');
  assert(
    result.errors.some(e => e.includes('out of range')),
    'Should have error about parameter out of range'
  );
}

// Test: Serialization
export function testSerializeGraph(): void {
  const graph: NodeGraph = {
    id: 'g1',
    name: 'Test Graph',
    version: '2.0',
    nodes: [
      {
        id: 'n1',
        type: 'uv-coordinates',
        position: { x: 0, y: 0 },
        parameters: {},
      },
    ],
    connections: [],
  };

  const json = serializeGraph(graph);
  assert(json.includes('"format": "shader-composer-node-graph"'), 'Should include format');
  assert(json.includes('"formatVersion": "2.0"'), 'Should include format version');
  assert(json.includes('"graph"'), 'Should include graph data');
}

// Test: Deserialization - valid JSON
export function testDeserializeValidGraph(): void {
  const json = `{
    "format": "shader-composer-node-graph",
    "formatVersion": "2.0",
    "graph": {
      "id": "g1",
      "name": "Test Graph",
      "version": "2.0",
      "nodes": [
        {
          "id": "n1",
          "type": "uv-coordinates",
          "position": { "x": 0, "y": 0 },
          "parameters": {}
        }
      ],
      "connections": []
    }
  }`;

  const result = deserializeGraph(json, mockNodeSpecs);
  assert(result.graph !== null, 'Should deserialize valid graph');
  assert(result.errors.length === 0, 'Should have no errors');
  if (result.graph) {
    assertEqual(result.graph.name, 'Test Graph', 'Graph name should match');
    assertEqual(result.graph.nodes.length, 1, 'Should have one node');
  }
}

// Test: Serialization/deserialization with automation
export function testSerializeDeserializeGraphWithAutomation(): void {
  const graphWithAutomation: NodeGraph = {
    id: 'g1',
    name: 'Test Graph',
    version: '2.0',
    nodes: [
      {
        id: 'n1',
        type: 'noise',
        position: { x: 0, y: 0 },
        parameters: { noiseScale: 2 },
      },
    ],
    connections: [],
    automation: {
      bpm: 120,
      durationSeconds: 30,
      lanes: [
        {
          id: 'lane1',
          nodeId: 'n1',
          paramName: 'noiseScale',
          regions: [
            {
              id: 'r1',
              startTime: 0,
              duration: 10,
              loop: true,
              curve: {
                keyframes: [{ time: 0, value: 0 }, { time: 1, value: 1 }],
                interpolation: 'linear',
              },
            },
          ],
        },
      ],
    },
  };

  const json = serializeGraph(graphWithAutomation);
  assert(json.includes('"automation"'), 'Serialized JSON should include automation');
  assert(json.includes('"lanes"'), 'Serialized JSON should include lanes');

  const result = deserializeGraph(json, mockNodeSpecs);
  assert(result.graph !== null, 'Should deserialize graph with automation');
  if (result.graph) {
    assert(result.graph.automation != null, 'Automation should be preserved');
    assertEqual(result.graph.automation!.bpm, 120, 'BPM should match');
    assertEqual(result.graph.automation!.durationSeconds, 30, 'Duration should match');
    assertEqual(result.graph.automation!.lanes.length, 1, 'Should have one lane');
    assertEqual(result.graph.automation!.lanes[0].regions[0].curve.keyframes.length, 2, 'Curve keyframes should match');
  }
}

// Test: Deserialization - graph without automation (backward compat)
export function testDeserializeGraphWithoutAutomation(): void {
  const json = `{
    "format": "shader-composer-node-graph",
    "formatVersion": "2.0",
    "graph": {
      "id": "g1",
      "name": "Test Graph",
      "version": "2.0",
      "nodes": [],
      "connections": []
    }
  }`;
  const result = deserializeGraph(json, mockNodeSpecs);
  assert(result.graph !== null, 'Should deserialize graph without automation');
  assert(result.graph?.automation === undefined, 'automation should be undefined when missing');
}

// Test: Deserialization - invalid format
export function testDeserializeInvalidFormat(): void {
  const json = `{
    "format": "wrong-format",
    "formatVersion": "2.0",
    "graph": {}
  }`;

  const result = deserializeGraph(json, mockNodeSpecs);
  assert(result.graph === null, 'Should reject invalid format');
  assert(result.errors.length > 0, 'Should have errors');
}

// Test: Deserialization - unsupported formatVersion
export function testDeserializeUnsupportedFormatVersion(): void {
  const json = `{
    "format": "shader-composer-node-graph",
    "formatVersion": "999.0",
    "graph": {
      "id": "g1",
      "name": "Test Graph",
      "version": "2.0",
      "nodes": [],
      "connections": []
    }
  }`;

  const result = deserializeGraph(json, mockNodeSpecs);
  assert(result.graph === null, 'Should reject unsupported format version');
  assert(
    result.errors.some(e => e.includes('Unsupported format version')),
    'Should report unsupported format version error'
  );
}

// Test: Deserialization - missing formatVersion (negative path for migration registry)
export function testDeserializeMissingFormatVersion(): void {
  const json = `{
    "format": "shader-composer-node-graph",
    "graph": {
      "id": "g1",
      "name": "Test Graph",
      "version": "2.0",
      "nodes": [],
      "connections": []
    }
  }`;

  const result = deserializeGraph(json, mockNodeSpecs);
  assert(result.graph === null, 'Should reject payload with missing formatVersion');
  assert(
    result.errors.some(e => e.includes('format version') || e.includes('formatVersion')),
    'Should report format version error'
  );
}

// Test: Deserialization applies audio band-remap → remappers migration via registry (inline JSON)
export function testDeserializeAppliesBandRemapMigration(): void {
  const bandId = 'node-1770318840638-0u4geobd0';
  const json = `{
    "format": "shader-composer-node-graph",
    "formatVersion": "2.0",
    "graph": {
      "id": "g1",
      "name": "Test",
      "version": "2.0",
      "nodes": [
        { "id": "n1", "type": "multiply", "position": { "x": 0, "y": 0 }, "parameters": {} }
      ],
      "connections": [
        {
          "id": "c1",
          "sourceNodeId": "audio-signal:band-${bandId}-remap",
          "sourcePort": "out",
          "targetNodeId": "n1",
          "targetPort": "a"
        }
      ]
    },
    "audioSetup": {
      "files": [{ "id": "f1", "name": "File", "autoPlay": false }],
      "bands": [
        {
          "id": "${bandId}",
          "name": "Highs",
          "sourceFileId": "f1",
          "frequencyBands": [[2568, 20000]],
          "smoothing": 0.03,
          "fftSize": 4096,
          "remapInMin": 0,
          "remapInMax": 0.52,
          "remapOutMin": 0.51,
          "remapOutMax": 1
        }
      ],
      "remappers": []
    }
  }`;

  const result = deserializeGraph(json, mockNodeSpecs);
  assert(result.graph !== null, 'Graph should deserialize successfully');
  assert(result.audioSetup != null, 'audioSetup should be present after deserialize');

  const audioSetup = result.audioSetup!;
  assertEqual(audioSetup.remappers.length, 1, 'One remapper should be created for the band');
  const remapper = audioSetup.remappers[0] as { id: string; bandId: string };
  assertEqual(remapper.id, `band-${bandId}`, 'Remapper id should follow band-{bandId} convention');
  assertEqual(remapper.bandId, bandId, 'Remapper bandId should match band id');

  const graph = result.graph!;
  assertEqual(graph.connections.length, 1, 'Graph should have one connection after migration');
  const conn = graph.connections[0];
  assertEqual(
    conn.sourceNodeId,
    `audio-signal:remap-band-${bandId}`,
    'Connection source should point to remap virtual node after migration'
  );
}

// Test: Deserialization applies audio band-remap → remappers migration via registry (fixture file)
export function testDeserializeAppliesBandRemapMigrationFromFixture(): void {
  const fixturePath = join(__dirname, '__fixtures__', 'audio-band-remap-migration.json');
  const json = readFileSync(fixturePath, 'utf-8');

  const result = deserializeGraph(json, mockNodeSpecs);
  assert(result.graph !== null, 'Graph should deserialize successfully from fixture');
  assert(result.audioSetup != null, 'audioSetup should be present after deserialize (fixture)');

  const audioSetup = result.audioSetup!;
  assertEqual(audioSetup.remappers.length, 1, 'One remapper should be created for the band (fixture)');
  const remapper = audioSetup.remappers[0] as { id: string; bandId: string };
  assertEqual(remapper.id, 'band-node-1770318840638-0u4geobd0', 'Remapper id should follow band-{bandId} convention (fixture)');
  assertEqual(remapper.bandId, 'node-1770318840638-0u4geobd0', 'Remapper bandId should match band id (fixture)');

  const graph = result.graph!;
  assertEqual(graph.connections.length, 1, 'Graph should have one connection after migration (fixture)');
  const conn = graph.connections[0];
  assertEqual(
    conn.sourceNodeId,
    'audio-signal:remap-band-node-1770318840638-0u4geobd0',
    'Connection source should point to remap virtual node after migration (fixture)'
  );
}

// Test: Deserialization of an already-migrated file (no band-remap usage) is idempotent via registry (fixture file)
export function testDeserializeBandRemapMigrationIdempotentFromFixture(): void {
  const fixturePath = join(
    __dirname,
    '__fixtures__',
    'audio-band-remap-migration-idempotent.json'
  );
  const json = readFileSync(fixturePath, 'utf-8');

  const first = deserializeGraph(json, mockNodeSpecs);
  assert(first.graph !== null, 'Graph should deserialize successfully from idempotent fixture');
  assert(first.audioSetup != null, 'audioSetup should be present after deserialize (idempotent fixture)');

  const audioSetup1 = first.audioSetup!;
  assertEqual(
    audioSetup1.remappers.length,
    1,
    'Idempotent fixture should have exactly one remapper'
  );
  const remapper1 = audioSetup1.remappers[0] as { id: string; bandId: string };
  assertEqual(
    remapper1.id,
    'band-node-1770318840638-0u4geobd0',
    'Remapper id should use band-{bandId} convention (idempotent fixture)'
  );
  assertEqual(
    remapper1.bandId,
    'node-1770318840638-0u4geobd0',
    'Remapper bandId should match band id (idempotent fixture)'
  );

  const graph1 = first.graph!;
  assertEqual(
    graph1.connections.length,
    1,
    'Graph should have one connection after deserialize (idempotent fixture)'
  );
  const conn1 = graph1.connections[0];
  assertEqual(
    conn1.sourceNodeId,
    'audio-signal:remap-band-node-1770318840638-0u4geobd0',
    'Connection source should already point to remap virtual node before migration (idempotent fixture)'
  );

  // Round-trip through serialize/deserialize should not introduce additional changes.
  const reserialized = serializeGraph(graph1, false, audioSetup1);
  const second = deserializeGraph(reserialized, mockNodeSpecs);
  assert(second.graph !== null, 'Graph should deserialize successfully on second pass');
  assert(second.audioSetup != null, 'audioSetup should remain present on second pass');

  const graph2 = second.graph!;
  const audioSetup2 = second.audioSetup!;
  assertEqual(
    JSON.stringify(graph2),
    JSON.stringify(graph1),
    'Graph should be unchanged by re-deserializing an already-migrated file'
  );
  assertEqual(
    JSON.stringify(audioSetup2),
    JSON.stringify(audioSetup1),
    'audioSetup should be unchanged by re-deserializing an already-migrated file'
  );
}

// Test: Deserialization skips band-remap migration safely when audioSetup is missing
export function testDeserializeBandRemapMigrationSkipsWhenAudioSetupMissing(): void {
  const bandId = 'node-missing-audio-band';
  const json = `{
    "format": "shader-composer-node-graph",
    "formatVersion": "2.0",
    "graph": {
      "id": "g1",
      "name": "Test (no audioSetup)",
      "version": "2.0",
      "nodes": [
        { "id": "n1", "type": "multiply", "position": { "x": 0, "y": 0 }, "parameters": {} }
      ],
      "connections": [
        {
          "id": "c1",
          "sourceNodeId": "audio-signal:band-${bandId}-remap",
          "sourcePort": "out",
          "targetNodeId": "n1",
          "targetPort": "a"
        }
      ]
    }
  }`;

  const result = deserializeGraph(json, mockNodeSpecs);
  assert(result.graph !== null, 'Graph should deserialize successfully when audioSetup is missing');
  assertEqual(result.errors.length, 0, 'Deserializing graph without audioSetup should not add errors');
  assert(result.audioSetup === undefined, 'audioSetup should be undefined when missing from file');

  const graph = result.graph!;
  assertEqual(graph.connections.length, 1, 'Graph should still have one connection');
  const conn = graph.connections[0];
  assertEqual(
    conn.sourceNodeId,
    `audio-signal:band-${bandId}-remap`,
    'Connection source should remain legacy band-remap virtual node when audioSetup is missing'
  );
}

// Test: deserializeGraphUnvalidated also applies the band-remap → remappers migration via registry
export function testDeserializeUnvalidatedAppliesBandRemapMigration(): void {
  const bandId = 'node-1770318840638-0u4geobd0';
  const json = `{
    "format": "shader-composer-node-graph",
    "formatVersion": "2.0",
    "graph": {
      "id": "g1",
      "name": "Test (unvalidated)",
      "version": "2.0",
      "nodes": [
        { "id": "n1", "type": "multiply", "position": { "x": 0, "y": 0 }, "parameters": {} }
      ],
      "connections": [
        {
          "id": "c1",
          "sourceNodeId": "audio-signal:band-${bandId}-remap",
          "sourcePort": "out",
          "targetNodeId": "n1",
          "targetPort": "a"
        }
      ]
    },
    "audioSetup": {
      "files": [{ "id": "f1", "name": "File", "autoPlay": false }],
      "bands": [
        {
          "id": "${bandId}",
          "name": "Highs",
          "sourceFileId": "f1",
          "frequencyBands": [[2568, 20000]],
          "smoothing": 0.03,
          "fftSize": 4096,
          "remapInMin": 0,
          "remapInMax": 0.52,
          "remapOutMin": 0.51,
          "remapOutMax": 1
        }
      ],
      "remappers": []
    }
  }`;

  const result = deserializeGraphUnvalidated(json);
  assert(result.graph !== null, 'Graph should deserialize successfully via unvalidated path');
  assert(result.audioSetup != null, 'audioSetup should be present after unvalidated deserialize');

  const audioSetup = result.audioSetup!;
  assertEqual(
    audioSetup.remappers.length,
    1,
    'One remapper should be created for the band via unvalidated path'
  );
  const remapper = audioSetup.remappers[0] as { id: string; bandId: string };
  assertEqual(
    remapper.id,
    `band-${bandId}`,
    'Remapper id should follow band-{bandId} convention via unvalidated path'
  );
  assertEqual(remapper.bandId, bandId, 'Remapper bandId should match band id via unvalidated path');

  const graph = result.graph!;
  assertEqual(graph.connections.length, 1, 'Graph should have one connection after migration');
  const conn = graph.connections[0];
  assertEqual(
    conn.sourceNodeId,
    `audio-signal:remap-band-${bandId}`,
    'Connection source should point to remap virtual node after migration via unvalidated path'
  );
}

// Test: Deserialization - invalid JSON
export function testDeserializeInvalidJSON(): void {
  const json = '{ invalid json }';

  const result = deserializeGraph(json, mockNodeSpecs);
  assert(result.graph === null, 'Should reject invalid JSON');
  assert(result.errors.length > 0, 'Should have parse errors');
}

// Test: Graph helpers - find node
export function testFindNode(): void {
  const graph: NodeGraph = {
    id: 'g1',
    name: 'Test',
    version: '2.0',
    nodes: [
      {
        id: 'n1',
        type: 'uv-coordinates',
        position: { x: 0, y: 0 },
        parameters: {},
      },
    ],
    connections: [],
  };

  const node = findNode(graph, 'n1');
  assert(node !== undefined, 'Should find existing node');
  assertEqual(node?.id, 'n1', 'Found node should have correct ID');

  const notFound = findNode(graph, 'n2');
  assert(notFound === undefined, 'Should not find non-existent node');
}

// Test: Graph helpers - find connection
export function testFindConnection(): void {
  const graph: NodeGraph = {
    id: 'g1',
    name: 'Test',
    version: '2.0',
    nodes: [
      { id: 'n1', type: 'uv-coordinates', position: { x: 0, y: 0 }, parameters: {} },
      { id: 'n2', type: 'noise', position: { x: 100, y: 0 }, parameters: {} },
    ],
    connections: [
      {
        id: 'c1',
        sourceNodeId: 'n1',
        sourcePort: 'out',
        targetNodeId: 'n2',
        targetPort: 'in',
      },
    ],
  };

  const conn = findConnection(graph, 'c1');
  assert(conn !== undefined, 'Should find existing connection');
  assertEqual(conn?.id, 'c1', 'Found connection should have correct ID');

  const notFound = findConnection(graph, 'c2');
  assert(notFound === undefined, 'Should not find non-existent connection');
}

// Test: Graph helpers - get connections from/to node
export function testGetConnections(): void {
  const graph: NodeGraph = {
    id: 'g1',
    name: 'Test',
    version: '2.0',
    nodes: [
      { id: 'n1', type: 'uv-coordinates', position: { x: 0, y: 0 }, parameters: {} },
      { id: 'n2', type: 'noise', position: { x: 100, y: 0 }, parameters: {} },
      { id: 'n3', type: 'final-output', position: { x: 200, y: 0 }, parameters: {} },
    ],
    connections: [
      {
        id: 'c1',
        sourceNodeId: 'n1',
        sourcePort: 'out',
        targetNodeId: 'n2',
        targetPort: 'in',
      },
      {
        id: 'c2',
        sourceNodeId: 'n2',
        sourcePort: 'out',
        targetNodeId: 'n3',
        targetPort: 'in',
      },
    ],
  };

  const fromN1 = getConnectionsFromNode(graph, 'n1');
  assertEqual(fromN1.length, 1, 'Should find one connection from n1');
  assertEqual(fromN1[0].id, 'c1', 'Connection should be c1');

  const toN2 = getConnectionsToNode(graph, 'n2');
  assertEqual(toN2.length, 1, 'Should find one connection to n2');
  assertEqual(toN2[0].id, 'c1', 'Connection should be c1');
}

// Test: Empty graph validation
export function testValidateEmptyGraph(): void {
  const graph: NodeGraph = {
    id: 'g-empty',
    name: 'Empty Graph',
    version: '2.0',
    nodes: [],
    connections: [],
  };

  const result = validateGraph(graph, mockNodeSpecs);
  assert(result.valid === true, 'Empty graph should be valid');
}

// Test: Single node graph validation
export function testValidateSingleNodeGraph(): void {
  const graph: NodeGraph = {
    id: 'g1',
    name: 'Single Node',
    version: '2.0',
    nodes: [
      {
        id: 'n1',
        type: 'uv-coordinates',
        position: { x: 0, y: 0 },
        parameters: {},
      },
    ],
    connections: [],
  };

  const result = validateGraph(graph, mockNodeSpecs);
  assert(result.valid === true, 'Single node graph should be valid');
}

// Test: Duplicate connection validation (port and parameter)
export function testValidateNoDuplicateConnections(): void {
  const existingConnections = [
    {
      id: 'c1',
      sourceNodeId: 'n1',
      sourcePort: 'out',
      targetNodeId: 'n2',
      targetPort: 'in',
    },
    {
      id: 'c1b',
      sourceNodeId: 'n1',
      sourcePort: 'out',
      targetNodeId: 'n2',
      targetParameter: 'noiseScale',
    },
  ];

  // Valid: different target port
  const validConn = {
    id: 'c2',
    sourceNodeId: 'n3',
    sourcePort: 'out',
    targetNodeId: 'n2',
    targetPort: 'other', // Different port
  };
  const result1 = validateNoDuplicateConnections(validConn, existingConnections);
  assert(result1.valid === true, 'Connection to different port should be valid');

  // Invalid: same target port
  const invalidConn = {
    id: 'c3',
    sourceNodeId: 'n3',
    sourcePort: 'out',
    targetNodeId: 'n2',
    targetPort: 'in', // Same port as existing
  };
  const result2 = validateNoDuplicateConnections(invalidConn, existingConnections);
  assert(result2.valid === false, 'Connection to same port should be invalid');
  assert(result2.error !== undefined, 'Should have error message');

  // Invalid: same target parameter
  const paramConn = {
    id: 'c4',
    sourceNodeId: 'n3',
    sourcePort: 'out',
    targetNodeId: 'n2',
    targetParameter: 'noiseScale',
  };
  const result3 = validateNoDuplicateConnections(paramConn, existingConnections);
  assert(result3.valid === false, 'Connection to same parameter should be invalid');
  assert(result3.error !== undefined, 'Should have error message for parameter duplicate');
}

// Test: addConnectionWithValidation enforces invariants and replaces existing connections for same target
export function testAddConnectionWithValidation(): void {
  const graph: NodeGraph = {
    id: 'g1',
    name: 'Test',
    version: '2.0',
    nodes: [
      { id: 'n1', type: 'uv-coordinates', position: { x: 0, y: 0 }, parameters: {} },
      {
        id: 'n2',
        type: 'noise',
        position: { x: 100, y: 0 },
        parameters: { noiseScale: 2.0, noiseOctaves: 4 },
      },
    ],
    connections: [
      {
        id: 'c-existing',
        sourceNodeId: 'n1',
        sourcePort: 'out',
        targetNodeId: 'n2',
        targetPort: 'in',
      },
    ],
  };

  const specs = mockNodeSpecs;

  // Happy path: new connection to same targetPort should replace existing and keep graph valid.
  const newConn = {
    id: 'c-new',
    sourceNodeId: 'n1',
    sourcePort: 'out',
    targetNodeId: 'n2',
    targetPort: 'in',
  };
  const result1 = addConnectionWithValidation(graph, newConn, specs);
  assert(result1.errors.length === 0, 'Valid connection should have no errors');
  assertEqual(result1.graph.connections.length, 1, 'Should still have exactly one connection');
  const onlyConn = result1.graph.connections[0];
  assertEqual(onlyConn.id, 'c-new', 'Existing connection should be replaced by new one');
  assertEqual(
    result1.replacedConnectionId,
    'c-existing',
    'Result should report the replaced connection id'
  );

  // Invalid: connection with both targetPort and targetParameter set.
  const invalidConn = {
    id: 'c-invalid',
    sourceNodeId: 'n1',
    sourcePort: 'out',
    targetNodeId: 'n2',
    targetPort: 'in',
    targetParameter: 'noiseScale',
  } as unknown as NodeInstance; // will be treated as Connection shape at call site
  const result2 = addConnectionWithValidation(
    graph,
    invalidConn as unknown as import('./types').Connection,
    specs
  );
  assert(
    result2.errors.some((e) => e.includes('exactly one of targetPort or targetParameter')),
    'Connection with both targetPort and targetParameter should be rejected'
  );
  assertEqual(
    result2.graph.connections.length,
    graph.connections.length,
    'Graph should be unchanged for invalid connection'
  );
}

// Test: setAutomationDuration returns new graph with clamped duration
export function testSetAutomationDuration(): void {
  const graphWithoutAutomation: NodeGraph = {
    id: 'g1',
    name: 'Test',
    version: '2.0',
    nodes: [{ id: 'n1', type: 'noise', position: { x: 0, y: 0 }, parameters: {} }],
    connections: [],
  };
  const updated = setAutomationDuration(graphWithoutAutomation, 60);
  assert(updated.automation != null, 'Should create automation when missing');
  assertEqual(updated.automation!.durationSeconds, 60, 'Duration should be set');
  const clampedZero = setAutomationDuration(graphWithoutAutomation, 0);
  assert(clampedZero.automation != null && clampedZero.automation!.durationSeconds > 0, 'Duration should be clamped to positive');
  const withAutomation: NodeGraph = {
    ...graphWithoutAutomation,
    automation: { bpm: 120, durationSeconds: 30, lanes: [] },
  };
  const updated2 = setAutomationDuration(withAutomation, 45);
  assertEqual(updated2.automation!.durationSeconds, 45, 'Existing automation duration should update');
  assert(updated2.automation!.bpm === 120, 'BPM should be unchanged');
}

// Test: Validation warns for int parameter in automation lane (float-only)
export function testValidateAutomationIntLaneWarning(): void {
  const graph: NodeGraph = {
    id: 'g1',
    name: 'Test',
    version: '2.0',
    nodes: [
      {
        id: 'n1',
        type: 'noise',
        position: { x: 0, y: 0 },
        parameters: { noiseScale: 2, noiseOctaves: 4 },
      },
    ],
    connections: [],
    automation: {
      bpm: 120,
      durationSeconds: 30,
      lanes: [
        {
          id: 'lane1',
          nodeId: 'n1',
          paramName: 'noiseOctaves',
          regions: [],
        },
      ],
    },
  };
  const result = validateGraph(graph, mockNodeSpecs);
  assert(result.warnings.some((w) => w.includes('noiseOctaves') && w.includes('int') && w.includes('float')), 'Should warn that int param is not supported for automation');
}

// Test: Connection invariant - exactly one of targetPort or targetParameter (03B)
export function testValidateConnectionInvariant(): void {
  const graphWithBoth: NodeGraph = {
    id: 'g1',
    name: 'Test',
    version: '2.0',
    nodes: [
      { id: 'n1', type: 'uv-coordinates', position: { x: 0, y: 0 }, parameters: {} },
      { id: 'n2', type: 'noise', position: { x: 100, y: 0 }, parameters: { noiseScale: 2 } },
    ],
    connections: [
      {
        id: 'c1',
        sourceNodeId: 'n1',
        sourcePort: 'out',
        targetNodeId: 'n2',
        targetPort: 'in',
        targetParameter: 'noiseScale', // invalid: both set
      },
    ],
  };
  const r1 = validateGraph(graphWithBoth, mockNodeSpecs);
  assert(r1.valid === false, 'Connection with both targetPort and targetParameter should fail');
  assert(r1.errors.some(e => e.includes('exactly one')), 'Should report exactly-one error');

  const graphWithNeither: NodeGraph = {
    id: 'g1',
    name: 'Test',
    version: '2.0',
    nodes: [
      { id: 'n1', type: 'uv-coordinates', position: { x: 0, y: 0 }, parameters: {} },
      { id: 'n2', type: 'noise', position: { x: 100, y: 0 }, parameters: { noiseScale: 2 } },
    ],
    connections: [
      {
        id: 'c1',
        sourceNodeId: 'n1',
        sourcePort: 'out',
        targetNodeId: 'n2',
        // neither targetPort nor targetParameter
      },
    ],
  };
  const r2 = validateGraph(graphWithNeither, mockNodeSpecs);
  assert(r2.valid === false, 'Connection with neither targetPort nor targetParameter should fail');
  assert(r2.errors.some(e => e.includes('exactly one') || e.includes('missing targetPort')), 'Should report missing target');
}

describe('data-model', () => {
  it('createEmptyGraph', testCreateEmptyGraph);
  it('idGeneration', testIdGeneration);
  it('getParameterValue', testGetParameterValue);
  it('coerceParameterValue', testCoerceParameterValue);
  it('validateValidGraph', testValidateValidGraph);
  it('validateMissingFields', testValidateMissingFields);
  it('validateDuplicateNodeIds', testValidateDuplicateNodeIds);
  it('validateOrphanedConnection', testValidateOrphanedConnection);
  it('validateInvalidParameter', testValidateInvalidParameter);
  it('validateParameterOutOfRange', testValidateParameterOutOfRange);
  it('serializeGraph', testSerializeGraph);
  it('deserializeValidGraph', testDeserializeValidGraph);
  it('serializeDeserializeGraphWithAutomation', testSerializeDeserializeGraphWithAutomation);
  it('deserializeGraphWithoutAutomation', testDeserializeGraphWithoutAutomation);
  it('deserializeInvalidFormat', testDeserializeInvalidFormat);
  it('deserializeUnsupportedFormatVersion', testDeserializeUnsupportedFormatVersion);
  it('deserializeMissingFormatVersion', testDeserializeMissingFormatVersion);
  it('deserializeAppliesBandRemapMigration', testDeserializeAppliesBandRemapMigration);
  it('deserializeAppliesBandRemapMigrationFromFixture', testDeserializeAppliesBandRemapMigrationFromFixture);
  it(
    'deserializeBandRemapMigrationIdempotentFromFixture',
    testDeserializeBandRemapMigrationIdempotentFromFixture
  );
  it(
    'deserializeBandRemapMigrationSkipsWhenAudioSetupMissing',
    testDeserializeBandRemapMigrationSkipsWhenAudioSetupMissing
  );
  it(
    'deserializeUnvalidatedAppliesBandRemapMigration',
    testDeserializeUnvalidatedAppliesBandRemapMigration
  );
  it('deserializeInvalidJSON', testDeserializeInvalidJSON);
  it('findNode', testFindNode);
  it('findConnection', testFindConnection);
  it('getConnections', testGetConnections);
  it('validateEmptyGraph', testValidateEmptyGraph);
  it('validateSingleNodeGraph', testValidateSingleNodeGraph);
  it('validateNoDuplicateConnections', testValidateNoDuplicateConnections);
  it('addConnectionWithValidation', testAddConnectionWithValidation);
  it('validateConnectionInvariant', testValidateConnectionInvariant);
  it('setAutomationDuration', testSetAutomationDuration);
  it('validateAutomationIntLaneWarning', testValidateAutomationIntLaneWarning);
});
