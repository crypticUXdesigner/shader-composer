<script lang="ts">
  /**
   * CoordPad - XY pad + input row below.
   * Layout: display-graph style pad on top, two ValueInputs (size sm) in a row below.
   * Parity with FrequencyRangeEditor: graph area + inputs row.
   */
  import { ValueInput } from '../../ui';

  interface Props {
    x: number;
    y: number;
    /** When provided, X ValueInput shows this in edit mode (config value). */
    valueForEditX?: number;
    /** When provided, Y ValueInput shows this in edit mode (config value). */
    valueForEditY?: number;
    minX?: number;
    maxX?: number;
    minY?: number;
    maxY?: number;
    /** 'center' (0,0 at center) or 'bottom-left' (0,0 at corner). Default center. */
    origin?: 'center' | 'bottom-left';
    /** When true, pad drag and X/Y inputs keep both axes equal (1:1 ratio). */
    lockAspect1to1?: boolean;
    step?: number;
    disabled?: boolean;
    class?: string;
    onChange?: (x: number, y: number) => void;
    onCommit?: (x: number, y: number) => void;
  }

  let {
    x,
    y,
    valueForEditX,
    valueForEditY,
    minX = -2,
    maxX = 2,
    minY = -2,
    maxY = 2,
    origin = 'center',
    lockAspect1to1 = false,
    step = 0.1,
    disabled = false,
    class: className = '',
    onChange,
    onCommit,
  }: Props = $props();

  let padEl: HTMLDivElement | undefined = $state();
  let lastX = $state(0);
  let lastY = $state(0);
  let isDragging = $state(false);

  $effect(() => {
    lastX = x;
    lastY = y;
  });

  const rangeX = $derived(maxX - minX || 1);
  const rangeY = $derived(maxY - minY || 1);

  function snapValue(raw: number, min: number, max: number): number {
    let v = Math.max(min, Math.min(max, raw));
    if (typeof step === 'number' && step > 0) {
      v = min + Math.round((v - min) / step) * step;
      v = Math.max(min, Math.min(max, v));
    }
    return v;
  }

  function valueToNormX(v: number): number {
    return Math.max(0, Math.min(1, (v - minX) / rangeX));
  }

  function valueToNormY(v: number): number {
    return Math.max(0, Math.min(1, (v - minY) / rangeY));
  }

  function normToValueX(norm: number): number {
    return snapValue(minX + norm * rangeX, minX, maxX);
  }

  function normToValueY(norm: number): number {
    return snapValue(minY + norm * rangeY, minY, maxY);
  }

  const normX = $derived(valueToNormX(x));
  const normY = $derived(valueToNormY(y));

  function handlePadPointerDown(e: PointerEvent) {
    if (disabled || !padEl) return;
    e.preventDefault();
    isDragging = true;
    const pointerId = e.pointerId;
    padEl.setPointerCapture(pointerId);

    function updateFromClient(clientX: number, clientY: number) {
      const rect = padEl!.getBoundingClientRect();
      const pad = 8; /* match .pad-area padding */
      const innerLeft = rect.left + pad;
      const innerTop = rect.top + pad;
      const innerW = rect.width - pad * 2;
      const innerH = rect.height - pad * 2;
      const normXLocal = Math.max(0, Math.min(1, (clientX - innerLeft) / innerW));
      const normYLocal = Math.max(0, Math.min(1, 1 - (clientY - innerTop) / innerH));
      let newX: number;
      let newY: number;
      if (lockAspect1to1) {
        const norm = Math.max(normXLocal, normYLocal);
        const value = normToValueX(norm);
        newX = value;
        newY = snapValue(value, minY, maxY);
      } else {
        newX = normToValueX(normXLocal);
        newY = normToValueY(normYLocal);
      }
      lastX = newX;
      lastY = newY;
      onChange?.(newX, newY);
    }

    updateFromClient(e.clientX, e.clientY);

    function handlePointerMove(moveEvent: PointerEvent) {
      updateFromClient(moveEvent.clientX, moveEvent.clientY);
    }

    function handlePointerUp() {
      isDragging = false;
      padEl?.releasePointerCapture(pointerId);
      padEl?.removeEventListener('pointermove', handlePointerMove as EventListener);
      window.removeEventListener('pointerup', handlePointerUp as EventListener);
      window.removeEventListener('pointercancel', handlePointerUp as EventListener);
      onCommit?.(lastX, lastY);
    }

    padEl.addEventListener('pointermove', handlePointerMove as EventListener);
    window.addEventListener('pointerup', handlePointerUp as EventListener);
    window.addEventListener('pointercancel', handlePointerUp as EventListener);
  }

  function handleXChange(value: number) {
    const newX = snapValue(value, minX, maxX);
    if (lockAspect1to1) {
      const yVal = snapValue(newX, minY, maxY);
      onChange?.(newX, yVal);
    } else {
      onChange?.(newX, y);
    }
  }

  function handleYChange(value: number) {
    const newY = snapValue(value, minY, maxY);
    if (lockAspect1to1) {
      const xVal = snapValue(newY, minX, maxX);
      onChange?.(xVal, newY);
    } else {
      onChange?.(x, newY);
    }
  }

  function handleXCommit(value: number) {
    const newX = snapValue(value, minX, maxX);
    if (lockAspect1to1) {
      const yVal = snapValue(newX, minY, maxY);
      onCommit?.(newX, yVal);
    } else {
      onCommit?.(newX, y);
    }
  }

  function handleYCommit(value: number) {
    const newY = snapValue(value, minY, maxY);
    if (lockAspect1to1) {
      const xVal = snapValue(newY, minX, maxX);
      onCommit?.(xVal, newY);
    } else {
      onCommit?.(x, newY);
    }
  }

  const decimals = 3;
