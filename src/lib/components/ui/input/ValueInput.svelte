<script lang="ts">
  interface Props {
    value: number;
    /** When provided, this value is shown in edit mode (e.g. on double-click) instead of value. Use for "config" vs "display": display shows live value, edit shows configured value. */
    valueForEdit?: number;
    min?: number;
    max?: number;
    step?: number;
    decimals?: number;
    disabled?: boolean;
    size?: 'sm' | 'md';
    class?: string;
    onChange?: (value: number) => void;
    onCommit?: (value: number) => void;
  }

  let {
    value,
    valueForEdit,
    min = 0,
    max = 1,
    step = 0.01,
    decimals = 3,
    disabled = false,
    size = 'md',
    class: className = '',
    onChange,
    onCommit
  }: Props = $props();

  let editMode = $state(false);
  let editText = $state('');
  let inputEl: HTMLInputElement | undefined = $state();
  let wrapperEl: HTMLDivElement | undefined = $state();
  let lockedWidthPx: number | undefined = $state();

  const DRAG_SENSITIVITY = 100; // pixels for full range

  function snapValue(raw: number): number {
    let v = Math.max(min, Math.min(max, raw));
    if (typeof step === 'number' && step > 0) {
      v = min + Math.round((v - min) / step) * step;
      v = Math.max(min, Math.min(max, v));
    } else if (decimals === 0) {
      v = Math.round(v);
      v = Math.max(min, Math.min(max, v));
    } else if (decimals > 0) {
      const factor = Math.pow(10, decimals);
      v = Math.round(v * factor) / factor;
      v = Math.max(min, Math.min(max, v));
    }
    return v;
  }

  function formatDisplay(v: number): string {
    if (decimals === 0) return Math.round(v).toString();
    return v.toFixed(decimals);
  }

  const displayText = $derived(editMode ? editText : formatDisplay(value));

  function handlePointerDown(e: PointerEvent) {
    if (disabled || editMode) return;
    e.preventDefault();
    const el = e.currentTarget as HTMLElement;
    const pointerId = e.pointerId;
    el.setPointerCapture(pointerId);
    let startY = e.clientY;
    let startValue = value;
    let lastValue = value;

    function handlePointerMove(moveEvent: PointerEvent) {
      const deltaY = startY - moveEvent.clientY;
      const range = max - min;
      const valueDelta = (deltaY / DRAG_SENSITIVITY) * range;
      const rawValue = startValue + valueDelta;
      const newValue = snapValue(rawValue);
      lastValue = newValue;
      onChange?.(newValue);
    }

    let cleanedUp = false;
    function cleanup() {
      if (cleanedUp) return;
      cleanedUp = true;
      try { el.releasePointerCapture(pointerId); } catch { /* already released */ }
      el.removeEventListener('pointermove', handlePointerMove as EventListener);
      window.removeEventListener('pointerup', handlePointerUp as EventListener);
      window.removeEventListener('pointercancel', handlePointerUp as EventListener);
      el.removeEventListener('lostpointercapture', handleLostCapture as EventListener);
      onCommit?.(lastValue);
    }

    function handlePointerUp(upEvent: PointerEvent) {
      if (upEvent.pointerId !== pointerId) return;
      cleanup();
    }

    function handleLostCapture(ev: PointerEvent) {
      if (ev.pointerId !== pointerId) return;
      cleanup();
    }

    el.addEventListener('pointermove', handlePointerMove as EventListener);
    window.addEventListener('pointerup', handlePointerUp as EventListener);
    window.addEventListener('pointercancel', handlePointerUp as EventListener);
    el.addEventListener('lostpointercapture', handleLostCapture as EventListener);
  }

  function handleDblClick() {
    if (disabled) return;
    if (wrapperEl) lockedWidthPx = wrapperEl.offsetWidth;
    editMode = true;
    editText = formatDisplay(valueForEdit ?? value);
    requestAnimationFrame(() => inputEl?.select());
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      commitEdit();
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  }

  function commitEdit() {
    const parsed = parseFloat(editText);
    if (!Number.isNaN(parsed)) {
      const newValue = snapValue(parsed);
      onChange?.(newValue);
      onCommit?.(newValue);
    }
    editMode = false;
    lockedWidthPx = undefined;
  }

  function cancelEdit() {
    editMode = false;
    editText = '';
    lockedWidthPx = undefined;
  }

  function handleBlur() {
    commitEdit();
  }
</script>

<div
  class="value-input-wrapper {className}"
  bind:this={wrapperEl}
  style={lockedWidthPx != null ? `width: ${lockedWidthPx}px` : ''}
>
  {#if editMode}
    <input
      bind:this={inputEl}
      type="text"
      class="value-input input-edit size-{size} {className}"
      bind:value={editText}
      onkeydown={handleKeydown}
      onblur={handleBlur}
      {disabled}
      aria-label="Edit value"
    />
  {:else}
    <div
      class="value-input value-display size-{size} {className}"
      role="textbox"
      tabindex={disabled ? -1 : 0}
      aria-label="Value: {displayText}. Double-click to edit, drag to adjust."
      aria-readonly="false"
      onpointerdown={handlePointerDown}
      ondblclick={handleDblClick}
      onkeydown={(e) => e.key === 'Enter' && handleDblClick()}
    >
      {displayText}
    </div>
  {/if}
</div>

<style>
  .value-input-wrapper {
    display: inline-flex;
    flex: 0 0 auto;
    width: fit-content;
    min-width: var(--value-display-min-width);
    max-width: 100%;
    box-sizing: border-box;

    .value-input {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: fit-content;
      min-width: var(--value-display-min-width);
      max-width: 100%;
      flex: 0 0 auto;
      min-height: var(--size-sm);
      padding: var(--pd-sm) var(--pd-md);
      border-radius: var(--radius-md);
      font-family: var(--font-mono);
      font-size: var(--text-md);
      font-weight: 500;
      color: var(--param-control-value-color);
      background: var(--param-control-bg);
      border: 1px solid var(--param-control-border);
      box-sizing: border-box;
      cursor: ns-resize;

      &.size-sm {
        min-height: var(--size-xs);
        padding: var(--pd-xs) var(--pd-md);
        border-radius: var(--radius-sm);
        font-size: var(--text-xs);
      }

      &:hover {
        background: var(--param-control-bg-hover);
        color: var(--param-control-value-color-hover);
      }

      &:active {
        background: var(--param-control-bg-active);
        color: var(--param-control-value-color-active);
      }

      &:disabled {
        opacity: var(--opacity-disabled);
        cursor: not-allowed;
      }

      &.value-display {
        user-select: none;

        &:focus {
          outline: none;
        }

        &:focus-visible {
          border-color: var(--param-control-border-active);
          box-shadow: 0 0 0 1px var(--param-control-border-active);
        }
      }

      &.input-edit {
        width: 100%;
        min-width: 0;
        max-width: 100%;
        text-align: center;
        border: 1px solid var(--param-control-border);
        cursor: text;
        box-sizing: border-box;

        &:focus {
          outline: none;
          border-color: var(--param-control-border-active);
          box-shadow: 0 0 0 1px var(--param-control-border-active);
        }
      }
    }
  }
</style>
