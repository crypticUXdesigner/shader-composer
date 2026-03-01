<script lang="ts">
  import { fade } from 'svelte/transition';
  import { portal } from '../../../actions/portal';

  let reducedMotion = $state(false);
  $effect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotion = mq.matches;
    const handler = (): void => {
      reducedMotion = mq.matches;
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  });

  interface Props {
    open?: boolean;
    /** Anchor element for positioning; if not provided, use x/y */
    anchor?: HTMLElement | null;
    /** Trigger element – don't close when clicking the trigger (e.g. the port that opened this) */
    triggerElement?: HTMLElement | null;
    /** Fixed position when anchor not used */
    x?: number;
    y?: number;
    /** Position above anchor instead of below */
    openAbove?: boolean;
    /** Horizontal alignment when using x/y: 'start' = top-left at (x,y), 'center' = center at (x,y) */
    align?: 'start' | 'center';
    /** Vertical alignment when using x/y: 'start' = top at y, 'center' = vertical center at y */
    alignY?: 'start' | 'center';
    /** When false, clicking outside does not close the popover (close via Done / Escape only). Default true. */
    closeOnClickOutside?: boolean;
    onClose?: () => void;
    children?: import('svelte').Snippet<[]>;
    class?: string;
  }

  let {
    open = false,
    anchor = null,
    triggerElement = null,
    x = 0,
    y = 0,
    openAbove = false,
    align = 'center',
    alignY = 'start',
    closeOnClickOutside = true,
    onClose,
    children,
    class: className = ''
  }: Props = $props();

  let popoverEl = $state<HTMLElement | null>(null);
  let openedAt = $state<number>(0);

  $effect(() => {
    if (open) {
      openedAt = Date.now();
    }
  });

  function getPosition(): { top: number; left: number } {
    if (anchor) {
      const rect = anchor.getBoundingClientRect();
      const gap = 4; /* one-off: space between anchor and popover edge */
      const left =
        align === 'start' ? rect.left : rect.left + rect.width / 2;
      return {
        top: openAbove ? rect.top - gap : rect.bottom + gap,
        left
      };
    }
    return { top: y, left: x };
  }

  const position = $derived(open ? getPosition() : { top: 0, left: 0 });

  function getTransform(): string {
    const tx = align === 'center' ? '-50%' : '0';
    const tyAnchor = openAbove ? '-100%' : '0';
    if (anchor) {
      return `translate(${tx}, ${tyAnchor})`;
    }
    const ty = alignY === 'center' ? '-50%' : openAbove ? '-100%' : '0';
    if (align === 'start') {
      return openAbove ? `translate(0, ${ty})` : alignY === 'center' ? `translate(0, -50%)` : 'none';
    }
    return `translate(${tx}, ${ty})`;
  }

  const transform = $derived(open ? getTransform() : 'none');

  function handleClickOutside(e: MouseEvent) {
    if (!open || !onClose) return;
    const elapsed = Date.now() - openedAt;
    if (elapsed < 300) return;
    const target = e.target as Node;
    const isOutside =
      popoverEl &&
      !popoverEl.contains(target) &&
      !anchor?.contains(target) &&
      !triggerElement?.contains(target);
    if (isOutside) onClose();
  }

  const INPUT_LIKE_SELECTOR = 'input, textarea, select, [contenteditable="true"]';

  function handleKeydown(e: KeyboardEvent) {
    if (e.key !== 'Escape' || !open || !onClose) return;
    const target = e.target instanceof Element ? e.target : null;
    if (target?.closest(INPUT_LIKE_SELECTOR)) return;
    onClose();
  }

  $effect(() => {
    if (!open) return;
    if (closeOnClickOutside) {
      document.addEventListener('click', handleClickOutside, true);
    }
    document.addEventListener('keydown', handleKeydown);
    return () => {
      if (closeOnClickOutside) {
        document.removeEventListener('click', handleClickOutside, true);
      }
      document.removeEventListener('keydown', handleKeydown);
    };
  });
</script>

{#if open}
  {@const pos = position}
  <div
    bind:this={popoverEl}
    class="popover-base frame {className || ''}"
    style="top: {pos.top}px; left: {pos.left}px; transform: {transform};"
    role="dialog"
    aria-modal="false"
    use:portal
    transition:fade={{ duration: reducedMotion ? 0 : 150 }}
  >
    {@render children?.()}
  </div>
{/if}

<style>
  /* Popover styles */
  .popover-base {
    /* Layout */
    position: fixed;
    display: flex;
    flex-direction: column;

    /* Box model / visual from layer .frame */

    /* Other */
    z-index: var(--message-z-index);
    pointer-events: auto;
  }
</style>
