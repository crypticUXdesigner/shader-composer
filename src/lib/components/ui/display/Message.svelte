<script lang="ts">
  import type { TransitionConfig } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { Button } from '..';
  import IconSvg from '../icon/IconSvg.svelte';

  const TOAST_DURATION = 240;
  /** Distance from face to cube center (behind the face). Axis at cube center = face arcs around it. */
  const CUBE_CENTER_DEPTH = 36;

  /** In: top face → front face. Rotate around cube center (50% 50% -depth). */
  function flipIn(_node: Element, { duration = TOAST_DURATION }: { duration?: number } = {}): TransitionConfig {
    return {
      duration,
      easing: cubicOut,
      css: (t) => {
        const deg = 90 - 90 * t;
        const opacity = t;
        return `transform-origin: 50% 50% -${CUBE_CENTER_DEPTH}px; transform: rotateX(${deg}deg); opacity: ${opacity}`;
      },
    };
  }

  /** Out: front face → bottom face. Opacity drops faster (power curve) so it fades early. */
  function flipOut(_node: Element, { duration = TOAST_DURATION }: { duration?: number } = {}): TransitionConfig {
    return {
      duration,
      easing: cubicOut,
      css: (t) => {
        const deg = -90 + 90 * t;
        const opacity = 1 - t ** 4;
        return `transform-origin: 50% 50% -${CUBE_CENTER_DEPTH}px; transform: rotateX(${deg}deg); opacity: ${opacity}`;
      },
    };
  }

  interface Props {
    visible?: boolean;
    variant?: 'success' | 'error' | 'info';
    /** When true, renders inline (no fixed position, no visibility/transition). */
    inline?: boolean;
    /** Optional heading shown above the message body (e.g. "What you see:"). */
    heading?: import('svelte').Snippet<[]>;
    /** When true, the variant icon is not shown (e.g. for inline help callouts). */
    hideIcon?: boolean;
    onclose?: () => void;
    onExited?: () => void;
    children?: import('svelte').Snippet<[]>;
    class?: string;
  }

  let {
    visible = false,
    variant = 'success',
    inline = false,
    heading,
    hideIcon = false,
    onclose,
    onExited,
    children,
    class: className = ''
  }: Props = $props();

  let wasVisible = $state(false);
  let deferredVisible = $state(false);

  $effect(() => {
    const v = visible;
    if (v) {
      deferredVisible = false;
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          deferredVisible = true;
        });
      });
      wasVisible = true;
      return () => cancelAnimationFrame(id);
    } else {
      deferredVisible = false;
      if (wasVisible) {
        const id = setTimeout(() => onExited?.(), TOAST_DURATION);
        wasVisible = false;
        return () => clearTimeout(id);
      }
    }
  });
</script>

{#if inline}
  <div
    class="message is-inline {className || ''}"
    class:is-success={variant === 'success'}
    class:is-error={variant === 'error'}
    class:is-info={variant === 'info'}
    class:has-heading={!!heading}
    class:no-icon={hideIcon}
  >
    {#if heading}
      <span class="message-heading">{@render heading()}</span>
    {/if}
    <span class="message-content">
      {#if !hideIcon}
        <span class="icon">
          <IconSvg
            name={variant === 'success' ? 'circle-check' : variant === 'error' ? 'circle-x' : 'help-circle'}
            variant="filled"
          />
        </span>
      {/if}
      {@render children?.()}
    </span>
  </div>
{:else if visible && deferredVisible}
  <div class="message-wrapper">
    <div
      class="message {className || ''}"
      class:is-success={variant === 'success'}
      class:is-error={variant === 'error'}
      class:no-icon={hideIcon}
      in:flipIn={{ duration: TOAST_DURATION }}
      out:flipOut={{ duration: TOAST_DURATION }}
    >
    <span class="message-content">
      {#if !hideIcon}
        <span class="icon">
          <IconSvg name={variant === 'success' ? 'circle-check' : 'circle-x'} variant="filled" />
        </span>
      {/if}
      {@render children?.()}
    </span>
    {#if variant === 'error' && onclose}
      <Button variant="ghost" size="sm" mode="icon-only" onclick={onclose} aria-label="Close">×</Button>
    {/if}
    </div>
  </div>
{/if}

<style>
  /* Wrapper: 3D perspective. Origin below so we look up at the cube (toast at bottom of screen). */
  .message-wrapper {
    position: fixed;
    bottom: calc(var(--bottom-bar-height) + var(--pd-md));
    left: 50%;
    transform: translateX(-50%);
    transform-style: preserve-3d;
    perspective: 400px;
    perspective-origin: 50% 100%;

    /* Message: the rotating face (child gets perspective from wrapper) */
    .message {
      /* Layout */
      transform-origin: center center;
      transform-style: preserve-3d;
      backface-visibility: hidden;
      display: flex;
      align-items: center;
      gap: var(--pd-md);

      /* Box model */
      max-width: var(--message-max-width);
      padding: var(--pd-sm) var(--pd-md);
      border-radius: var(--radius-lg);

      /* Visual */
      box-shadow: var(--message-shadow);

      /* Typography */
      font-family: inherit;
      font-size: var(--message-font-size);
      text-align: center;

      /* Other */
      z-index: var(--message-z-index);
      pointer-events: none;

      .message-content {
        flex: 1;
        min-width: 0;
        display: flex;
        align-items: center;
        gap: var(--pd-md);
      }

      .icon {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        color: inherit;

        :global(svg) {
          width: var(--icon-size-sm);
          height: var(--icon-size-sm);
        }
      }

      &.is-success {
        border: 1px solid var(--layout-message-success-border);
        background: var(--layout-message-success-bg);
        color: var(--layout-message-success-color);
      }

      &.is-error {
        border: 1px solid var(--layout-message-error-border);
        background: var(--layout-message-error-bg);
        color: var(--layout-message-error-color);
        pointer-events: auto;
        text-align: left;
      }
    }
  }

  /* Inline message (no wrapper, no transition) */
  .message.is-inline {
    display: flex;
    align-items: center;
    gap: var(--pd-md);
    transform: none;
    transform-style: flat;
    max-width: none;
    box-shadow: none;
    pointer-events: auto;
    text-align: left;
    font-family: inherit;

    &.has-heading {
      flex-direction: column;
      align-items: stretch;
      gap: var(--pd-2xs);
    }

    .message-heading {
      font-weight: 700;
      font-size: var(--text-sm);
      color: var(--print-subtle);
    }

    .message-content {
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: center;
      gap: var(--pd-md);
      font-size: var(--text-sm);
      line-height: 1.5;
      color: var(--print-highlight);
    }

    .icon {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      color: inherit;
    }

    .icon :global(svg) {
      width: var(--icon-size-sm);
      height: var(--icon-size-sm);
    }

    &.is-info {
      padding: var(--pd-md) var(--pd-lg);
      border-radius: var(--radius-sm);
      background: radial-gradient(
        ellipse 120% 120% at 50% 5%,
        var(--color-blue-gray-70),
        var(--layout-message-info-bg)
      );
      color: var(--layout-message-color);
      box-shadow: 0 0 0 3px var(--layout-message-info-border);

      .message-heading {
        color: var(--layout-message-info-color);
      }
    }
  }
</style>
