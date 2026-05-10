<script lang="ts">
  import { DropdownMenu, type DropdownMenuItem } from '../ui';

  interface Props {
    onReadGuide?: (nodeId: string, nodeType: string) => void;
    onCopyNodeName?: (nodeType: string) => void;
    /** Reset stored parameters (and signal input modes) to type defaults — same as a newly placed node */
    onResetParameters?: (nodeId: string, nodeType: string) => void;
    onRemove?: (nodeId: string) => void;
  }

  let {
    onReadGuide,
    onCopyNodeName,
    onResetParameters,
    onRemove,
  }: Props = $props();

  let dropdownMenuRef: import('../ui/DropdownMenu.svelte').default;

  export function show(x: number, y: number, nodeId: string, nodeType: string, options?: { openAbove?: boolean }): void {
    const items: DropdownMenuItem[] = [
      { label: 'Read Guide', iconName: 'book-open-text', action: () => onReadGuide?.(nodeId, nodeType) },
      { label: 'Copy node name', iconName: 'copy', action: () => onCopyNodeName?.(nodeType) },
      { label: 'Reset', iconName: 'arrow-u-up-left', action: () => onResetParameters?.(nodeId, nodeType) },
      { label: 'Remove', iconName: 'trash', action: () => onRemove?.(nodeId) },
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