</script>

<div class="coord-pad card-display {className}" data-disabled={disabled || undefined}>
  <div
    class="pad-area display-graph"
    data-origin={origin}
    data-lock-1to1={lockAspect1to1 || undefined}
    bind:this={padEl}
    role="group"
    aria-label="XY coordinate pad"
    onpointerdown={handlePadPointerDown}
  >
    <div
      class="knob"
      class:active={isDragging}
      style="left: {normX * 100}%; bottom: {normY * 100}%;"
      role="presentation"
    ></div>
  </div>
  <div class="inputs">
    <div class="row">
      <div class="column">
        <span class="field-label">X</span>
        <ValueInput
          value={x}
          valueForEdit={valueForEditX}
          min={minX}
          max={maxX}
          step={step}
          decimals={decimals}
          size="sm"
          {disabled}
          onChange={handleXChange}
          onCommit={handleXCommit}
          class="coord-input coord-input-x"
        />
      </div>
      <div class="column">
        <span class="field-label">Y</span>
        <ValueInput
          value={y}
          valueForEdit={valueForEditY}
          min={minY}
          max={maxY}
          step={step}
          decimals={decimals}
          size="sm"
          {disabled}
          onChange={handleYChange}
          onCommit={handleYCommit}
          class="coord-input coord-input-y"
        />
      </div>
    </div>
  </div>
</div>

