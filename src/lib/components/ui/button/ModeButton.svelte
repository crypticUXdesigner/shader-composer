<script lang="ts">
  /**
   * ModeButton — Icon-only round button for parameter input mode (override/add/subtract/multiply).
   * Uses param-mode-button tokens. Independent of ParameterCell; can be used anywhere.
   */
  import IconSvg from '../icon/IconSvg.svelte';
  import type { IconName } from '../../../../utils/icons';

  interface Props {
    icon: IconName;
    connected?: boolean;
    disabled?: boolean;
    class?: string;
    onclick?: (e: MouseEvent) => void;
    ariaLabel?: string;
  }

  let {
    icon,
    connected = false,
    disabled = false,
    class: className = '',
    onclick,
    ariaLabel = 'Parameter mode'
  }: Props = $props();
</script>

<button
  type="button"
  class="mode-button {className}"
  class:connected
  disabled={disabled}
  onclick={onclick}
  aria-label={ariaLabel}
>
  <IconSvg name={icon} variant="line" class="mode-button-icon" />
</button>

<style>
  .mode-button {
    /* Layout */
    display: inline-flex;
    align-items: center;
    justify-content: center;

    /* Box model */
    width: var(--size-sm);
    height: var(--size-sm);
    padding: 0;
    border: none;
    border-radius: 50%;

    /* Visual */
    background: var(--color-teal-110);
    color: var(--color-teal-10);

    /* Typography */
    font-family: inherit;

    /* Other */
    cursor: default;
    transition: background 0.15s, color 0.15s;

    > :global(*) {
      pointer-events: none;
    }

    :global(.mode-button-icon) {
      width: var(--icon-size-sm);
      height: var(--icon-size-sm);
    }

    :global(.mode-button-icon svg) {
      stroke-width: 3;
    }



    &:not(:disabled):hover {
      background: var(--color-teal-120);
    }
    &:not(:disabled):active {
      background: var(--color-teal-130);
    }

    &:disabled {
      opacity: var(--opacity-disabled);
      cursor: not-allowed;
    }

    &:focus {
      outline: none;
    }

    &:focus-visible {
      outline: 2px solid var(--color-blue-90);
      outline-offset: 2px;
    }
  }
</style>
