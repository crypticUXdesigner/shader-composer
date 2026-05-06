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

  let {
    min = 0,
    max = 100,
    step = 1,
    value = min,
    oninput,
    disabled = false,
    class: className = '',
    ...restProps
  }: Props = $props();

  const propValue = $derived(value ?? min ?? 0);
  /** True while pointer/keyboard is adjusting the slider (Story B: parent value does not overwrite mid-gesture). */
  let interacting = $state(false);
  let liveValue = $state(0);

  const displayValue = $derived(interacting ? liveValue : propValue);

  const progress = $derived(((displayValue - min) / (max - min || 1)) * 100);

  function beginInteraction(): void {
    interacting = true;
    liveValue = propValue;
  }

  function endInteraction(): void {
    interacting = false;
  }
</script>

<input
  type="range"
  class="slider {className || ''}"
  {min}
  {max}
  {step}
  value={displayValue}
  {disabled}
  style="--slider-progress: {progress}%"
  onpointerdown={beginInteraction}
  onpointerup={endInteraction}
  onpointercancel={endInteraction}
  onblur={endInteraction}
  oninput={(e) => {
    const t = e.currentTarget as HTMLInputElement;
    if (!interacting) beginInteraction();
    liveValue = t.valueAsNumber;
    oninput?.(e);
  }}
  {...restProps}
/>

<style>
  .slider {
    /* Layout */
    flex: 1;
    width: 100%;
    display: block;
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

    &:disabled {
      cursor: not-allowed;
      opacity: 0.55;
    }

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

    &:disabled::-webkit-slider-runnable-track {
      background: linear-gradient(
        to right,
        color-mix(in srgb, var(--color-gray-60) 65%, transparent) 0,
        color-mix(in srgb, var(--color-gray-60) 65%, transparent) var(--slider-progress, 0%),
        color-mix(in srgb, var(--color-gray-50) 80%, transparent) var(--slider-progress, 0%),
        color-mix(in srgb, var(--color-gray-50) 80%, transparent) 100%
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

    &:disabled::-moz-range-track,
    &:disabled::-moz-range-progress {
      background: linear-gradient(
        to right,
        color-mix(in srgb, var(--color-gray-60) 65%, transparent) 0,
        color-mix(in srgb, var(--color-gray-60) 65%, transparent) 100%
      );
    }

    &::-webkit-slider-thumb,
    &::-moz-range-thumb {
      border-radius: 1px;
      cursor: default;
      transition:
        width var(--motion-effects-fast-duration) var(--motion-effects-fast-easing),
        background var(--motion-effects-fast-duration) var(--motion-effects-fast-easing);
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

    &:disabled::-webkit-slider-thumb {
      background: color-mix(in srgb, var(--color-gray-70) 80%, transparent);
    }

    &::-moz-range-thumb {
      width: 3px;
      height: var(--size-xs);
      border: none;
      border-radius: 1px;
      background: var(--color-blue-90);
    }

    &:disabled::-moz-range-thumb {
      background: color-mix(in srgb, var(--color-gray-70) 80%, transparent);
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

    &:disabled::-webkit-slider-thumb:hover,
    &:disabled::-moz-range-thumb:hover,
    &:disabled::-webkit-slider-thumb:active,
    &:disabled::-moz-range-thumb:active {
      background: color-mix(in srgb, var(--color-gray-70) 80%, transparent);
      width: 3px;
    }

    &:focus::-webkit-slider-thumb,
    &:focus::-moz-range-thumb {
      box-shadow: 0 0 0 calc(var(--scale-1) + var(--scale-1) / 2)
        color-mix(in srgb, var(--color-blue-90) 30%, transparent);
    }
  }
</style>