<style>
  .coord-pad {
    display: flex;
    flex-direction: column;
    width: fit-content;
    gap: var(--card-display-gap);
    border-radius: var(--radius-lg);

    &[data-disabled] {
      opacity: var(--opacity-disabled);
      pointer-events: none;
    }

    .pad-area {
      position: relative;
      width: 240px; /* one-off - coord pad width */
      height: 160px; /* one-off - coord pad height */
      flex-shrink: 0;
      padding: 8px; /* room for knob (12px) + shadow at edges so it doesn't get clipped */
      overflow: visible;
      background: var(--param-control-bg);
      background-image:
        /* Center cross – more prominent */
        linear-gradient(to right, transparent 49.5%, var(--display-graph-grid-line-color-strong, var(--color-gray-100)) 49.5%, var(--display-graph-grid-line-color-strong, var(--color-gray-100)) 50.5%, transparent 50.5%),
        linear-gradient(to bottom, transparent 49.5%, var(--display-graph-grid-line-color-strong, var(--color-gray-100)) 49.5%, var(--display-graph-grid-line-color-strong, var(--color-gray-100)) 50.5%, transparent 50.5%),
        /* Quarter lines – subtle (same token as diagonal so overrides apply to both) */
        linear-gradient(to right, transparent 24.5%, var(--display-graph-grid-line-color, var(--color-gray-80)) 24.5%, var(--display-graph-grid-line-color, var(--color-gray-80)) 25.5%, transparent 25.5%),
        linear-gradient(to right, transparent 74.5%, var(--display-graph-grid-line-color, var(--color-gray-80)) 74.5%, var(--display-graph-grid-line-color, var(--color-gray-80)) 75.5%, transparent 75.5%),
        linear-gradient(to bottom, transparent 24.5%, var(--display-graph-grid-line-color, var(--color-gray-80)) 24.5%, var(--display-graph-grid-line-color, var(--color-gray-80)) 25.5%, transparent 25.5%),
        linear-gradient(to bottom, transparent 74.5%, var(--display-graph-grid-line-color, var(--color-gray-80)) 74.5%, var(--display-graph-grid-line-color, var(--color-gray-80)) 75.5%, transparent 75.5%);
      border: 1px solid var(--param-control-border);
      border-radius: var(--radius-md);
      cursor: default;

      /* Bottom-left origin (0 to 1): quarter lines only, no origin marker (avoids extra left/bottom lines) */
      &[data-origin='bottom-left'] {
        background-image:
          linear-gradient(to right, transparent 24.5%, var(--display-graph-grid-line-color, var(--color-gray-80)) 24.5%, var(--display-graph-grid-line-color, var(--color-gray-80)) 25.5%, transparent 25.5%),
          linear-gradient(to right, transparent 49.5%, var(--display-graph-grid-line-color, var(--color-gray-80)) 49.5%, var(--display-graph-grid-line-color, var(--color-gray-80)) 50.5%, transparent 50.5%),
          linear-gradient(to right, transparent 74.5%, var(--display-graph-grid-line-color, var(--color-gray-80)) 74.5%, var(--display-graph-grid-line-color, var(--color-gray-80)) 75.5%, transparent 75.5%),
          linear-gradient(to bottom, transparent 24.5%, var(--display-graph-grid-line-color, var(--color-gray-80)) 24.5%, var(--display-graph-grid-line-color, var(--color-gray-80)) 25.5%, transparent 25.5%),
          linear-gradient(to bottom, transparent 49.5%, var(--display-graph-grid-line-color, var(--color-gray-80)) 49.5%, var(--display-graph-grid-line-color, var(--color-gray-80)) 50.5%, transparent 50.5%),
          linear-gradient(to bottom, transparent 74.5%, var(--display-graph-grid-line-color, var(--color-gray-80)) 74.5%, var(--display-graph-grid-line-color, var(--color-gray-80)) 75.5%, transparent 75.5%);
      }

      /* 1:1 diagonal gridline when ratio lock is on. CSS gradient so it uses the same variable as other grid lines (SVG as background-image would use black for currentColor). */
      &[data-lock-1to1]::before {
        content: '';
        position: absolute;
        inset: 8px;
        background-image: linear-gradient(
          146deg,
          transparent 49.5%,
          var(--display-graph-grid-line-color, var(--color-gray-80)) 49.5%,
          var(--display-graph-grid-line-color, var(--color-gray-80)) 50.5%,
          transparent 50.5%
        );
        pointer-events: none;
        border-radius: inherit;
      }

      .knob {
        position: absolute;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: var(--param-control-value-color);
        border: 1px solid rgba(255, 255, 255, 0.3);
        box-shadow: 0 0 2px 6px color-mix(in srgb, var(--param-control-value-color) 30%, transparent 70%);
        transform: translate(-50%, 50%);
        pointer-events: none;
        transition: background 0.15s, box-shadow 0.15s, transform 0.1s;
      }

      &:hover .knob {
        background: var(--port-hover-color);
        transform: translate(-50%, 50%) scale(1.15);
        box-shadow: 0 0 2px 6px var(--color-teal-gray-40);
      }

      .knob.active {
        background: var(--port-dragging-color);
        transform: translate(-50%, 50%) scale(1.15);
        box-shadow: 0 0 2px 6px color-mix(in srgb, var(--port-dragging-color) calc(var(--port-dragging-outer-opacity) * 100%), transparent);
      }
    }

    .inputs {
      display: flex;
      flex-direction: column;
      gap: var(--param-grid-gap, var(--card-display-gap));
      width: 100%;
    }

    .inputs .row {
      display: flex;
      gap: var(--pd-md);
      width: 100%;
    }

    .inputs .column {
      flex: 1;
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      gap: var(--pd-sm);
      padding: 0 var(--pd-sm);

      .field-label {
        width: auto;
        font-size: var(--text-xs);
        color: var(--print-default);
        font-weight: 600;
      }
    }
  }
</style>