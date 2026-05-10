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
    /** Horizontal alignment: 'start' = left edge, 'center' = center, 'end' = right edge at x */
    align?: 'start' | 'center' | 'end';
    /** Vertical alignment: 'start' = top at y, 'center' = vertical center at y */
    alignY?: 'start' | 'center';
    /** Position so the selected item's center aligns with (x,y). Overrides align/alignY. */
    anchorToSelected?: boolean;
    /** Extra x offset applied after anchor alignment (px). */
    offsetX?: number;
    /** Extra y offset applied after anchor alignment (px). */
    offsetY?: number;
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
    offsetX = 0,
    offsetY = 0,
    onClose,
    class: className = ''
  }: Props = $props();

  const viewportPadding = 8;

  let visible = $state(false);
  let rawX = $state(0);
  let rawY = $state(0);
  let imperativeItems = $state<DropdownMenuItem[]>([]);
  let imperativeOpenAbove = $state(false);
  let imperativeAlign = $state<'start' | 'center' | 'end'>('start');
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
    const anchorRect = anchor?.getBoundingClientRect() ?? null;
    const gap = 12;
    const anchorX = anchorRect
      ? effectiveAlign === 'start'
        ? anchorRect.left
        : effectiveAlign === 'end'
          ? anchorRect.right
          : anchorRect.left + anchorRect.width / 2
      : null;
    const anchorY = anchorRect
      ? effectiveAlignY === 'center'
        ? anchorRect.top + anchorRect.height / 2
        : effectiveOpenAbove
          ? anchorRect.top - gap
          : anchorRect.bottom + gap
      : null;
    const measureEl = menuEl.parentElement ?? menuEl;
    const rect = measureEl.getBoundingClientRect();
    const x =
      (isDeclarative || isControlledItems) && anchorX !== null ? anchorX : isDeclarative || isControlledItems ? xProp : rawX;
    const y =
      (isDeclarative || isControlledItems) && anchorY !== null ? anchorY : isDeclarative || isControlledItems ? yProp : rawY;

    // We position the popover using top/left with no transforms.
    let menuLeft =
      (effectiveAlign === 'center'
        ? x - rect.width / 2
        : effectiveAlign === 'end'
          ? x - rect.width
          : x) + offsetX;
    let menuTop: number = y + offsetY;
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
    } else if (effectiveAlignY === 'center') {
      menuTop = y - rect.height / 2;
    } else if (effectiveOpenAbove) {
      menuTop = y - rect.height;
    } else {
      menuTop = y;
    }

    // Clamp to viewport (top-left coordinate system).
    menuTop = Math.max(viewportPadding, Math.min(menuTop, window.innerHeight - rect.height - viewportPadding));
    menuLeft = Math.max(viewportPadding, Math.min(menuLeft, window.innerWidth - rect.width - viewportPadding));

    return { x: menuLeft, y: menuTop, useStartAlign: useStartAlign || false };
  });

  const position = $derived(
    effectiveOpen && menuEl
      ? { x: computedPosition.x, y: computedPosition.y }
      : {
          x:
            isDeclarative || isControlledItems
              ? (() => {
                  const r = anchor?.getBoundingClientRect() ?? null;
                  if (!r) return xProp;
                  return effectiveAlign === 'start'
                    ? r.left
                    : effectiveAlign === 'end'
                      ? r.right
                      : r.left + r.width / 2;
                })()
              : rawX,
          y:
            isDeclarative || isControlledItems
              ? (() => {
                  const r = anchor?.getBoundingClientRect() ?? null;
                  if (!r) return yProp;
                  return effectiveOpenAbove ? r.top : r.bottom;
                })()
              : rawY
        }
  );
  const popoverAlign = 'start';
  const popoverAlignY = 'start';

  export function show(
    x: number,
    y: number,
    items: DropdownMenuItem[],
    options?: {
      openAbove?: boolean;
      align?: 'start' | 'center' | 'end';
      alignY?: 'start' | 'center';
      anchorToSelected?: boolean;
    }
  ): void {
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
    anchor={null}
    triggerElement={anchor}
    x={position.x}
    y={position.y}
    openAbove={false}
    align={popoverAlign}
    alignY={popoverAlignY}
    onClose={handleClose}
    class="dropdown-menu scrollbar-styled menu-wrapper is-visible {className}"
  >
    <div bind:this={menuEl} class="menu-wrapper-inner scrollbar-styled" role="menu">
      {#if contentSnippet}
        {@render contentSnippet()}
      {:else}
        {#each effectiveItems as item (item.label)}
          <MenuItem
            label={item.label}
            disabled={item.disabled}
            selected={item.selected}
            iconName={item.iconName}
            iconVariant={item.iconVariant}
            onclick={() => handleItemAction(item)}
          />
        {/each}
      {/if}
    </div>
  </Popover>
{/if}
