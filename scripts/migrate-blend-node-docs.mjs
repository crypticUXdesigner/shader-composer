import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const path = join(__dirname, '../src/data/node-documentation.json');
const root = JSON.parse(readFileSync(path, 'utf8'));
const doc = root.helpItems ?? root;

const blendDoc = {
  title: 'Blend',
  titleType: 'node',
  tagline:
    'Blend two values with Photoshop-style modes — float, vec2, vec3, or vec4 from your wires',
  description:
    'Takes Background and Blend inputs whose type is inferred from connections (defaults to float when unwired). Each component uses the selected blend mode (Normal through Exclusion). Opacity mixes the blended result toward Background. For vec4 only, Alpha chooses Lerp (RGB modes + alpha interpolated) or Blend (apply the mode to alpha as well). Not Porter–Duff compositing; linear channel math in the shader working space.',
  inputs: [
    {
      name: 'base',
      type: 'any',
      description: 'Background layer. Unwired defaults to typed zero.',
      suggestedSources: [
        'type:float',
        'type:vec2',
        'type:vec3',
        'type:vec4',
        'node:mix',
        'node:constant-vec4',
        'node:noise'
      ]
    },
    {
      name: 'blend',
      type: 'any',
      description: 'Blend layer combined onto Background with the selected mode.',
      suggestedSources: [
        'type:float',
        'type:vec2',
        'type:vec3',
        'type:vec4',
        'node:mix',
        'node:gradient',
        'node:blur'
      ]
    }
  ],
  outputs: [
    {
      name: 'out',
      type: 'any',
      description: 'Blended result (same arity as resolved inputs).',
      suggestedTargets: [
        'node:final-output',
        'node:mix',
        'node:color-grading',
        'node:blend',
        'node:tone-mapping'
      ]
    }
  ],
  setupExampleGraph: {
    nodes: [
      { id: 'bg', type: 'constant-vec4' },
      { id: 'fg', type: 'constant-vec4' },
      { id: 'b', type: 'blend' },
      { id: 'out', type: 'final-output' }
    ],
    connections: [
      { from: 'bg', fromPort: 'out', to: 'b', toPort: 'base' },
      { from: 'fg', fromPort: 'out', to: 'b', toPort: 'blend' },
      { from: 'b', fromPort: 'out', to: 'out', toPort: 'in' }
    ]
  },
  relatedItems: ['type:vec4', 'type:float', 'node:mix', 'node:constant-vec4', 'node:select'],
  examples: [
    'Wire two float masks for scalar blending before Final Output.',
    'Chain vec4 color pipelines; use Alpha Lerp for layer-style RGBA.',
    'Pick Overlay or Soft Light and lower Opacity for photo-style tints.'
  ],
  advanced:
    'Mode 0=Normal, 1=Multiply, …, 11=Exclusion. vec4 Alpha Lerp matches former Blend Color; float-only graphs match former Blend Channel.'
};

delete doc['node:blend-mode'];
delete doc['node:blend-color'];
doc['node:blend'] = blendDoc;

if (root.helpItems) {
  root.helpItems = doc;
  delete root['node:blend'];
} else {
  Object.assign(root, doc);
}

let raw = JSON.stringify(root, null, 2);
raw = raw.replaceAll('node:blend-mode', 'node:blend');
raw = raw.replaceAll('node:blend-color', 'node:blend');
raw = raw.replaceAll('"type": "blend-mode"', '"type": "blend"');
raw = raw.replaceAll('"type": "blend-color"', '"type": "blend"');
raw = raw.replaceAll('Blend Color', 'Blend');
raw = raw.replaceAll('Blend Channel', 'Blend');

writeFileSync(path, `${raw}\n`);
console.log('Updated node-documentation.json');
