<script lang="ts">
  interface Props {
    min?: number;
    max?: number;
    step?: number;
    value?: number;
    oninput?: (e: Event) => void;
    disabled?: boolean;
    class?: string;
    [key: string]: unknown;
  }

  let props: Props = $props();
  let {
    min = 0,
    max = 100,
    step = 1,
    value = min,
    oninput,
    disabled = false,
    class: className = '',
    ...restProps
  } = props;

  let internalValue = $state(value);
  $effect(() => {
    internalValue = props.value ?? props.min ?? 0;
  });

  const progress = $derived(((internalValue - min) / (max - min || 1)) * 100);
</script>

<input
  type="range"
  class="slider {className || ''}"
  {min}
  {max}
  {step}
  bind:value={internalValue}
  {disabled}
  style="--slider-progress: {progress}%"
  oninput={(e) => {
    internalValue = (e.currentTarget as HTMLInputElement).valueAsNumber;
    oninput?.(e);
  }}
  {...restProps}
/>

<style>
  .slider {
    /* Layout */
    flex: 1;
    overflow: hidden;

    /* Box model */
    height: var(--size-xs);
    border-radius: var(--radius-md);

    /* Visual */
    background: transparent;
    box-shadow: 0 0 0 var(--pd-xs) var(--color-gray-50);

    /* Other */
    -webkit-appearance: none;
    appearance: none;
    cursor: default;

    &:focus {
      outline: none;
    }

    &::-webkit-slider-runnable-track,
    &::-moz-range-track {
      width: 100%;
      border: none;
      border-radius: var(--radius-sm);
    }

    &::-webkit-slider-runnable-track {
      height: var(--size-xs);
      border-radius: var(--radius-md);
      background: linear-gradient(
        to right,
        var(--color-yellow-70) 0,
        var(--color-yellow-90) var(--slider-progress, 0%),
        var(--color-gray-50) var(--slider-progress, 0%),
        var(--color-gray-50) 100%
      );
    }

    &::-moz-range-track,
    &::-moz-range-progress {
      height: var(--size-xs);
      border-radius: var(--radius-md);
      background: linear-gradient(
        to right,
        var(--color-yellow-70) 0,
        var(--color-yellow-90) 100%
      );
    }

    &::-webkit-slider-thumb,
    &::-moz-range-thumb {
      border-radius: 1px;
      cursor: default;
      transition: width 0.15s, background 0.15s;
    }

    &::-webkit-slider-thumb {
      width: 3px;
      height: var(--size-xs);
      margin-top: 0;
      border: none;
      border-radius: 1px;
      background: var(--color-gray-80);
      -webkit-appearance: none;
      appearance: none;
    }

    &::-moz-range-thumb {
      width: 3px;
      height: var(--size-xs);
      border: none;
      border-radius: 1px;
      background: var(--color-blue-90);
    }

    &::-webkit-slider-thumb:hover,
    &::-moz-range-thumb:hover {
      background: var(--color-blue-100);
      width: 4px;
    }

    &::-webkit-slider-thumb:active,
    &::-moz-range-thumb:active {
      background: var(--color-blue-110);
      width: 4px;
    }

    &:focus::-webkit-slider-thumb,
    &:focus::-moz-range-thumb {
      box-shadow: 0 0 0 calc(var(--scale-1) + var(--scale-1) / 2)
        color-mix(in srgb, var(--color-blue-90) 30%, transparent);
    }
  }
</style>
