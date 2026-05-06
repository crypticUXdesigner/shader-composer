<script lang="ts">
  import { Button, IconSvg, Modal } from '../';
  import type { ButtonVariant } from '../button';
  import { onDestroy } from 'svelte';

  interface Props {
    open?: boolean;
    /** When omitted with showHeaderClose false, Escape/backdrop do not dismiss (blocking modal). */
    onClose?: (() => void) | undefined;
    /** Optional CSS class applied to the Modal content element (`.content.frame`). */
    class?: string;
    /** Size preset for the modal frame. */
    variant?: 'default' | 'confirm' | 'list';

    title: string;
    /** Optional id for aria-labelledby / testing hooks. */
    titleId?: string;

    /** When false, hide the top-right close button. If `onClose` is also omitted on Modal, Escape/backdrop cannot dismiss. */
    showHeaderClose?: boolean;

    secondaryLabel?: string;
    onSecondary?: () => void;
    secondaryVariant?: ButtonVariant;

    primaryLabel?: string;
    onPrimary?: () => void;
    primaryVariant?: ButtonVariant;

    /** Optional topbar rendered inside the body above content. */
    bodyTopbar?: import('svelte').Snippet<[]>;
    /** Controls which element scrolls within the dialog body. */
    bodyScroll?: 'body' | 'content';

    /** Main body content. */
    children?: import('svelte').Snippet<[]>;
    /** Optional footer override. If provided, replaces the default action buttons. */
    footer?: import('svelte').Snippet<[]>;

    /** Optional CSS class applied to the scrollable elevated body surface. */
    bodyClass?: string;
    backdropDismisses?: boolean;
    escapeDismisses?: boolean;
    /** Visible header close stays focusable but does not fire when true. */
    headerCloseDisabled?: boolean;
  }

  let {
    open = false,
    onClose,
    class: className = '',
    variant = 'default',
    title,
    titleId,
    showHeaderClose = true,
    secondaryLabel,
    onSecondary,
    secondaryVariant = 'ghost',
    primaryLabel,
    onPrimary,
    primaryVariant = 'primary',
    bodyTopbar,
    bodyScroll = 'body',
    children,
    footer,
    bodyClass = '',
    backdropDismisses = true,
    escapeDismisses = true,
    headerCloseDisabled = false,
  }: Props = $props();

  let bodyScrollEl: HTMLDivElement | null = $state(null);
  let contentScrollEl: HTMLDivElement | null = $state(null);

  let showFadeTop = $state(false);
  let showFadeBottom = $state(false);

  function recomputeFades(el: HTMLElement | null): void {
    if (!el) {
      showFadeTop = false;
      showFadeBottom = false;
      return;
    }

    const scrollTop = el.scrollTop;
    const maxScrollTop = el.scrollHeight - el.clientHeight;
    const eps = 1;
    showFadeTop = scrollTop > eps;
    showFadeBottom = scrollTop < maxScrollTop - eps;
  }

  function handleScroll(): void {
    const el = bodyScroll === 'content' ? contentScrollEl : bodyScrollEl;
    recomputeFades(el);
  }

  let resizeObserver: ResizeObserver | null = null;
  $effect(() => {
    if (!open) return;

    const el = bodyScroll === 'content' ? contentScrollEl : bodyScrollEl;
    if (!el) return;

    // Initial compute after layout settles.
    requestAnimationFrame(() => recomputeFades(el));
    requestAnimationFrame(() => recomputeFades(el));

    resizeObserver?.disconnect();
    resizeObserver = new ResizeObserver(() => recomputeFades(el));
    resizeObserver.observe(el);

    return () => {
      resizeObserver?.disconnect();
      resizeObserver = null;
    };
  });

  onDestroy(() => {
    resizeObserver?.disconnect();
    resizeObserver = null;
  });
</script>

<Modal
  {open}
  onClose={onClose}
  contentClass={`modal-dialog modal-dialog--${variant} ${className || ''}`}
  backdropDismisses={backdropDismisses}
  escapeDismisses={escapeDismisses}
