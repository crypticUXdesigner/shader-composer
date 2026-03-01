<script lang="ts">
  /**
   * ColorMapPreview - Visualizes color stops for OKLCH color map nodes.
   * Stepped: row of N equal-width boxes (one per stop).
   * Smooth: one gradient bar from the interpolated result.
   */
  import {
    getCurveFromParams,
    colorStopToCss,
  } from '../../../../utils/colorMapPreview';
  import type { NodeSpec } from '../../../../types/nodeSpec';
  import type { NodeInstance } from '../../../../data-model/types';

  interface Props {
    node: NodeInstance;
    spec: NodeSpec;
    mode: 'stepped' | 'smooth';
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
        reverseHue
      );
    })
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
        reverseHue
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
