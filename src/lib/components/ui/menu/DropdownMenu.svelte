<script lang="ts">
  import Popover from '../overlay/Popover.svelte';
  import MenuItem from './MenuItem.svelte';
  import type { DropdownMenuItem } from './menuTypes';

  interface Props {
    /** Declarative: controlled open state */
    open?: boolean;
    /** Declarative: position when using declarative API */
    x?: number;
    y?: number;
    /** Declarative: anchor element for positioning */
    anchor?: HTMLElement | null;
    /** openAbove option */
    openAbove?: boolean;
    /** Declarative: custom content via snippet */
    children?: import('svelte').Snippet<[]>;
    /** Imperative: items for simple list (when using show()) */
    items?: DropdownMenuItem[];
    /** Horizontal alignment: 'start' = left edge at x, 'center' = center at x */
    align?: 'start' | 'center';
    /** Vertical alignment: 'start' = top at y, 'center' = vertical center at y */
    alignY?: 'start' | 'center';
    /** Position so the selected item's center aligns with (x,y). Overrides align/alignY. */
    anchorToSelected?: boolean;
    onClose?: () => void;
    class?: string;
  }

  let {
    open: openProp = false,
    x: xProp = 0,
    y: yProp = 0,
    anchor = null,
    openAbove: openAboveProp = false,
    children: contentSnippet,
    items: itemsProp = [],
    align: alignProp = 'start',
    alignY: alignYProp = 'start',
    anchorToSelected: anchorToSelectedProp = false,
    onClose,
    class: className = ''
  }: Props = $props();

  const viewportPadding = 8;

  let visible = $state(false);
  let rawX = $state(0);
  let rawY = $state(0);
  let imperativeItems = $state<DropdownMenuItem[]>([]);
  let imperativeOpenAbove = $state(false);
  let imperativeAlign = $state<'start' | 'center'>('start');
  let imperativeAlignY = $state<'start' | 'center'>('start');
  let imperativeAnchorToSelected = $state(false);
  let menuEl = $state<HTMLElement | null>(null);

  const isDeclarative = $derived(contentSnippet !== undefined);
  const isImperative = $derived(!isDeclarative);
  /** Controlled mode: parent passes open, x, y, items (no contentSnippet) */
  const isControlledItems = $derived(!contentSnippet && itemsProp.length > 0);

  const effectiveOpen = $derived(
    isControlledItems ? openProp : isDeclarative ? openProp : visible
  );
  const effectiveItems = $derived(
    isControlledItems ? itemsProp : isImperative ? imperativeItems : itemsProp
  );
  const effectiveOpenAbove = $derived(
    isControlledItems ? openAboveProp : isDeclarative ? openAboveProp : imperativeOpenAbove
  );
  const effectiveAlign = $derived(
    isControlledItems ? alignProp : isDeclarative ? alignProp : imperativeAlign
  );
  const effectiveAlignY = $derived(
    isControlledItems ? alignYProp : isDeclarative ? alignYProp : imperativeAlignY
  );
  const effectiveAnchorToSelected = $derived(
    isControlledItems ? anchorToSelectedProp : isDeclarative ? anchorToSelectedProp : imperativeAnchorToSelected
  );

  const computedPosition = $derived.by(() => {
    if (!effectiveOpen || !menuEl) {
      return { x: rawX, y: rawY, useStartAlign: false };
    }
    const measureEl = menuEl.parentElement ?? menuEl;
    const rect = measureEl.getBoundingClientRect();
    const x = isDeclarative || isControlledItems ? xProp : rawX;
    const y = isDeclarative || isControlledItems ? yProp : rawY;

    let menuLeft = x;
    let menuTop: number;
    let useStartAlign = false;

    if (effectiveAnchorToSelected) {
      const selectedEl = menuEl.querySelector(':scope > .menu-item.is-selected');
      if (selectedEl) {
        const selectedRect = selectedEl.getBoundingClientRect();
        const offsetFromMenuTopToSelectedCenter =
          selectedRect.top - rect.top + selectedRect.height / 2;
        menuTop = y - offsetFromMenuTopToSelectedCenter;
      } else {
        menuTop = y - rect.height / 2;
      }
      menuLeft = x - rect.width / 2;
      useStartAlign = true;

      if (menuTop < viewportPadding) {
        menuTop = viewportPadding;
      }
      if (menuTop + rect.height > window.innerHeight - viewportPadding) {
        menuTop = window.innerHeight - rect.height - viewportPadding;
      }
      if (menuLeft < viewportPadding) {
        menuLeft = viewportPadding;
      }
      if (menuLeft + rect.width > window.innerWidth - viewportPadding) {
        menuLeft = window.innerWidth - rect.width - viewportPadding;
      }
    } else if (effectiveAlignY === 'center') {
      menuTop = y;
      const menuTopEdge = menuTop - rect.height / 2;
      const menuBottomEdge = menuTop + rect.height / 2;
      if (menuTopEdge < viewportPadding) {
        menuTop = viewportPadding + rect.height / 2;
      }
      if (menuBottomEdge > window.innerHeight - viewportPadding) {
        menuTop = window.innerHeight - viewportPadding - rect.height / 2;
      }
    } else if (effectiveOpenAbove) {
      menuTop = y - rect.height - viewportPadding;
    } else {
      menuTop = y;
      const spaceBelow = window.innerHeight - (menuTop + rect.height);
      const spaceAbove = menuTop;
      if (spaceBelow < 0 && spaceAbove >= rect.height) {
        menuTop = y - rect.height - viewportPadding;
      } else if (spaceBelow < 0) {
        menuTop = Math.max(viewportPadding, window.innerHeight - rect.height - viewportPadding);
      }
    }
    if (!effectiveAnchorToSelected && effectiveAlignY !== 'center' && menuTop < viewportPadding) {
      menuTop = viewportPadding;
    }
    if (!effectiveAnchorToSelected) {
      if (effectiveAlign === 'center') {
        if (rect.right > window.innerWidth - viewportPadding) {
          menuLeft = window.innerWidth - rect.width / 2 - viewportPadding;
        }
        if (rect.left < viewportPadding) {
          menuLeft = viewportPadding + rect.width / 2;
        }
      } else {
        if (rect.right > window.innerWidth - viewportPadding) {
          menuLeft = window.innerWidth - rect.width - viewportPadding;
        }
        if (menuLeft < viewportPadding) {
          menuLeft = viewportPadding;
        }
      }
    }
    return { x: menuLeft, y: menuTop, useStartAlign: useStartAlign || false };
  });

  const position = $derived(
    effectiveOpen && menuEl
      ? { x: computedPosition.x, y: computedPosition.y }
      : { x: isDeclarative || isControlledItems ? xProp : rawX, y: isDeclarative || isControlledItems ? yProp : rawY }
  );
  const popoverAlign = $derived(computedPosition.useStartAlign ? 'start' : effectiveAlign);
  const popoverAlignY = $derived(computedPosition.useStartAlign ? 'start' : effectiveAlignY);

  export function show(x: number, y: number, items: DropdownMenuItem[], options?: { openAbove?: boolean; align?: 'start' | 'center'; alignY?: 'start' | 'center'; anchorToSelected?: boolean }): void {
    rawX = x;
    rawY = y;
    imperativeItems = items;
    imperativeOpenAbove = options?.openAbove ?? false;
    imperativeAlign = options?.align ?? 'start';
    imperativeAlignY = options?.alignY ?? 'start';
    imperativeAnchorToSelected = options?.anchorToSelected ?? false;
    visible = true;
  }

  export function hide(): void {
    visible = false;
    onClose?.();
  }

  export function isVisible(): boolean {
    return effectiveOpen;
  }

  function handleClose() {
    if (isImperative && !isControlledItems) {
      visible = false;
    }
    onClose?.();
  }

  function handleItemAction(item: DropdownMenuItem) {
    item.action();
    hide();
  }
</script>

{#if effectiveOpen}
  <Popover
    open={effectiveOpen}
    anchor={isDeclarative ? anchor : null}
    x={position.x}
    y={position.y}
    openAbove={effectiveOpenAbove}
    align={popoverAlign}
    alignY={popoverAlignY}
    onClose={handleClose}
    class="dropdown-menu menu-wrapper is-visible {className}"
  >
    <div bind:this={menuEl} class="menu-wrapper-inner" role="menu">
      {#if contentSnippet}
        {@render contentSnippet()}
      {:else}
        {#each effectiveItems as item (item.label)}
          <MenuItem
            label={item.label}
            disabled={item.disabled}
            selected={item.selected}
            onclick={() => handleItemAction(item)}
          />
        {/each}
      {/if}
    </div>
  </Popover>
{/if}
