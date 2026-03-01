<script lang="ts">
  /**
   * TimelineCurveEditor - Svelte 5 Migration WP 05C
   * Edits keyframes and interpolation for one automation region.
   * Normalized time [0,1] horizontal, value [0,1] vertical.
   */
  import { Button, Input, DropdownMenu, MenuItem, IconSvg, NodeIconSvg } from '../ui';
  import { updateAutomationRegion } from '../../../data-model';
  import { evaluateCurveAtNormalizedTime } from '../../../utils/automationEvaluator';
  import { getNodeIcon } from '../../../utils/nodeSpecUtils';
  import type { NodeGraph } from '../../../data-model/types';
  import type { AutomationCurve, AutomationCurveInterpolation } from '../../../data-model/types';
  import type { NodeSpec } from '../../../types/nodeSpec';
  import type { ParameterSpec } from '../../../types/nodeSpec';
  import { getSubGroupSlug } from '../../../utils/cssTokens';
  import { getWaveformSlice } from '../../../runtime/waveform/WaveformService';

  const GRAPH_PADDING = { top: 8, right: 8, bottom: 24, left: 36 };
  const WAVEFORM_OPACITY = 0.28;
  const WAVEFORM_BAND_FRACTION = 0.4; // vertical band height as fraction of graph height
  const CURVE_HIT_MARGIN = 8;
  const SAMPLES = 80;

  const SNAP_DIVISIONS = [1, 2, 4, 8, 16] as const;
  type SnapDivision = (typeof SNAP_DIVISIONS)[number];

  function snapTimeToBarGrid(t: number, regionBars: number, division: number): number {
    if (regionBars <= 0 || division <= 0) return t;
    const step = 1 / (regionBars * division);
    const n = Math.round(t / step);
    return Math.max(0, Math.min(1, n * step));
  }

  const categorySlugMap: Record<string, string> = {
    Inputs: 'inputs',
    Patterns: 'patterns',
    Shapes: 'shapes',
    Math: 'math',
    Utilities: 'utilities',
    Distort: 'distort',
    Blend: 'blend',
    Mask: 'mask',
    Effects: 'effects',
    Output: 'output',
    Audio: 'audio',
  };

  export type GetWaveformData = () => Promise<{
    values: number[];
    valuesRight?: number[];
    durationSeconds: number;
  }>;

  interface Props {
    getGraph: () => NodeGraph;
    onGraphUpdate: (graph: NodeGraph) => void;
    onClose: () => void;
    laneId: string;
    regionId: string;
    laneLabel: string;
    nodeSpecs?: NodeSpec[];
    /** Optional: for waveform background. Returns full primary waveform; slice is computed from region times. */
    getWaveformData?: GetWaveformData;
  }

  let {
    getGraph,
    onGraphUpdate,
    onClose,
    laneId,
    regionId,
    laneLabel,
    nodeSpecs = [],
    getWaveformData,
  }: Props = $props();

  let graphWrapEl: HTMLDivElement | null = null;
  let svgEl: SVGElement | null = null;
  let rootEl: HTMLElement | null = null;

  let graphWidth = $state(300);
  let graphHeight = $state(120);
  let selectedKeyframeIndex = $state<number | null>(null);
  let dragKeyframeIndex = $state<number | null>(null);
  let snapEnabled = $state(true);
  let snapDivision = $state<SnapDivision>(1);
  let snapGridOpen = $state(false);
  let snapGridButtonEl = $state<HTMLDivElement | null>(null);
  let interpMenuOpen = $state(false);
  let interpButtonEl = $state<HTMLDivElement | null>(null);
  let waveformSliceLeft = $state<number[]>([]);
  let waveformSliceRight = $state<number[]>([]);

  const nodeSpecsMap = $derived(new Map(nodeSpecs.map((s) => [s.id, s])));

  /** Param spec for the lane's parameter (min/max for display and numeric input). Default min=0, max=1. */
  const paramSpec = $derived.by(() => {
    const graph = getGraph();
    const lane = graph.automation?.lanes.find((l) => l.id === laneId);
    if (!lane) return { min: 0, max: 1, step: undefined as number | undefined };
    const node = graph.nodes.find((n: { id: string }) => n.id === lane.nodeId);
    const spec = node ? nodeSpecsMap.get(node.type) : undefined;
    const param = spec?.parameters?.[lane.paramName] as ParameterSpec | undefined;
    const min = param?.min ?? 0;
    const max = param?.max ?? 1;
    const step = param?.step;
    return { min, max, step };
  });

  function normalizedToParam(n: number): number {
    const { min, max } = paramSpec;
    return min + n * (max - min);
  }

  function paramToNormalized(p: number): number {
    const { min, max } = paramSpec;
    if (max === min) return 0;
    return Math.max(0, Math.min(1, (p - min) / (max - min)));
  }

  const curve = $derived.by(() => {
    const graph = getGraph();
    const lane = graph.automation?.lanes.find((l) => l.id === laneId);
    const region = lane?.regions.find((r) => r.id === regionId);
    return region?.curve ?? null;
  });

  const categorySlug = $derived.by(() => {
    const graph = getGraph();
    const lane = graph.automation?.lanes.find((l) => l.id === laneId);
    if (!lane) return 'default';
    const node = graph.nodes.find((n: { id: string }) => n.id === lane.nodeId);
    const spec = node ? nodeSpecsMap.get(node.type) : undefined;
    return (spec?.category && categorySlugMap[spec.category]) || 'default';
  });

  const subGroupSlug = $derived.by(() => {
    const graph = getGraph();
    const lane = graph.automation?.lanes.find((l) => l.id === laneId);
    if (!lane) return '';
    const node = graph.nodes.find((n: { id: string }) => n.id === lane.nodeId);
    const spec = node ? nodeSpecsMap.get(node.type) : undefined;
    return node ? getSubGroupSlug(node.type, spec?.category ?? '') : '';
  });

  /** Icon identifier for the node this lane's region belongs to. */
  const nodeIconIdentifier = $derived.by(() => {
    const graph = getGraph();
    const lane = graph.automation?.lanes.find((l) => l.id === laneId);
    if (!lane) return undefined;
    const node = graph.nodes.find((n: { id: string }) => n.id === lane.nodeId);
    const spec = node ? nodeSpecsMap.get(node.type) : undefined;
    return spec ? getNodeIcon(spec) : undefined;
  });

  const keyframesSorted = $derived.by(() => {
    if (!curve?.keyframes?.length) return [];
    return [...curve.keyframes].sort((a, b) => a.time - b.time);
  });

  const regionBars = $derived.by(() => {
    const graph = getGraph();
    const lane = graph.automation?.lanes.find((l) => l.id === laneId);
    const reg = lane?.regions.find((r) => r.id === regionId);
    const bpm = graph.automation?.bpm ?? 120;
    if (!reg || !bpm) return 4;
    const barSeconds = 60 / bpm;
    return Math.max(0.25, reg.duration / barSeconds);
  });

  /** Region startTime and duration (seconds) for waveform slice. */
  const regionTimeRange = $derived.by(() => {
    const graph = getGraph();
    const lane = graph.automation?.lanes.find((l) => l.id === laneId);
    const reg = lane?.regions.find((r) => r.id === regionId);
    if (!reg) return null;
    return { startTime: reg.startTime, endTime: reg.startTime + reg.duration };
  });

  const hasKeyframeSelection = $derived(
    selectedKeyframeIndex !== null && !!curve && keyframesSorted[selectedKeyframeIndex] != null
  );
  const selectedKf = $derived(
    hasKeyframeSelection && selectedKeyframeIndex !== null ? keyframesSorted[selectedKeyframeIndex] ?? null : null
  );
  const keyframeParamVal = $derived(selectedKf != null ? normalizedToParam(selectedKf.value) : '');

  function timeToX(t: number): number {
    return GRAPH_PADDING.left + t * (graphWidth - GRAPH_PADDING.left - GRAPH_PADDING.right);
  }

  function valueToY(v: number): number {
    return GRAPH_PADDING.top + (1 - v) * (graphHeight - GRAPH_PADDING.top - GRAPH_PADDING.bottom);
  }

  function xToTime(x: number): number {
    const w = graphWidth - GRAPH_PADDING.left - GRAPH_PADDING.right;
    if (w <= 0) return 0;
    const t = (x - GRAPH_PADDING.left) / w;
    return Math.max(0, Math.min(1, t));
  }

  function yToValue(y: number): number {
    const h = graphHeight - GRAPH_PADDING.top - GRAPH_PADDING.bottom;
    if (h <= 0) return 0;
    const v = 1 - (y - GRAPH_PADDING.top) / h;
    return Math.max(0, Math.min(1, v));
  }

  function maybeSnapTime(t: number): number {
    if (!snapEnabled) return t;
    return snapTimeToBarGrid(t, regionBars, snapDivision);
  }

  function updateCurve(newCurve: AutomationCurve) {
    const graph = getGraph();
    const updated = updateAutomationRegion(graph, laneId, regionId, { curve: newCurve });
    onGraphUpdate(updated);
  }

  function getGraphRect(): DOMRect {
    return svgEl?.getBoundingClientRect() ?? new DOMRect(0, 0, graphWidth, graphHeight);
  }

  function clientToGraph(clientX: number, clientY: number): { x: number; y: number; t: number; v: number } {
    const rect = getGraphRect();
    const scaleX = graphWidth / rect.width;
    const scaleY = graphHeight / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    return { x, y, t: xToTime(x), v: yToValue(y) };
  }

  function getKeyframeHitRadius(): number {
    if (!rootEl) return 7;
    const r = getComputedStyle(rootEl).getPropertyValue('--curve-keyframe-radius').trim();
    const num = r ? parseFloat(r) : 5;
    return (Number.isFinite(num) ? num : 5) + 2;
  }

  function hitKeyframe(clientX: number, clientY: number): number | null {
    const rect = getGraphRect();
    const scaleX = graphWidth / rect.width;
    const scaleY = graphHeight / rect.height;
    const px = (clientX - rect.left) * scaleX;
    const py = (clientY - rect.top) * scaleY;
    const hitR = getKeyframeHitRadius();
    for (let i = 0; i < keyframesSorted.length; i++) {
      const kf = keyframesSorted[i];
      const kx = timeToX(kf.time);
      const ky = valueToY(kf.value);
      const d = Math.hypot(px - kx, py - ky);
      if (d <= hitR) return i;
    }
    return null;
  }

  function hitCurve(clientX: number, clientY: number): { t: number; v: number } | null {
    const { t, v } = clientToGraph(clientX, clientY);
    if (!curve) return null;
    const curveV = evaluateCurveAtNormalizedTime(curve, t);
    const rect = getGraphRect();
    const scaleY = graphHeight / rect.height;
    const dyPx = Math.abs(v - curveV) * (graphHeight - GRAPH_PADDING.top - GRAPH_PADDING.bottom);
    const dyScaled = dyPx * scaleY;
    if (dyScaled <= CURVE_HIT_MARGIN) return { t, v: curveV };
    return null;
  }

  const INTERP_OPTIONS: Array<{ value: AutomationCurveInterpolation; label: string }> = [
    { value: 'bezier', label: 'Bezier' },
    { value: 'linear', label: 'Linear' },
    { value: 'stepped', label: 'Stepped' },
  ];

  const interpLabel = $derived.by(() => {
    const interp = curve?.interpolation ?? 'bezier';
    return INTERP_OPTIONS.find((o) => o.value === interp)?.label ?? 'Bezier';
  });

  const interpMenuItems = $derived(
    INTERP_OPTIONS.map((opt) => ({
      label: opt.label,
      action: () => {
        if (curve) updateCurve({ ...curve, interpolation: opt.value });
      },
    }))
  );

  const snapGridLabel = $derived(snapDivision === 1 ? '1' : `1/${snapDivision}`);
  const snapGridMenuItems = $derived(
    SNAP_DIVISIONS.map((d) => ({
      label: d === 1 ? '1' : `1/${d}`,
      action: () => {
        snapDivision = d;
      },
    }))
  );

  function handleSnapToggle(): void {
    snapEnabled = !snapEnabled;
  }

  function addKeyframeAt(t: number, v: number) {
    if (!curve) return;
    const inserted = [...keyframesSorted, { time: t, value: v }].sort((a, b) => a.time - b.time);
    updateCurve({ ...curve, keyframes: inserted });
    const idx = inserted.findIndex((k) => k.time === t);
    selectedKeyframeIndex = idx >= 0 ? idx : null;
  }

  function removeSelectedKeyframe() {
    if (selectedKeyframeIndex === null) return;
    if (keyframesSorted.length <= 2) return;
    if (!curve) return;
    const removed = keyframesSorted.filter((_, i) => i !== selectedKeyframeIndex);
    updateCurve({ ...curve, keyframes: removed });
    selectedKeyframeIndex = null;
  }

  function handleKeyframeValueInput(e: Event) {
    if (selectedKeyframeIndex === null || !curve) return;
    const raw = (e.target as HTMLInputElement).value;
    const num = parseFloat(raw);
    if (!Number.isFinite(num)) return;
    const normalized = paramToNormalized(num);
    const keyframes = keyframesSorted.map((k, i) =>
      i === selectedKeyframeIndex ? { ...k, value: normalized } : k
    );
    updateCurve({ ...curve, keyframes });
  }

  function handleGraphMousedown(e: MouseEvent) {
    if (e.button !== 0) return;
    const keyframeIndex = hitKeyframe(e.clientX, e.clientY);
    if (keyframeIndex !== null) {
      dragKeyframeIndex = keyframeIndex;
      selectedKeyframeIndex = keyframeIndex;
      return;
    }
    const curveHit = hitCurve(e.clientX, e.clientY);
    if (curveHit) {
      const t = maybeSnapTime(curveHit.t);
      addKeyframeAt(t, curveHit.v);
      return;
    }
    selectedKeyframeIndex = null;
  }

  function handleGraphDblclick(e: MouseEvent) {
    if (e.button !== 0) return;
    const curveHit = hitCurve(e.clientX, e.clientY);
    if (curveHit) {
      const t = maybeSnapTime(curveHit.t);
      addKeyframeAt(t, curveHit.v);
    }
  }

  function handleGraphContextMenu(e: MouseEvent) {
    e.preventDefault();
    if (selectedKeyframeIndex !== null) {
      removeSelectedKeyframe();
    }
  }

  function handleKeyDown(e: KeyboardEvent): void {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;
    if (e.key !== 'Delete' && e.key !== 'Backspace') return;
    if (!rootEl?.contains(target) && !rootEl?.contains(document.activeElement ?? null)) return;
    e.preventDefault();
    removeSelectedKeyframe();
  }

  // Curve path d attribute
  const curvePathD = $derived.by(() => {
    if (!curve) return '';
    const pathD: string[] = [];
    for (let i = 0; i <= SAMPLES; i++) {
      const t = i / SAMPLES;
      const v = evaluateCurveAtNormalizedTime(curve, t);
      const x = timeToX(t);
      const y = valueToY(v);
      pathD.push(`${i === 0 ? 'M' : 'L'} ${x} ${y}`);
    }
    return pathD.join(' ');
  });

  // Waveform background path (stereo: up = left, down = right; peak-normalized like bottom bar)
  const waveformPathD = $derived.by(() => {
    const left = waveformSliceLeft;
    const right = waveformSliceRight;
    if (left.length < 2) return '';
    const n = left.length;
    const innerH = graphHeight - GRAPH_PADDING.top - GRAPH_PADDING.bottom;
    const bandHalf = (innerH * WAVEFORM_BAND_FRACTION) / 2;
    const centerY = valueToY(0.5);
    const maxL = Math.max(...left);
    const maxR = Math.max(...right);
    const scaleL = maxL > 0 ? 1 / maxL : 0;
    const scaleR = maxR > 0 ? 1 / maxR : 0;
    const parts: string[] = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const x = timeToX(t);
      const vL = (left[i] ?? 0) * scaleL;
      const topY = centerY - vL * bandHalf;
      parts.push(`${i === 0 ? 'M' : 'L'} ${x} ${topY}`);
    }
    for (let i = n - 1; i >= 0; i--) {
      const t = i / (n - 1);
      const x = timeToX(t);
      const vR = (right[i] ?? 0) * scaleR;
      const bottomY = centerY + vR * bandHalf;
      parts.push(`L ${x} ${bottomY}`);
    }
    parts.push('Z');
    return parts.join(' ');
  });

  // Grid lines
  const gridLines = $derived.by(() => {
    const innerW = graphWidth - GRAPH_PADDING.left - GRAPH_PADDING.right;
    const innerH = graphHeight - GRAPH_PADDING.top - GRAPH_PADDING.bottom;
    if (innerW <= 0 || innerH <= 0) return { vertical: [], horizontal: [] };
    const bars = regionBars;
    const division = snapDivision;
    const minorStep = 1 / (bars * division);
    const vertical: Array<{ x: number; class: string }> = [];
    for (let t = 0; t <= 1 + 1e-6; t += minorStep) {
      const x = timeToX(t);
      const barFrac = t * bars;
      const inBar = barFrac - Math.floor(barFrac);
      const isBar = Math.abs(barFrac - Math.round(barFrac)) < 1e-6 || t >= 1 - 1e-6;
      const isSixteenthOnly =
        division >= 16 &&
        !isBar &&
        Math.abs(inBar * 8 - Math.round(inBar * 8)) > 1e-6 &&
        Math.abs(inBar * 16 - Math.round(inBar * 16)) < 1e-6;
      let lineClass = 'grid-line';
      if (isBar) lineClass += ' grid-line-major';
      else if (isSixteenthOnly) lineClass += ' grid-line-sub';
      else lineClass += ' grid-line-minor';
      vertical.push({ x, class: lineClass });
    }
    const horizontal: Array<{ y: number }> = [];
    for (let i = 1; i <= 3; i++) {
      horizontal.push({ y: valueToY(i / 4) });
    }
    return { vertical, horizontal };
  });

  // Fetch waveform slice for region when getWaveformData and region available (stereo: left + right)
  $effect(() => {
    const getData = getWaveformData;
    const range = regionTimeRange;
    if (!getData || !range) {
      waveformSliceLeft = [];
      waveformSliceRight = [];
      return;
    }
    let cancelled = false;
    getData()
      .then((data) => {
        if (cancelled || data.values.length === 0 || data.durationSeconds <= 0) return;
        const sliceL = getWaveformSlice(
          data.values,
          data.durationSeconds,
          range.startTime,
          range.endTime
        );
        const rightValues =
          data.valuesRight != null && data.valuesRight.length === data.values.length
            ? data.valuesRight
            : data.values;
        const sliceR = getWaveformSlice(
          rightValues,
          data.durationSeconds,
          range.startTime,
          range.endTime
        );
        if (!cancelled) {
          waveformSliceLeft = sliceL;
          waveformSliceRight = sliceR;
        }
      })
      .catch(() => {
        if (!cancelled) {
          waveformSliceLeft = [];
          waveformSliceRight = [];
        }
      });
    return () => {
      cancelled = true;
    };
  });

  // ResizeObserver
  $effect(() => {
    const el = graphWrapEl;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        graphWidth = Math.max(1, rect.width);
        graphHeight = Math.max(1, rect.height);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  });

  // Global mousemove for drag
  $effect(() => {
    const idx = dragKeyframeIndex;
    if (idx === null) return;
    const dragIdx: number = idx;
    function onMouseMove(e: MouseEvent) {
      const { t, v } = clientToGraph(e.clientX, e.clientY);
      const graph = getGraph();
      const region = graph.automation?.lanes.find((l) => l.id === laneId)?.regions.find((r) => r.id === regionId);
      const keyframes = region?.curve ? [...region.curve.keyframes].sort((a, b) => a.time - b.time) : [];
      if (dragIdx >= keyframes.length) return;
      const prev = keyframes[dragIdx - 1];
      const next = keyframes[dragIdx + 1];
      const isFirst = dragIdx === 0;
      const isLast = dragIdx === keyframes.length - 1;
      let time: number;
      if (isFirst) time = 0;
      else if (isLast) time = 1;
      else {
        time = Math.max(0, Math.min(1, maybeSnapTime(t)));
        if (prev != null) time = Math.max(time, prev.time + 0.001);
        if (next != null) time = Math.min(time, next.time - 0.001);
      }
      const value = Math.max(0, Math.min(1, v));
      const newKeyframes = keyframes.map((k, i) => (i === dragIdx ? { time, value } : k));
      newKeyframes.sort((a, b) => a.time - b.time);
      const curve = region?.curve;
      if (curve) updateCurve({ ...curve, keyframes: newKeyframes });
    }
    function onMouseUp() {
      dragKeyframeIndex = null;
    }
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp, { once: true });
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
    };
  });

  // Keydown for Delete/Backspace on selected keyframe (global so it works when focus is elsewhere)
  $effect(() => {
    const keyHandler = (e: KeyboardEvent) => handleKeyDown(e);
    document.addEventListener('keydown', keyHandler);
    return () => document.removeEventListener('keydown', keyHandler);
  });
