import type { Meta, StoryObj } from '@storybook/svelte-vite';
import Component from './NodeHeader.svelte';
import { nodeSystemSpecs } from '../../../shaders/nodes';

const rotateSpec = nodeSystemSpecs.find((s) => s.id === 'rotate')!;

const meta = {
  title: "ShaderNoice/node/NodeHeader",
  component: Component,
  tags: ['autodocs'],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    spec: rotateSpec,
    label: '',
    headerHeight: 260,
    nodePosition: { x: 0, y: 0 },
    nodeId: 'story-node',
    onLabelChange: () => {},
    onDragStart: () => {},
  },
};
