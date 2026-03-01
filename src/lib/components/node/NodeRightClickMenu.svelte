<script lang="ts">
  import { DropdownMenu, type DropdownMenuItem } from '../ui';

  interface Props {
    onReadGuide?: (nodeId: string, nodeType: string) => void;
    onCopyNodeName?: (nodeType: string) => void;
    onRemove?: (nodeId: string) => void;
  }

  let {
    onReadGuide,
    onCopyNodeName,
    onRemove,
  }: Props = $props();

  let dropdownMenuRef: import('../ui/DropdownMenu.svelte').default;

  export function show(x: number, y: number, nodeId: string, nodeType: string, options?: { openAbove?: boolean }): void {
    const items: DropdownMenuItem[] = [
      { label: 'Read Guide', action: () => onReadGuide?.(nodeId, nodeType) },
      { label: 'Copy node name', action: () => onCopyNodeName?.(nodeType) },
      { label: 'Remove', action: () => onRemove?.(nodeId) },
    ];
    dropdownMenuRef?.show(x, y, items, options);
  }

  export function hide(): void {
    dropdownMenuRef?.hide();
  }

  export function isVisible(): boolean {
    return dropdownMenuRef?.isVisible() ?? false;
  }
</script>

<DropdownMenu bind:this={dropdownMenuRef} class="node-right-click-menu" />
