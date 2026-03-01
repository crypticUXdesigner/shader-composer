<script lang="ts">
  /**
   * BottomBarToolSelector - Canvas tool buttons (Cursor, Hand, Select) for the bottom bar.
   */
  import { Button, ButtonGroup, IconSvg } from '../ui';
  import { graphStore } from '../../stores';
  import type { ToolType } from '../../stores';

  interface ToolDef {
    id: ToolType;
    icon: 'mouse-pointer' | 'hand' | 'lasso';
    shortcut: string;
    label: string;
  }

  interface Props {
    /** Currently effective tool (e.g. hand when spacebar held). */
    effectiveTool: ToolType;
    onToolChange?: (tool: ToolType) => void;
  }

  let { effectiveTool, onToolChange }: Props = $props();

  const tools: ToolDef[] = [
    { id: 'cursor', icon: 'mouse-pointer', shortcut: 'V', label: 'Cursor' },
    { id: 'hand', icon: 'hand', shortcut: 'H', label: 'Hand' },
    { id: 'select', icon: 'lasso', shortcut: 'S', label: 'Select' },
  ];

  function handleToolClick(tool: ToolType) {
    graphStore.setActiveTool(tool);
    onToolChange?.(tool);
  }
</script>

<div class="tool-selector-wrapper">
  <ButtonGroup class="tool-selector">
    {#each tools as tool}
      <Button
        variant="ghost"
        size="sm"
        mode="both"
        class={effectiveTool === tool.id ? 'is-active' : ''}
        title="{tool.label} ({tool.shortcut})"
        data-tool={tool.id}
        onclick={() => handleToolClick(tool.id)}
      >
        <IconSvg name={tool.icon} />
        <span>{tool.shortcut}</span>
      </Button>
    {/each}
  </ButtonGroup>
</div>
