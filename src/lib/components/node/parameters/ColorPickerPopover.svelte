<script lang="ts">
  import { Popover } from '../../ui';
  import type { OKLCHTriple } from '../../../../types/editor';
  import {
    oklchToHsvForPicker,
    hsvSrgbToOklch,
    hsvToSrgb,
    srgbToCssRgb,
  } from '../../../../utils/colorConversion';

  const SV_BOX_SIZE = 160;
  const HUE_STRIP_HEIGHT = 12;

  interface Props {
    visible?: boolean;
    x?: number;
    y?: number;
    value?: OKLCHTriple;
    onChange?: (l: number, c: number, h: number) => void;
    onClose?: () => void;
  }

  let {
    visible = false,
    x = 0,
    y = 0,
    value = { l: 0.5, c: 0.2, h: 0 },
    onChange,
    onClose,
  }: Props = $props();

  let h = $state(0);
  let s = $state(1);
  let v = $state(1);
  let svCanvasEl = $state<HTMLCanvasElement | null>(null);
  let hueCanvasEl = $state<HTMLCanvasElement | null>(null);
  let draggingSv = $state(false);
  let draggingHue = $state(false);

  $effect(() => {
    if (visible && value) {
      const hsv = oklchToHsvForPicker(value.l, value.c, value.h);
      h = hsv.h;
      s = hsv.s;
      v = hsv.v;
    }
  });

  function updateFromHSV() {
    const oklch = hsvSrgbToOklch(h, s, v);
    onChange?.(oklch.l, oklch.c, oklch.h);
  }

  function swatchColor() {
    const srgb = hsvToSrgb(h, s, v);
    return srgbToCssRgb(srgb.r, srgb.g, srgb.b);
  }

  function redrawSVCanvas() {
    if (!svCanvasEl) return;
    const ctx = svCanvasEl.getContext('2d');
    if (!ctx) return;
    const hueGrad = ctx.createLinearGradient(0, 0, SV_BOX_SIZE, 0);
    hueGrad.addColorStop(0, 'white');
    hueGrad.addColorStop(1, `hsl(${h}, 100%, 50%)`);
    ctx.fillStyle = hueGrad;
    ctx.fillRect(0, 0, SV_BOX_SIZE, SV_BOX_SIZE);
    const blackGrad = ctx.createLinearGradient(0, 0, 0, SV_BOX_SIZE);
    blackGrad.addColorStop(0, 'rgba(0,0,0,0)');
    blackGrad.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = blackGrad;
    ctx.fillRect(0, 0, SV_BOX_SIZE, SV_BOX_SIZE);
  }

  $effect(() => {
    if (visible && svCanvasEl) {
      redrawSVCanvas();
    }
  });

  $effect(() => {
    if (visible && hueCanvasEl) {
      const ctx = hueCanvasEl.getContext('2d');
      if (!ctx) return;
      const grad = ctx.createLinearGradient(0, 0, SV_BOX_SIZE, 0);
      for (let i = 0; i <= 6; i++) grad.addColorStop(i / 6, `hsl(${i * 60}, 100%, 50%)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, SV_BOX_SIZE, HUE_STRIP_HEIGHT);
    }
  });

  function handleSvPointerDown(e: MouseEvent) {
    draggingSv = true;
    handleSvMove(e);
  }

  function handleSvMove(e: MouseEvent) {
    if (!svCanvasEl) return;
    const rect = svCanvasEl.getBoundingClientRect();
    const xNorm = (e.clientX - rect.left) / rect.width;
    const yNorm = (e.clientY - rect.top) / rect.height;
    s = Math.max(0, Math.min(1, xNorm));
    v = 1 - Math.max(0, Math.min(1, yNorm));
    updateFromHSV();
  }

  function handleHuePointerDown(e: MouseEvent) {
    draggingHue = true;
    handleHueMove(e);
  }

  function handleHueMove(e: MouseEvent) {
    if (!hueCanvasEl) return;
    const rect = hueCanvasEl.getBoundingClientRect();
    const xNorm = (e.clientX - rect.left) / rect.width;
    h = Math.max(0, Math.min(360, xNorm * 360));
    updateFromHSV();
    redrawSVCanvas();
  }

  $effect(() => {
    if (!visible) return;
    const onMove = (e: MouseEvent) => {
      if (draggingSv) handleSvMove(e);
      if (draggingHue) handleHueMove(e);
    };
    const onUp = () => {
      draggingSv = false;
      draggingHue = false;
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  });
</script>

<Popover
  open={visible}
  x={x}
  y={y}
  align="center"
  onClose={onClose}
  class="color-picker-popover"
>
  <div class="swatch" style="background-color: {visible ? swatchColor() : 'transparent'};"></div>
  <div class="sv-box" style="--hue: {h}deg;">
    <canvas
      bind:this={svCanvasEl}
      class="sv-canvas"
      width={SV_BOX_SIZE}
      height={SV_BOX_SIZE}
      onmousedown={handleSvPointerDown}
    ></canvas>
    <div class="sv-pointer" style="left: {s * 100}%; top: {(1 - v) * 100}%;"></div>
  </div>
  <div class="hue-strip">
    <canvas
      bind:this={hueCanvasEl}
      class="hue-canvas"
      width={SV_BOX_SIZE}
      height={HUE_STRIP_HEIGHT}
      onmousedown={handleHuePointerDown}
    ></canvas>
    <div class="hue-pointer" style="left: {(h / 360) * 100}%;"></div>
  </div>
</Popover>

<style>
  /* Popover receives class="color-picker-popover"; styles apply to its content */
  :global(.color-picker-popover) {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-start;
    gap: var(--pd-md);
    width: 240px;
    padding: var(--pd-md);
    border: 1px solid var(--color-gray-70);
    border-radius: var(--color-picker-radius);
    background: var(--color-picker-bg);

    .swatch {
      width: 100%;
      height: 32px;
      border: 1px solid var(--color-gray-70);
      border-radius: var(--radius-sm);
    }

    .sv-box {
      position: relative;
      overflow: hidden;
      width: 100%;
      height: 180px;
      border-radius: var(--radius-sm);
      cursor: crosshair;

      .sv-canvas {
        display: block;
        width: 100%;
        height: 100%;
        border-radius: var(--radius-sm);
      }

      .sv-pointer {
        position: absolute;
        margin: -6px 0 0 -6px;
        pointer-events: none;
        width: 12px;
        height: 12px;
        border: 2px solid var(--color-gray-130);
        border-radius: 50%;
        box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.3);
      }
    }

    .hue-strip {
      position: relative;
      overflow: hidden;
      height: 12px;
      border-radius: var(--radius-sm);
      cursor: default;

      .hue-canvas {
        display: block;
        width: 100%;
        height: 100%;
        border-radius: var(--radius-sm);
      }

      .hue-pointer {
        position: absolute;
        top: 0;
        margin-left: -2px;
        pointer-events: none;
        width: 4px;
        height: 100%;
        border: 2px solid var(--color-gray-130);
        border-radius: 2px;
        box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.3);
      }
    }
  }
</style>
