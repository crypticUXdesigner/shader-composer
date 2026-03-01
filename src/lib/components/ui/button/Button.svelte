<script lang="ts">
  interface Props {
    variant?: 'primary' | 'secondary' | 'ghost' | 'warning';
    size?: 'sm' | 'md' | 'lg';
    mode?: 'icon-only' | 'label-only' | 'both';
    iconPosition?: 'leading' | 'trailing';
    rounded?: boolean;
    disabled?: boolean;
    class?: string;
    onclick?: (e: MouseEvent) => void;
    children?: import('svelte').Snippet<[]>;
    [key: string]: unknown;
  }

  let {
    variant = 'primary',
    size = 'md',
    mode = 'both',
    iconPosition = 'leading',
    rounded = false,
    disabled = false,
    class: className = '',
    onclick,
    children,
    ...restProps
  }: Props = $props();

  const { class: _omitClass, ...safeRest } = restProps as Record<string, unknown>;
</script>

<button
  class="button {variant} {size} {mode} {className || ''} {_omitClass || ''}"
  class:rounded
  class:icon-trailing={mode === 'both' && iconPosition === 'trailing'}
  disabled={disabled}
  class:disabled={disabled}
  {onclick}
  {...safeRest}
>
  {@render children?.()}
</button>

<style>
  /* Button styles */
  .button {
    /* Layout */
    display: inline-flex;
    align-items: center;
    justify-content: center;

    /* Box model */
    border: none;
    box-sizing: border-box;

    /* Typography */
    font-family: inherit;
    font-weight: 500;
    line-height: 1;

    /* Other */
    cursor: default;
    outline: none;

    &.primary {
      background: var(--primary-bg);
      color: var(--primary-print);
      border: 1px solid var(--primary-border);

      &:hover {
        background: var(--primary-bg-hover);
        color: var(--primary-print-hover);
        border-color: var(--primary-border-hover);
      }

      &:active {
        background: var(--primary-bg-active);
        color: var(--primary-print-active);
        border-color: var(--primary-border-active);
      }

      &:not(.rounded) {
        border-radius: var(--radius-lg);
      }
    }

    &.secondary {
      background: var(--secondary-bg);
      color: var(--secondary-print);

      &:hover {
        background: var(--secondary-bg-hover);
        color: var(--secondary-print-hover);
      }

      &:active {
        background: var(--secondary-bg-active);
        color: var(--secondary-print-active);
      }

      &:not(.rounded) {
        border-radius: var(--radius-lg);
      }
    }

    &.ghost {
      background: var(--ghost-bg);
      color: var(--ghost-print);

      &:hover {
        background: var(--ghost-bg-hover);
        color: var(--ghost-print-hover);
      }

      &:active,
      &.is-active {
        color: var(--ghost-print-active);
        background: var(--ghost-bg-active);
        background: radial-gradient(
          ellipse 60% 90% at 50% 51%,
          var(--ghost-print-active-g1) 0%,
          var(--ghost-print-active-g2) 100%
        );
      }

      &:not(.rounded) {
        border-radius: var(--radius-lg);
      }
    }

    &.warning {
      background: var(--warning-bg);
      color: var(--warning-print);
      border: 1px solid var(--warning-bg);

      &:hover {
        background: var(--warning-bg-hover);
        color: var(--warning-print-hover);
        border-color: var(--warning-bg-hover);
      }

      &:active {
        background: var(--warning-bg-active);
        color: var(--warning-print-active);
        border-color: var(--warning-bg-active);
      }

      &:not(.rounded) {
        border-radius: var(--radius-lg);
      }
    }

    &.sm {
      min-height: var(--size-sm);
      padding: var(--pd-xs) var(--pd-md);
      gap: var(--pd-sm);
      font-size: var(--text-sm);

      &:not(.rounded) {
        border-radius: var(--radius-md);
      }

      &.icon-only {
        width: var(--size-md);
        height: var(--size-sm);
        min-width: var(--size-md);
        padding: 0;
      }
    }

    &.md {
      min-height: var(--size-md);
      padding: var(--pd-sm) var(--pd-lg);
      gap: var(--pd-sm);
      font-size: var(--text-md);

      &:not(.rounded) {
        border-radius: var(--radius-lg);
      }

      &.icon-only {
        width: var(--size-md);
        height: var(--size-md);
        min-width: var(--size-md);
        padding: 0;
      }
    }

    &.lg {
      min-width: var(--size-lg);
      padding: var(--pd-md) var(--pd-xl);
      gap: var(--pd-sm);
      font-size: var(--text-lg);

      &:not(.rounded) {
        border-radius: var(--radius-xl);
      }

      &.icon-only {
        height: var(--size-lg);
        min-width: var(--size-lg);
        padding: 0;
      }
    }

    &.icon-only,
    &.both {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    &.rounded {
      border-radius: 50%;
    }

    &:disabled,
    &.disabled {
      opacity: var(--opacity-disabled);
      cursor: not-allowed;
      pointer-events: none;
    }
  }
</style>
