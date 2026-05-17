<script lang="ts">
  /**
   * Color map strip preview: OKLCH color map (stepped/smooth), Color LUT preset, or Color Gradient 3-stop ramp.
   */
  import {
    getCurveFromParams,
    colorStopToCss,
  } from '../../../../utils/colorMapPreview';
  import { sampleLutWithModifiers } from '../../../../shaders/colorRamps';
  import { sampleThreeStopOklch } from '../../../../shaders/colorRamps/threeStopOklch';
  import type { NodeSpec } from '../../../../types/nodeSpec';
  import type { NodeInstance } from '../../../../data-model/types';

  interface Props {
    node: NodeInstance;
    spec: NodeSpec;
    mode: 'stepped' | 'smooth' | 'lut' | 'three-stop';
    height?: number;
    class?: string;
  }

  let {
    node,
    spec,
    mode,
    height = 24,
    class: className = '',
  }: Props = $props();

  function getParam(name: string): number {
    const v = node.parameters[name];
    if (typeof v === 'number') return v;
    const def = spec.parameters[name]?.default;
    return (typeof def === 'number' ? def : 0) as number;
  }

  const startL = $derived(getParam('startColorL'));
  const startC = $derived(getParam('startColorC'));
  const startH = $derived(getParam('startColorH'));
  const endL = $derived(getParam('endColorL'));
  const endC = $derived(getParam('endColorC'));
  const endH = $derived(getParam('endColorH'));
  const stops = $derived(Math.max(2, Math.min(50, Math.round(getParam('stops')))));
  const reverseHue = $derived(getParam('reverseHue'));
  const swapColors = $derived(
    spec.parameters.swapColors != null ? getParam('swapColors') : 0
  );

  const params = $derived({
    lCurveX1: getParam('lCurveX1'),
    lCurveY1: getParam('lCurveY1'),
    lCurveX2: getParam('lCurveX2'),
    lCurveY2: getParam('lCurveY2'),
    cCurveX1: getParam('cCurveX1'),
    cCurveY1: getParam('cCurveY1'),
    cCurveX2: getParam('cCurveX2'),
    cCurveY2: getParam('cCurveY2'),
    hCurveX1: getParam('hCurveX1'),
    hCurveY1: getParam('hCurveY1'),
    hCurveX2: getParam('hCurveX2'),
    hCurveY2: getParam('hCurveY2'),
  });

  const lCurve = $derived(getCurveFromParams(params as Record<string, unknown>, 'lCurve'));
  const cCurve = $derived(getCurveFromParams(params as Record<string, unknown>, 'cCurve'));
  const hCurve = $derived(getCurveFromParams(params as Record<string, unknown>, 'hCurve'));

  const steppedColors = $derived(
    Array.from({ length: stops }, (_, i) => {
      const t = (i + 0.5) / stops;
      return colorStopToCss(
        t,
        startL,
        startC,
        startH,
        endL,
        endC,
        endH,
        lCurve,
        cCurve,
        hCurve,
        reverseHue,
        swapColors
      );
    })
  );

  function rgbToCss(rgb: readonly [number, number, number]): string {
    const [r, g, b] = rgb;
    return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
  }

  const STRIP_SAMPLES = 256;
  const lutGradientStops = $derived(
    Array.from({ length: STRIP_SAMPLES + 1 }, (_, i) => {
      const t = i / STRIP_SAMPLES;
      const rgb = sampleLutWithModifiers(
        Math.round(getParam('preset')),
        t,
        getParam('reverse'),
        getParam('gamma'),
        getParam('contrast') + 1.0,
        1.0
      );
      return `${rgbToCss(rgb)} ${(t * 100).toFixed(2)}%`;
    }).join(', ')
  );

  const threeStopGradientStops = $derived(
    Array.from({ length: STRIP_SAMPLES + 1 }, (_, i) => {
      const t = i / STRIP_SAMPLES;
      const t0 = getParam('stop0T');
      const t1 = Math.max(getParam('stop1T'), t0);
      const t2 = Math.max(getParam('stop2T'), t1);
      const rgb = sampleThreeStopOklch(
        [
          { l: getParam('stop0L'), c: getParam('stop0C'), h: getParam('stop0H'), t: t0 },
          { l: getParam('stop1L'), c: getParam('stop1C'), h: getParam('stop1H'), t: t1 },
          { l: getParam('stop2L'), c: getParam('stop2C'), h: getParam('stop2H'), t: t2 },
        ],
        t
      );
      return `${rgbToCss(rgb)} ${(t * 100).toFixed(2)}%`;
    }).join(', ')
  );

  const SMOOTH_SAMPLES = 64;
  const gradientStops = $derived(
    Array.from({ length: SMOOTH_SAMPLES + 1 }, (_, i) => {
      const t = i / SMOOTH_SAMPLES;
      const color = colorStopToCss(
        t,
        startL,
        startC,
        startH,
        endL,
        endC,
        endH,
        lCurve,
        cCurve,
        hCurve,
        reverseHue,
        swapColors
      );
      return `${color} ${(t * 100).toFixed(2)}%`;
    }).join(', ')
  );
</script>

<div
  class="color-map-preview {className}"
  style="height: {height}px;"
  role="img"
  aria-label="Color map {mode} preview"
>
  {#if mode === 'stepped'}
    <div class="stops-row">
      {#each steppedColors as color}
        <div class="stop-box" style="background: {color};"></div>
      {/each}
    </div>
  {:else if mode === 'lut'}
    <div
      class="gradient-bar"
      style="background: linear-gradient(to right, {lutGradientStops});"
    ></div>
  {:else if mode === 'three-stop'}
    <div
      class="gradient-bar"
      style="background: linear-gradient(to right, {threeStopGradientStops});"
    ></div>
  {:else}
    <div
      class="gradient-bar"
      style="background: linear-gradient(to right, {gradientStops});"
    ></div>
  {/if}
</div>

<style>
  .color-map-preview {
    width: 100%;
    min-height: 0;
    border-radius: var(--color-map-preview-radius, var(--radius-lg));
    background: var(--color-map-preview-bg, var(--color-gray-20));
    overflow: hidden;
    border: 1px solid var(--color-gray-70);
    box-sizing: border-box;

    .stops-row {
      display: flex;
      width: 100%;
      height: 100%;
      min-width: 0;
    }

    .stop-box {
      flex: 1;
      min-width: 0;
      min-height: 0;
    }

    .gradient-bar {
      width: 100%;
      height: 100%;
      min-height: 0;
    }
  }
</style>
