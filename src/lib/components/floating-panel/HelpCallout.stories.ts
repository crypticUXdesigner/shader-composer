import type { Meta, StoryObj } from '@storybook/svelte-vite';
import Component from './HelpCallout.svelte';

const meta = {
  title: "ShaderNoice/floating-panel/HelpCallout",
  component: Component,
  tags: ['autodocs'],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  args: {
    visible: true,
    positionMode: 'center',
    screenX: 520,
    screenY: 340,
    helpMode: 'overview',
  },
};

export const NodeGuideEmpty: Story = {
  args: {
    visible: true,
    positionMode: 'center',
    screenX: 520,
    screenY: 340,
    helpMode: 'node',
  },
};
