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
    onClose?: () => void;
    children?: import('svelte').Snippet<[]>;
    class?: string;
  }

  let {
    open = false,
    onClose,
    children,
    class: className = ''
  }: Props = $props();

  let contentEl = $state<HTMLElement | null>(null);
  let savedFocus: HTMLElement | null = null;

  function getFocusableElements(el: HTMLElement): HTMLElement[] {
    const selector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    return Array.from(el.querySelectorAll<HTMLElement>(selector)).filter(
      (node) => !node.hasAttribute('disabled') && node.offsetParent !== null
    );
  }

  $effect(() => {
    if (!open) return;
    savedFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
      savedFocus?.focus();
    };
  });

  $effect(() => {
    if (open && contentEl) {
      const focusable = getFocusableElements(contentEl);
      if (focusable.length > 0) {
        focusable[0].focus();
      }
    }
  });

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && open && onClose) {
      onClose();
      return;
    }
    if (
      e.key !== 'Tab' ||
      !open ||
      !contentEl ||
      !contentEl.contains(document.activeElement as Node)
    ) {
      return;
    }
    const focusable = getFocusableElements(contentEl);
    if (focusable.length === 0) return;
    const active = document.activeElement as HTMLElement | null;
    const idx = active ? focusable.indexOf(active) : -1;
    if (e.shiftKey) {
      if (idx <= 0) {
        e.preventDefault();
        focusable[focusable.length - 1].focus();
      }
    } else {
      if (idx === -1 || idx >= focusable.length - 1) {
        e.preventDefault();
        focusable[0].focus();
      }
    }
  }

  $effect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  });
</script>

{#if open}
  <div
    class="modal-backdrop"
    role="dialog"
    aria-modal="true"
    onclick={(e) => e.target === e.currentTarget && onClose?.()}
    use:portal
    transition:fade={{ duration: reducedMotion ? 0 : 150 }}
  >
  <div
    bind:this={contentEl}
    class="content frame {className || ''}"
      onclick={(e) => e.stopPropagation()}
    >
      {@render children?.()}
    </div>
  </div>
{/if}

<style>
  /* Modal styles */
  .modal-backdrop {
    /* Layout */
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;

    /* Visual */
    background: var(--search-dialog-overlay, rgba(0, 0, 0, 0.5));

    /* Other */
    z-index: 9998;
    pointer-events: auto;

    .content {
      /* Layout */
      position: relative;
      display: flex;
      flex-direction: column;

      /* Box model: from layer .frame; overrides for modal */
      max-width: 90vw; /* one-off */
      max-height: 90vh; /* one-off */

      /* Other */
      z-index: 9999;
      pointer-events: auto;
    }
  }
</style>