>
  <div class="modal-dialog-shell">
    <header class="modal-dialog-header">
      <h2 id={titleId} class="modal-dialog-title">{title}</h2>
      {#if showHeaderClose}
        <Button
          variant="ghost"
          size="sm"
          mode="both"
          iconPosition="trailing"
          class="modal-dialog-close-btn"
          disabled={headerCloseDisabled}
          onclick={() => {
            if (!headerCloseDisabled) onClose?.();
          }}
          aria-label="Close dialog"
        >
          Close
          <IconSvg name="x" variant="line" />
        </Button>
      {/if}
    </header>

    <div class="modal-dialog-main">
      <div
        class="modal-dialog-body frame-elevated {bodyClass}"
        class:modal-dialog-body--content-scroll={bodyScroll === 'content'}
        class:modal-dialog-body--body-scroll={bodyScroll === 'body'}
      >
        {#if bodyScroll === 'content'}
          {#if bodyTopbar}
            <div class="modal-dialog-topbar">
              {@render bodyTopbar()}
            </div>
          {/if}

          <div
            class="modal-dialog-scroll-wrap"
            data-fade-top={showFadeTop}
            data-fade-bottom={showFadeBottom}
          >
            <div
              class="modal-dialog-scroll scrollbar-styled"
              bind:this={contentScrollEl}
              onscroll={handleScroll}
            >
              {@render children?.()}
            </div>
          </div>
        {:else}
          <div
            class="modal-dialog-body-scroll-wrap"
            data-fade-top={showFadeTop}
            data-fade-bottom={showFadeBottom}
          >
            <div
              class="modal-dialog-body-scroll scrollbar-styled"
              bind:this={bodyScrollEl}
              onscroll={handleScroll}
            >
              {#if bodyTopbar}
                <div class="modal-dialog-topbar">
                  {@render bodyTopbar()}
                </div>
              {/if}
              {@render children?.()}
            </div>
          </div>
        {/if}
      </div>
    </div>

    {#if footer}
      <footer class="modal-dialog-footer">
        {@render footer()}
      </footer>
    {:else if secondaryLabel || primaryLabel}
      <footer class="modal-dialog-footer">
        <div class="modal-dialog-actions">
          {#if secondaryLabel}
            <Button variant={secondaryVariant} size="md" onclick={onSecondary ?? onClose}>
              {secondaryLabel}
            </Button>
          {/if}
          {#if primaryLabel}
            <Button variant={primaryVariant} size="md" onclick={onPrimary}>
              {primaryLabel}
            </Button>
          {/if}
        </div>
      </footer>
    {/if}
  </div>
</Modal>

<style>
  /* Modal content element is created by `Modal` (portal) so must be global. */
  :global(.content.frame.modal-dialog) {
    /* Match VideoExportDialog modal frame baseline */
    width: min(480px, 94vw);
    min-width: min(360px, 94vw);
    height: min(600px, 90vh);

    display: flex;
    flex-direction: column;
    min-height: 0;
    padding: 0;
  }

  :global(.content.frame.modal-dialog.modal-dialog--confirm) {
    width: min(400px, 94vw);
    min-width: min(320px, 94vw);
    height: auto;
    max-height: min(260px, 86vh);
  }

  :global(.content.frame.modal-dialog.modal-dialog--list) {
    width: min(400px, 94vw);
    min-width: min(320px, 94vw);
    height: min(600px, 90vh);
  }

  .modal-dialog-shell {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }

  .modal-dialog-header {
    position: relative;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--pd-md);
    min-height: var(--size-sm);
    padding: var(--pd-xs) var(--pd-xs) var(--pd-xs) var(--pd-md);
    margin-bottom: var(--pd-md);
    background: transparent;
  }

  .modal-dialog-title {
    margin: 0;
    flex: 1;
    min-width: 0;
    font-size: var(--text-sm);
    font-weight: 500;
    line-height: 1;
    color: var(--color-blue-100);
    letter-spacing: 0;
  }

  :global(.modal-dialog-close-btn.button.sm.ghost) {
    border-radius: calc(var(--radius-md) - var(--pd-xs)) !important;
  }

  .modal-dialog-main {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .modal-dialog-body {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
    width: 100%;
    box-sizing: border-box;
    border-radius: var(--frame-elevated-radius);
    padding: var(--pd-xl);
    gap: var(--pd-md);
  }

  .modal-dialog-body--content-scroll {
    padding: 0;
    gap: 0;
  }

  .modal-dialog-body--body-scroll {
    padding: 0;
    gap: 0;
  }

  .modal-dialog-topbar {
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    min-height: 0;
    padding: var(--pd-md) var(--pd-xl);
  }

  .modal-dialog-scroll-wrap,
  .modal-dialog-body-scroll-wrap {
    position: relative;
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }

  .modal-dialog-scroll {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: auto;
    width: 100%;
    box-sizing: border-box;
    padding: var(--pd-xl);
    gap: var(--pd-md);
  }

  .modal-dialog-body-scroll {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: auto;
    width: 100%;
    box-sizing: border-box;
    padding: var(--pd-xl);
    gap: var(--pd-md);
  }

  /* Scroll hint fades: indicate more content above/below the viewport. */
  .modal-dialog-scroll-wrap::before,
  .modal-dialog-scroll-wrap::after,
  .modal-dialog-body-scroll-wrap::before,
  .modal-dialog-body-scroll-wrap::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    height: 18px;
    pointer-events: none;
    opacity: 0;
    transition: opacity var(--motion-effects-normal-duration) var(--motion-effects-normal-easing);
  }

  .modal-dialog-scroll-wrap::before,
  .modal-dialog-body-scroll-wrap::before {
    top: 0;
    background: linear-gradient(to bottom, var(--frame-elevated-bg) 0%, rgba(0, 0, 0, 0) 100%);
  }

  .modal-dialog-scroll-wrap::after,
  .modal-dialog-body-scroll-wrap::after {
    bottom: 0;
    background: linear-gradient(to top, var(--frame-elevated-bg) 0%, rgba(0, 0, 0, 0) 100%);
  }

  .modal-dialog-scroll-wrap[data-fade-top='true']::before,
  .modal-dialog-body-scroll-wrap[data-fade-top='true']::before {
    opacity: 1;
  }

  .modal-dialog-scroll-wrap[data-fade-bottom='true']::after,
  .modal-dialog-body-scroll-wrap[data-fade-bottom='true']::after {
    opacity: 1;
  }

  .modal-dialog-footer {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    min-height: 0;
    padding: var(--pd-lg) var(--pd-md) var(--pd-md) var(--pd-md);
    background: transparent;
  }

  .modal-dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--pd-md);
  }
</style>