</script>

<div bind:this={rootEl} class="curve-editor" data-category={categorySlug} data-subgroup={subGroupSlug || undefined}>
  <div class="header">
    <div class="header-left">
      {#if nodeIconIdentifier}
        <span class="title-icon" aria-hidden="true">
          <NodeIconSvg identifier={nodeIconIdentifier} />
        </span>
      {/if}
      <span class="title" title={laneLabel}>{laneLabel}</span>
    </div>
    <div class="header-right">
      <div class="keyframe-input-wrap">
        <Input
          type="number"
          size="sm"
          variant="primary"
          value={keyframeParamVal}
          step={paramSpec.step ?? (paramSpec.max - paramSpec.min) / 100}
          min={paramSpec.min}
          max={paramSpec.max}
          disabled={!hasKeyframeSelection}
          placeholder={hasKeyframeSelection ? undefined : '—'}
          oninput={handleKeyframeValueInput}
          aria-label="Selected keyframe value"
        />
      </div>
      <div class="header-controls">
        <div bind:this={interpButtonEl} class="interp-button-anchor">
          <Button
            variant="ghost"
            size="sm"
            class="interp-button"
            title="Interpolation"
            onclick={() => (interpMenuOpen = !interpMenuOpen)}
          >
            <span class="interp-label">{interpLabel}</span>
          </Button>
        </div>
        <DropdownMenu
          open={interpMenuOpen}
          anchor={interpButtonEl}
          openAbove={true}
          onClose={() => (interpMenuOpen = false)}
        >
          {#snippet children()}
            {#each interpMenuItems as item}
              <MenuItem
                label={item.label}
                onclick={() => {
                  item.action();
                  interpMenuOpen = false;
                }}
              />
            {/each}
          {/snippet}
        </DropdownMenu>
        <div class="snap-wrap">
          <Button
            variant="ghost"
            size="sm"
            mode="icon-only"
            class="snap-toggle {snapEnabled ? 'is-active' : ''}"
            title="Snap keyframe time to musical grid"
            onclick={handleSnapToggle}
          >
            <IconSvg name="hash-straight" />
          </Button>
          <div bind:this={snapGridButtonEl} class="snap-grid-button-anchor">
            <Button
              variant="ghost"
              size="sm"
              class="snap-grid-button"
              title="Snap grid size (bar fraction)"
              disabled={!snapEnabled}
              onclick={() => (snapGridOpen = !snapGridOpen)}
            >
              <span class="snap-grid-label">{snapGridLabel}</span>
            </Button>
          </div>
          <DropdownMenu
            open={snapGridOpen}
            anchor={snapGridButtonEl}
            openAbove={true}
            onClose={() => (snapGridOpen = false)}
          >
            {#snippet children()}
              {#each snapGridMenuItems as item}
                <MenuItem
                  label={item.label}
                  onclick={() => {
                    item.action();
                    snapGridOpen = false;
                  }}
                />
              {/each}
            {/snippet}
          </DropdownMenu>
        </div>
        <Button variant="ghost" size="sm" mode="both" iconPosition="trailing" class="close" title="Close curve editor" onclick={onClose}>
          Close
          <IconSvg name="x" />
        </Button>
      </div>
    </div>
  </div>

  <!-- svelte-ignore a11y_no_noninteractive_element_interactions - graph editor requires mouse handlers on container -->
  <div
    bind:this={graphWrapEl}
    class="graph-wrap"
    role="application"
    aria-label="Automation curve graph"
    onmousedown={handleGraphMousedown}
    ondblclick={handleGraphDblclick}
    oncontextmenu={handleGraphContextMenu}
  >
    <svg bind:this={svgEl} class="graph-svg" viewBox="0 0 {graphWidth} {graphHeight}" preserveAspectRatio="none">
      <defs>
        <clipPath id="curve-editor-clip">
          <rect
            x={GRAPH_PADDING.left}
            y={GRAPH_PADDING.top}
            width={graphWidth - GRAPH_PADDING.left - GRAPH_PADDING.right}
            height={graphHeight - GRAPH_PADDING.top - GRAPH_PADDING.bottom}
          />
        </clipPath>
      </defs>
      {#if waveformPathD}
        <g class="graph-waveform" clip-path="url(#curve-editor-clip)" aria-hidden="true">
          <path
            class="graph-waveform-path"
            d={waveformPathD}
            fill="currentColor"
            style="opacity: {WAVEFORM_OPACITY};"
          />
        </g>
      {/if}
      <g class="graph-grid">
        {#each gridLines.vertical as { x, class: lineClass }}
          <line x1={x} y1={GRAPH_PADDING.top} x2={x} y2={graphHeight - GRAPH_PADDING.bottom} class={lineClass} />
        {/each}
        {#each gridLines.horizontal as { y }}
          <line
            x1={GRAPH_PADDING.left}
            y1={y}
            x2={graphWidth - GRAPH_PADDING.right}
            y2={y}
            class="grid-line"
          />
        {/each}
      </g>
      <g class="value-axis-labels" aria-hidden="true">
        <text x={GRAPH_PADDING.left - 6} y={valueToY(1)} class="value-axis-label value-axis-max" text-anchor="end" dominant-baseline="middle">{paramSpec.max}</text>
        <text x={GRAPH_PADDING.left - 6} y={valueToY(0)} class="value-axis-label value-axis-min" text-anchor="end" dominant-baseline="middle">{paramSpec.min}</text>
      </g>
      <rect
        class="graph-border"
        x={GRAPH_PADDING.left}
        y={GRAPH_PADDING.top}
        width={graphWidth - GRAPH_PADDING.left - GRAPH_PADDING.right}
        height={graphHeight - GRAPH_PADDING.top - GRAPH_PADDING.bottom}
        fill="none"
      />
      {#if curve}
        <path class="graph-path" d={curvePathD} clip-path="url(#curve-editor-clip)" />
        <g class="graph-keyframes">
          {#each keyframesSorted as kf, index}
            <g class="graph-keyframe" data-index={index}>
              <circle
                class="graph-keyframe-circle"
                class:is-selected={selectedKeyframeIndex === index}
                cx={timeToX(kf.time)}
                cy={valueToY(kf.value)}
                data-index={index}
              />
            </g>
          {/each}
        </g>
      {/if}
    </svg>
  </div>
</div>
