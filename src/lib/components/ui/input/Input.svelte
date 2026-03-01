<script lang="ts">
  interface Props {
    variant?: 'primary' | 'secondary' | 'ghost' | 'nudge';
    size?: 'sm' | 'md' | 'lg';
    type?: 'text' | 'number' | 'search';
    value?: string | number;
    placeholder?: string;
    disabled?: boolean;
    class?: string;
    leading?: import('svelte').Snippet<[]>;
    trailing?: import('svelte').Snippet<[]>;
    oninput?: (e: Event) => void;
    onchange?: (e: Event) => void;
    onfocus?: (e: FocusEvent) => void;
    onblur?: (e: FocusEvent) => void;
    [key: string]: unknown;
  }

  let {
    variant = 'primary',
    size = 'md',
    type = 'text',
    value = '',
    placeholder = '',
    disabled = false,
    class: className = '',
    leading,
    trailing,
    oninput,
    onchange,
    onfocus,
    onblur,
    ...restProps
  }: Props = $props();

  const hasSlots = $derived(Boolean(leading ?? trailing));

  // Controlled: value prop drives display; oninput notifies parent
  const strValue = $derived(value === undefined || value === null ? '' : String(value));
</script>

{#if hasSlots}
  <div class="input-wrapper">
    {#if leading}
      <span class="leading">{@render leading()}</span>
    {/if}
    <input
      class="input {variant} {size} {className || ''}"
      {type}
      value={strValue}
      {placeholder}
      {disabled}
      oninput={(e) => {
        oninput?.(e);
      }}
      {onchange}
      {onfocus}
      {onblur}
      {...restProps}
    />
    {#if trailing}
      <span class="trailing">{@render trailing()}</span>
    {/if}
  </div>
{:else}
  <input
    class="input {variant} {size} {className || ''}"
    {type}
    value={strValue}
    {placeholder}
    {disabled}
    oninput={(e) => {
      oninput?.(e);
    }}
    {onchange}
    {onfocus}
    {onblur}
    {...restProps}
  />
{/if}

<style>
  /* Input styles */
  .input {
    /* Layout */
    display: inline-flex;
    align-items: center;
    width: 100%;

    /* Box model */
    border: none;
    box-sizing: border-box;

    /* Typography */
    font-family: inherit;
    font-weight: 500;

    /* Other */
    outline: none;
    transition: background 0.15s, color 0.15s, border-color 0.15s;

    &::placeholder {
      opacity: 1;
    }

    &:disabled {
      opacity: var(--opacity-disabled);
      cursor: not-allowed;
    }

    /* No spinner buttons on number inputs – never */
    &[type='number'] {
      appearance: textfield;
      -moz-appearance: textfield;
    }

    &[type='number']::-webkit-inner-spin-button,
    &[type='number']::-webkit-outer-spin-button {
      appearance: none;
      -webkit-appearance: none;
      margin: 0;
    }

    &.primary {
      border: 1px solid var(--color-gray-40);
      background: var(--color-gray-40);
      color: var(--print-default);
      border-radius: var(--radius-lg);

      &:focus {
        background: var(--color-gray-30);
        border-color: var(--color-gray-90);
      }

      &::placeholder {
        color: var(--color-gray-100);
      }
    }

    &.secondary {
      border: 1px solid var(--color-gray-70);
      background: var(--color-gray-30);
      color: var(--color-gray-130);

      &:focus {
        background: var(--color-gray-40);
        border-color: var(--color-gray-80);
      }

      &::placeholder {
        color: var(--color-gray-100);
      }
    }

    &.ghost {
      background: var(--ghost-bg);
      color: var(--ghost-print);

      &:focus {
        background: var(--ghost-bg-hover);
        border-color: var(--color-gray-70);
      }

      &::placeholder {
        color: var(--color-gray-100);
      }
    }

    &.nudge {
      border: 2px solid var(--color-teal-50);
      background: var(--color-teal-20);
      color: var(--color-teal-130);

      &:focus {
        background: var(--color-teal-10);
        border-color: var(--color-teal-90);
      }

      &::placeholder {
        color: var(--color-teal-70);
      }
    }

    &.sm {
      min-height: var(--size-sm);
      padding: var(--pd-xs) var(--pd-sm);
      border-radius: var(--radius-sm);
      font-size: var(--text-sm);

      &.primary {
        border-radius: var(--radius-xl);
      }
    }

    &.md {
      min-height: var(--size-md);
      padding: var(--pd-sm) var(--pd-lg);
      border-radius: var(--radius-md);
      font-size: var(--text-md);
    }

    &.lg {
      min-height: var(--size-lg);
      padding: var(--pd-md) var(--pd-xl);
      border-radius: var(--radius-xl);
      font-size: var(--text-lg);
    }

    &.menu-input::placeholder {
      color: var(--search-result-desc-color);
    }
  }

  /* Wrapper when leading/trailing slots are used */
  .input-wrapper {
    display: inline-flex;
    align-items: center;
    position: relative;
    width: 100%;
  }

  .input-wrapper:has(.leading) .input {
    padding-left: calc(var(--pd-sm) + var(--input-leading-width, var(--icon-size-sm)) + var(--pd-sm));
  }

  .input-wrapper:has(.trailing) .input {
    padding-right: calc(var(--pd-lg) + var(--input-trailing-width, var(--icon-size-sm)) + var(--pd-sm));
  }

  .input-wrapper .leading {
    display: flex;
    align-items: center;
    justify-content: center;
    position: absolute;
    left: var(--pd-sm);
    top: 50%;
    transform: translateY(-50%);
    z-index: 1;
    width: var(--input-leading-width, var(--icon-size-sm));
    height: var(--input-leading-width, var(--icon-size-sm));
    color: currentColor;
    opacity: 0.7;
    pointer-events: none;
  }

  .input-wrapper .trailing {
    display: flex;
    align-items: center;
    justify-content: center;
    position: absolute;
    right: var(--input-trailing-right, var(--pd-lg));
    top: 50%;
    transform: translateY(-50%);
    z-index: 1;
    width: var(--input-trailing-width, var(--icon-size-sm));
    height: var(--input-trailing-width, var(--icon-size-sm));
    color: currentColor;
    opacity: 0.7;
  }

  .input-wrapper:has(.input.nudge) .leading {
    color: var(--color-teal-70);
  }

  /* Wrapper with both leading and trailing – compact trailing, flex-friendly */
  .input-wrapper:has(.leading):has(.trailing) {
    flex: 1;
    min-width: 0;
    --input-trailing-width: var(--size-xs);
    --input-trailing-right: var(--pd-md);
  }

  .input-wrapper:has(.leading):has(.trailing) :global(.input-clear) {
    width: var(--size-xs);
    height: var(--size-xs);
    padding: 0;
    min-width: var(--size-xs);
    color: var(--color-gray-110);
    opacity: 0.8;
  }

  .input-wrapper:has(.leading):has(.trailing) :global(.input-clear.is-hidden) {
    display: none;
  }
</style>
