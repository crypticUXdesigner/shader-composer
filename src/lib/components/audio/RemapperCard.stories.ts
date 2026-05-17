import type { Meta, StoryObj } from '@storybook/svelte-vite';
import type { AudioRemapperEntry } from '../../../data-model/audioSetupTypes';
import Component from './RemapperCard.svelte';

const mockRemapper: AudioRemapperEntry = {
  id: 'story-remapper',
  name: 'Level',
  bandId: 'story-band',
  inMin: 0,
  inMax: 1,
  outMin: 0,
  outMax: 1,
};

const meta = {
  title: "ShaderNoice/audio/RemapperCard",
  component: Component,
  tags: ['autodocs'],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    remapper: mockRemapper,
  },
};

export const WithDuplicate: Story = {
  args: {
    remapper: mockRemapper,
    onDuplicate: () => {},
  },
};
