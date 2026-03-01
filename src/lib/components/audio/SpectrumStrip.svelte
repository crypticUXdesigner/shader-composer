<script lang="ts">
  /**
   * SpectrumStrip - WP 07
   * Live FFT bars; selected range highlighted (teal), unselected dimmed (gray).
   * Log scale mapping 20–20k Hz. Uses canvas to avoid 256 DOM nodes and reactive updates per frame.
   */
  import { hzToNorm, normToHz, FREQ_MIN, FREQ_MAX } from './frequencyUtils';

  interface Props {
    spectrumData?: number[] | Uint8Array;
    selectedMin?: number;
    selectedMax?: number;
    sampleRate?: number;
    fftSize?: number;
    class?: string;
  }

  let {
    spectrumData = [],
    selectedMin = FREQ_MIN,
    selectedMax = FREQ_MAX,
    sampleRate = 44100,
    fftSize = 2048,
    class: className = '',
  }: Props = $props();

  let containerEl: HTMLDivElement | undefined = $state();
  let canvasEl: HTMLCanvasElement | undefined = $state();

  const numCols = 256;
  const minBarOpacity = 0.12;

  function draw(
    canvas: HTMLCanvasElement,
    container: HTMLDivElement,
    data: number[] | Uint8Array,
    selMin: number,
    selMax: number,
    sr: number,
    fft: number
  ) {
    const binCount = data.length;
    const minNorm = Math.max(0, Math.min(1, hzToNorm(selMin)));
    const maxNorm = Math.max(0, Math.min(1, hzToNorm(selMax)));
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w <= 0 || h <= 0) return;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const style = getComputedStyle(container);
    const colorSelected = style.getPropertyValue('--color-teal-100').trim() || 'rgb(94, 234, 212)';
    const colorUnselected = style.getPropertyValue('--color-gray-60').trim() || 'rgb(113, 113, 122)';
    const colW = 1 / numCols;
    for (let col = 0; col < numCols; col++) {
      const norm = (col + 0.5) / numCols;
      const inSelection = norm >= minNorm && norm <= maxNorm;
      const hz = normToHz(norm);
      const bin = Math.floor((hz / sr) * fft);
      const binClamped = Math.max(0, Math.min(binCount - 1, bin));
      const raw = data[binClamped] / 255;
      const t = Math.max(0, Math.min(1, raw));
      const opacity = minBarOpacity + (1 - minBarOpacity) * t;
      const barHeight = Math.max(0.01, t);
      const x = (col * colW) * w;
      const width = Math.max(1, colW * w);
      const y = (1 - barHeight) * h;
      const height = Math.max(1, barHeight * h);
      ctx.fillStyle = inSelection ? colorSelected : colorUnselected;
      ctx.globalAlpha = opacity;
      ctx.fillRect(x, y, width, height);
    }
    ctx.globalAlpha = 1;
  }

  $effect(() => {
    if (!containerEl || !canvasEl) return;
    const data = spectrumData?.length ? spectrumData : [];
    const redraw = () => {
      if (containerEl && canvasEl && data.length)
        draw(canvasEl, containerEl, data, selectedMin, selectedMax, sampleRate, fftSize);
    };
    redraw();
    const ro = new ResizeObserver(redraw);
    ro.observe(containerEl);
    return () => ro.disconnect();
  });
</script>

<div class="spectrum-strip {className}" bind:this={containerEl} role="img" aria-label="Frequency spectrum">
  <canvas class="canvas" bind:this={canvasEl}></canvas>
</div>

<style>
  .spectrum-strip {
    display: block;
    width: 100%;
    height: 120px;

    .canvas {
      display: block;
      width: 100%;
      height: 100%;
    }
  }
</style>
