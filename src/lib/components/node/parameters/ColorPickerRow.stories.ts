import type { Meta, StoryObj } from '@storybook/svelte-vite';
import Component from './ColorPickerRow.svelte';

const meta = {
  title: "ShaderNoice/node/parameters/ColorPickerRow",
  component: Component,
  tags: ['autodocs'],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    colors: [
      { l: 0.5, c: 0.1, h: 260 },
      { l: 0.7, c: 0.12, h: 220 },
    ],
  },
};

export const ThreeStops: Story = {
  args: {
    colors: [
      { l: 0.15, c: 0.08, h: 260 },
      { l: 0.55, c: 0.12, h: 220 },
      { l: 0.92, c: 0.1, h: 50 },
    ],
  },
};
