/** @vitest-environment happy-dom */

import { afterEach, describe, expect, it } from 'vitest';
import { mount, unmount } from 'svelte';
import type { NodeGraph } from '../../../data-model/types';
import Node from './Node.svelte';
import { nodeSystemSpecs } from '../../../shaders/nodes';

const rotateSpec = nodeSystemSpecs.find((s) => s.id === 'rotate')!;
const nodeSpecs = new Map(nodeSystemSpecs.map((s) => [s.id, s]));

afterEach(() => {
  document.body.replaceChildren();
});

describe('Node — bypassed visual class', () => {
  it('adds is-bypassed to the root when node.bypassed is true', () => {
    const graph: NodeGraph = {
      id: 'g',
      name: 'g',
      version: '2.0',
      nodes: [],
      connections: [],
    };
    const target = document.createElement('div');
    document.body.appendChild(target);
    const instance = mount(Node, {
      target,
      props: {
        nodeId: 'n1',
        node: {
          id: 'n1',
          type: 'rotate',
          position: { x: 0, y: 0 },
          parameters: { angle: 0, centerX: 0, centerY: 0 },
          bypassed: true,
        },
        spec: rotateSpec,
        metrics: { width: 200, height: 88, headerHeight: 88 },
        selected: false,
        graph,
        audioSetup: { files: [], bands: [], remappers: [] },
        nodeSpecs,
        nodePosition: { x: 0, y: 0 },
        onDrag: () => {},
        onSelect: () => {},
        onLabelChange: () => {},
        onParameterChange: () => {},
      },
    });
    const root = target.querySelector('.node')!;
    expect(root.classList.contains('is-bypassed')).toBe(true);
    unmount(instance);
  });

  it('omits is-bypassed when bypassed is absent or false', () => {
    const graph: NodeGraph = {
      id: 'g',
      name: 'g',
      version: '2.0',
      nodes: [],
      connections: [],
    };
    const target = document.createElement('div');
    document.body.appendChild(target);
    const instance = mount(Node, {
      target,
      props: {
        nodeId: 'n1',
        node: {
          id: 'n1',
          type: 'rotate',
          position: { x: 0, y: 0 },
          parameters: { angle: 0, centerX: 0, centerY: 0 },
        },
        spec: rotateSpec,
        metrics: { width: 200, height: 88, headerHeight: 88 },
        selected: false,
        graph,
        audioSetup: { files: [], bands: [], remappers: [] },
        nodeSpecs,
        nodePosition: { x: 0, y: 0 },
        onDrag: () => {},
        onSelect: () => {},
        onLabelChange: () => {},
        onParameterChange: () => {},
      },
    });
    const root = target.querySelector('.node')!;
    expect(root.classList.contains('is-bypassed')).toBe(false);
    unmount(instance);
  });
});
