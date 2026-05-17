import type { Meta, StoryObj } from '@storybook/svelte-vite';
import Component from './ColorMapPreview.svelte';
import { colorLutNodeSpec } from '../../../../shaders/nodes/color-lut';
import { colorGradientNodeSpec } from '../../../../shaders/nodes/color-gradient';
import type { NodeInstance } from '../../../../data-model/types';

const meta = {
  title: 'ShaderNoice/node/parameters/ColorMapPreview',
  component: Component,
  tags: ['autodocs'],
} satisfies Meta<typeof Component>;

export default meta;
type Story = StoryObj<typeof meta>;

function lutNode(parameters: Record<string, number> = {}): NodeInstance {
  return {
    id: 'lut-preview',
    type: 'color-lut',
    position: { x: 0, y: 0 },
    parameters: { preset: 0, reverse: 0, gamma: 1, contrast: 0, intensity: 1, ...parameters },
  };
}

function gradientNode(parameters: Record<string, number> = {}): NodeInstance {
  const defaults: Record<string, number> = {
    gradientMode: 0,
    stop0L: 0.15,
    stop0C: 0.08,
    stop0H: 260,
    stop1L: 0.55,
    stop1C: 0.12,
    stop1H: 220,
    stop2L: 0.92,
    stop2C: 0.1,
    stop2H: 50,
    stop0T: 0,
    stop1T: 0.5,
    stop2T: 1,
  };
  return {
    id: 'gradient-preview',
    type: 'color-gradient',
    position: { x: 0, y: 0 },
    parameters: { ...defaults, ...parameters },
  };
}

export const LutViridis: Story = {
  args: {
    node: lutNode(),
    spec: colorLutNodeSpec,
    mode: 'lut',
    height: 24,
  },
};

export const LutTurbo: Story = {
  args: {
    node: lutNode({ preset: 5, gamma: 1.2 }),
    spec: colorLutNodeSpec,
    mode: 'lut',
    height: 24,
  },
};

export const ThreeStopDefault: Story = {
  args: {
    node: gradientNode(),
    spec: colorGradientNodeSpec,
    mode: 'three-stop',
    height: 24,
  },
};

export const ThreeStopWideMiddle: Story = {
  args: {
    node: gradientNode({ stop1T: 0.75, stop2H: 120 }),
    spec: colorGradientNodeSpec,
    mode: 'three-stop',
    height: 24,
  },
};
