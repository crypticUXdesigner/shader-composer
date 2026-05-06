<script lang="ts">
  /**
   * TimelineCurveEditor
   * Edits keyframes and interpolation for one automation region.
   * Normalized time [0,1] horizontal, value [0,1] vertical.
   */
  import type { Action } from 'svelte/action';
  import { Button, DropdownMenu, MenuItem, IconSvg, NodeIconSvg } from '../ui';
  import EditorParameterValueOverlay from '../editor/EditorParameterValueOverlay.svelte';
  import { updateAutomationRegion } from '../../../data-model';
  import type { NodeGraph } from '../../../data-model/types';
  import type { AutomationCurve, AutomationCurveInterpolation } from '../../../data-model/types';
  import type { NodeSpec } from '../../../types/nodeSpec';
  import { getWaveformSlice } from '../../../runtime/waveform/WaveformService';
  import { pollOnAnimationFrame } from '../../utils/pollOnAnimationFrame';
  import {
    GRAPH_PADDING,
    curveClientToGraph,
    curveClientToSvgCoords,
    curveKeyframeCenterScreen,
    curveTimeToX,
    curveValueToY,
    diamondPolygonPoints,
  } from './curveEditorGeometry';
  import { resolveCurveEditorRegion } from './curveEditorRegionContext';
  import {
    buildCurveEditorCurvePathD,
    buildCurveEditorGridLines,
    buildCurveEditorWaveformPathD,
  } from './curveEditorSvgScene';
  import {
    SNAP_DIVISIONS,
    type CurveEditorDragSession,
    type SnapDivision,
    indexOfInsertedKeyframe,
    maybeSnapCurveKeyframeTime,
    proposeDragKeyframes,
    remapSelectionIndices,
    stableTimeSortKeyframes,
  } from './curveEditorKeyframes';

  /** Half side length (SVG units) for endpoint squares; diamonds use same apex radius. */
  const KEYFRAME_MARK_HALF = 6.5;
  const KEYFRAME_DIAMOND_R = KEYFRAME_MARK_HALF;
  const WAVEFORM_OPACITY = 0.28;

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
    paramLabel: string;
    onRevealInNodeEditor?: (nodeId: string, paramName: string) => void;
    nodeSpecs?: NodeSpec[];
    /** Optional: for waveform background. Returns full primary waveform; slice is computed from region times. */
    getWaveformData?: GetWaveformData;
    /** When set, a vertical playhead tracks global transport time mapped onto this region's horizontal range. */
    getCurrentTransportTime?: () => number;
    /** When set, single-click / drag on empty graph seeks the global transport time. */
    onSeek?: (timeSeconds: number) => void;
    /**
     * Optional wall-clock range (seconds) while the timeline region is dragged/resized —
     * waveform background and snap/grid span track this before the graph commits.
     */
    regionTimeRangePreview?: { startTime: number; endTime: number } | null;
  }

  let {
    getGraph,
    onGraphUpdate,
    onClose,
    laneId,
    regionId,
    paramLabel,
    onRevealInNodeEditor,
    nodeSpecs = [],
    getWaveformData,
    getCurrentTransportTime,
    onSeek,
    regionTimeRangePreview = null,
  }: Props = $props();

  let graphWrapEl: HTMLDivElement | null = null;
  let svgEl: SVGElement | null = null;
  let rootEl: HTMLElement | null = null;

  let graphWidth = $state(300);
  let graphHeight = $state(120);
  /** Sorted unique indices into `keyframesSorted` (selection set). */
  let selectedKeyframeIndices = $state<number[]>([]);
  let dragKeyframeSession = $state<CurveEditorDragSession | null>(null);
  let dragKeyframePointerId = $state<number | null>(null);
  let snapEnabled = $state(false);
  let snapDivision = $state<SnapDivision>(1);
  let snapGridOpen = $state(false);
  let snapGridButtonEl = $state<HTMLDivElement | null>(null);
  let interpMenuOpen = $state(false);
  let interpButtonEl = $state<HTMLDivElement | null>(null);
  let waveformSliceLeft = $state<number[]>([]);
  let waveformSliceRight = $state<number[]>([]);

  /** Index into `keyframesSorted` while pointer is over that keyframe hit area. */
  let hoveredKeyframeIndex = $state<number | null>(null);
  /** Screen coords for keyframe value tooltip (above mark center). */
  let keyframeTooltipScreen = $state<{ x: number; y: number } | null>(null);

  let valueOverlayVisible = $state(false);
  let valueOverlayX = $state(0);
  let valueOverlayY = $state(0);
  let valueOverlayW = $state(140);
  let valueOverlayH = $state(40);
  let valueOverlayValue = $state(0);
  let valueOverlayEditIndex = $state<number | null>(null);

  /** Bumped every frame when `getCurrentTransportTime` is set so the curve playhead tracks preview playback. */
  let transportTimeTick = $state(0);

  let playheadSeekDragging = $state(false);
  let playheadSeekPointerId = $state<number | null>(null);

  const nodeSpecsMap = $derived(new Map(nodeSpecs.map((s) => [s.id, s])));

  /** One graph walk: lane, region, node, parameter range, grid bars, CSS slugs. */
  const regionCtx = $derived.by(() =>
    resolveCurveEditorRegion(getGraph(), laneId, regionId, nodeSpecsMap)
  );

  const paramSpec = $derived(regionCtx.paramRange);

  function normalizedToParam(n: number): number {
    const { min, max } = paramSpec;
    return min + n * (max - min);
  }

  function paramToNormalized(p: number): number {
    const { min, max } = paramSpec;
    if (max === min) return 0;
    return Math.max(0, Math.min(1, (p - min) / (max - min)));
  }

  const curve = $derived(regionCtx.region?.curve ?? null);

  const categorySlug = $derived(regionCtx.categorySlug);

  const subGroupSlug = $derived(regionCtx.subGroupSlug);

  /** Icon identifier for the node this lane's region belongs to. */
  const nodeIconIdentifier = $derived(regionCtx.nodeIconIdentifier);

  const nodeJumpEnabled = $derived(Boolean(onRevealInNodeEditor && regionCtx.lane));

  function handleRevealClick(): void {
    const lane = regionCtx.lane;
    if (!lane || !onRevealInNodeEditor) return;
    onRevealInNodeEditor(lane.nodeId, lane.paramName);
  }

  const keyframesSorted = $derived.by(() => {
    if (!curve?.keyframes?.length) return [];
    return [...curve.keyframes].sort((a, b) => a.time - b.time);
  });

  const regionBars = $derived(regionCtx.regionBars);

  /** Region startTime and duration (seconds) for waveform slice. */
  const regionTimeRange = $derived(regionCtx.regionTimeRange);

  /** Waveform + playhead + bar grid: preview range when timeline drag/resize is in progress. */
  const waveformRegionTimeRange = $derived.by(() => {
    const p = regionTimeRangePreview;
    if (p != null && Number.isFinite(p.startTime) && Number.isFinite(p.endTime) && p.endTime > p.startTime) {
      return p;
    }
    return regionTimeRange;
  });

  const effectiveRegionBars = $derived.by(() => {
    const range = waveformRegionTimeRange;
    const bpm = getGraph().automation?.bpm ?? 120;
    if (!range || bpm <= 0) return regionBars;
    const barSeconds = 60 / bpm;
    const dur = range.endTime - range.startTime;
    return Math.max(0.25, dur / barSeconds);
  });

  $effect(() => {
    if (!getCurrentTransportTime) return;
    return pollOnAnimationFrame(() => {
      transportTimeTick += 1;
    });
  });

  /** Global time mapped to normalized region X in SVG space; null when no range or no transport ticker. */
  const transportPlayheadSvgX = $derived.by(() => {
    void transportTimeTick;
    void graphWidth;
    const getT = getCurrentTransportTime;
    const range = waveformRegionTimeRange;
    if (!getT || !range || range.endTime <= range.startTime) return null;
    const t = getT();
    const span = range.endTime - range.startTime;
    const u = (t - range.startTime) / span;
    const clamped = Math.max(0, Math.min(1, u));
    return curveTimeToX(clamped, graphWidth);
  });

  const selectedKeyframeSet = $derived(new Set(selectedKeyframeIndices));

  const hasKeyframeSelection = $derived(selectedKeyframeIndices.length > 0 && !!curve);

  function formatParamDisplay(p: number): string {
    return paramSpec.paramType === 'int' ? String(Math.round(p)) : Number(p).toFixed(3);
  }

  function timeToX(t: number): number {
    return curveTimeToX(t, graphWidth);
  }

  function valueToY(v: number): number {
    return curveValueToY(v, graphHeight);
  }

  function pruneSelectedIndicesIfStale(): void {
    const max = Math.max(0, keyframesSorted.length - 1);
    const prunedSorted = [...new Set(selectedKeyframeIndices.filter((i) => i >= 0 && i <= max))].sort(
      (a, b) => a - b
    );
    if (
      prunedSorted.length !== selectedKeyframeIndices.length ||
      prunedSorted.some((v, j) => v !== selectedKeyframeIndices[j])
    ) {
      selectedKeyframeIndices = prunedSorted;
    }
  }

  function applySelectionClick(hitIndex: number, additive: boolean): void {
    if (!additive) {
      selectedKeyframeIndices = [hitIndex];
      return;
    }
    const s = new Set(selectedKeyframeIndices);
    if (s.has(hitIndex)) s.delete(hitIndex);
    else s.add(hitIndex);
    selectedKeyframeIndices = [...s].sort((a, b) => a - b);
  }

  const pruneStaleKeyframeSelection: Action<
    HTMLElement,
    { keyframesRef: unknown }
  > = (_node, _init) => ({
    update(p) {
      void p.keyframesRef;
      pruneSelectedIndicesIfStale();
    },
  });

  const focusGraphWhenRegionTargeted: Action<
    HTMLElement,
    { laneId: string; regionId: string }
  > = (node, _init) => ({
    update(_p) {
      queueMicrotask(() => {
        node.focus({ preventScroll: true });
      });
    },
  });

  function updateCurve(newCurve: AutomationCurve) {
    const graph = getGraph();
    const updated = updateAutomationRegion(graph, laneId, regionId, { curve: newCurve });
    onGraphUpdate(updated);
  }

  function getGraphRect(): DOMRect {
    return svgEl?.getBoundingClientRect() ?? new DOMRect(0, 0, graphWidth, graphHeight);
  }

  function clientToGraph(clientX: number, clientY: number): { x: number; y: number; t: number; v: number } {
    return curveClientToGraph(clientX, clientY, getGraphRect(), graphWidth, graphHeight);
  }

  function getKeyframeHitRadius(): number {
    if (!rootEl) return 7;
    const r = getComputedStyle(rootEl).getPropertyValue('--curve-keyframe-radius').trim();
    const num = r ? parseFloat(r) : 5;
    return (Number.isFinite(num) ? num : 5) + 2;
  }

  function hitKeyframe(clientX: number, clientY: number): number | null {
    const rect = getGraphRect();
    const { px, py } = curveClientToSvgCoords(clientX, clientY, rect, graphWidth, graphHeight);
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

  function seekFromClient(clientX: number, clientY: number): void {
    const cb = onSeek;
    const range = waveformRegionTimeRange;
    if (!cb || !range || range.endTime <= range.startTime) return;
    const { t } = clientToGraph(clientX, clientY);
    const span = range.endTime - range.startTime;
    const seconds = range.startTime + Math.max(0, Math.min(1, t)) * span;
    cb(seconds);
  }

  /** Screen-space center of keyframe mark (for tooltip / value overlay placement). */
  function keyframeCenterScreen(index: number): { x: number; y: number } | null {
    return curveKeyframeCenterScreen(index, keyframesSorted, getGraphRect(), graphWidth, graphHeight);
  }

  function closeValueOverlay(): void {
    valueOverlayVisible = false;
    valueOverlayEditIndex = null;
  }

  function commitKeyframeValueFromOverlay(raw: number): void {
    const idx = valueOverlayEditIndex;
    if (idx === null || !curve) {
      closeValueOverlay();
      return;
    }
    let p = paramSpec.paramType === 'int' ? Math.round(raw) : raw;
    p = Math.max(paramSpec.min, Math.min(paramSpec.max, p));
    const normalized = paramToNormalized(p);
    const keyframes = keyframesSorted.map((k, i) =>
      i === idx ? { ...k, value: normalized } : k
    );
    updateCurve({ ...curve, keyframes });
    closeValueOverlay();
  }

  function openValueOverlayForKeyframe(index: number, clientX: number, clientY: number): void {
    if (!curve || index < 0 || index >= keyframesSorted.length) return;
    const kf = keyframesSorted[index];
    const center = keyframeCenterScreen(index);
    const ax = center?.x ?? clientX;
    const ay = center?.y ?? clientY;
    valueOverlayW = 140;
    valueOverlayH = 40;
    valueOverlayX = Math.round(ax - valueOverlayW / 2);
    valueOverlayY = Math.round(ay - valueOverlayH - 10);
    valueOverlayValue = normalizedToParam(kf.value);
    valueOverlayEditIndex = index;
    valueOverlayVisible = true;
    selectedKeyframeIndices = [index];
  }

  const keyframeTooltipText = $derived.by(() => {
    const i = hoveredKeyframeIndex;
    if (i === null || i < 0 || i >= keyframesSorted.length) return '';
    return formatParamDisplay(normalizedToParam(keyframesSorted[i]!.value));
  });

  function handleGraphPointermove(e: PointerEvent): void {
    if (valueOverlayVisible) {
      hoveredKeyframeIndex = null;
      keyframeTooltipScreen = null;
      return;
    }
    const hit = hitKeyframe(e.clientX, e.clientY);
    hoveredKeyframeIndex = hit;
    if (hit === null) {
      keyframeTooltipScreen = null;
      return;
    }
    const center = keyframeCenterScreen(hit);
    if (center) {
      keyframeTooltipScreen = { x: center.x, y: center.y - 22 };
    } else {
      keyframeTooltipScreen = { x: e.clientX, y: e.clientY - 28 };
    }
  }

  function handleGraphMouseleave(): void {
    hoveredKeyframeIndex = null;
    keyframeTooltipScreen = null;
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

  function addKeyframeAt(tRaw: number, vRaw: number) {
    if (!curve) return;
    const t = maybeSnapCurveKeyframeTime(tRaw, { snapEnabled, regionBars: effectiveRegionBars, snapDivision });
    const v = Math.max(0, Math.min(1, vRaw));
    const inserted = [...keyframesSorted.map((kf) => ({ ...kf })), { time: t, value: v }]
      .map((kf, idx) => ({ kf, idx }))
      .sort((a, b) =>
        a.kf.time !== b.kf.time ? a.kf.time - b.kf.time : a.idx - b.idx
      )
      .map((row) => row.kf);
    updateCurve({ ...curve, keyframes: inserted });
    const sel = indexOfInsertedKeyframe(inserted, t, v);
    selectedKeyframeIndices = [sel];
  }

  function removeSelectedKeyframes() {
    if (!curve || selectedKeyframeIndices.length === 0) return;
    const selSet = new Set(selectedKeyframeIndices);
    if (keyframesSorted.length - selSet.size < 2) return;
    const removed = keyframesSorted.filter((_k, i) => !selSet.has(i));
    updateCurve({ ...curve, keyframes: removed });
    selectedKeyframeIndices = [];
    dragKeyframeSession = null;
  }

  function handleGraphPointerdown(e: PointerEvent): void {
    if (e.button !== 0) return;
    graphWrapEl?.focus({ preventScroll: true });
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;
    const keyframeHit = hitKeyframe(e.clientX, e.clientY);
    if (keyframeHit !== null) {
      /** Second/third click of a double- or triple-click: avoid re-toggling selection or starting drag. */
      if (e.detail > 1) return;
      applySelectionClick(keyframeHit, additive);
      if (selectedKeyframeIndices.length === 0) return;

      const { t: anchorT, v: anchorV } = clientToGraph(e.clientX, e.clientY);
      dragKeyframeSession = {
        startKeyframes: keyframesSorted.map((k) => ({ ...k })),
        selectedIndicesSorted: [...selectedKeyframeIndices],
        anchorT,
        anchorV,
      };
      dragKeyframePointerId = e.pointerId;
      return;
    }

    // Empty graph seek: single click sets playhead; drag scrubs (but don't block dblclick add-keyframe).
    if (onSeek && e.detail <= 1) {
      e.preventDefault();
      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);
      playheadSeekDragging = true;
      playheadSeekPointerId = e.pointerId;
      seekFromClient(e.clientX, e.clientY);

      const onMove = (e2: PointerEvent): void => {
        if (!playheadSeekDragging || playheadSeekPointerId !== e.pointerId) return;
        e2.preventDefault();
        seekFromClient(e2.clientX, e2.clientY);
      };
      const onUp = (e2: PointerEvent): void => {
        if (e2.pointerId === e.pointerId) {
          target.releasePointerCapture(e2.pointerId);
        }
        playheadSeekDragging = false;
        playheadSeekPointerId = null;
        target.removeEventListener('pointermove', onMove);
        target.removeEventListener('pointerup', onUp);
        target.removeEventListener('pointercancel', onUp);
      };

      target.addEventListener('pointermove', onMove);
      target.addEventListener('pointerup', onUp);
      target.addEventListener('pointercancel', onUp);
    }

    if (!additive) selectedKeyframeIndices = [];
    dragKeyframeSession = null;
    dragKeyframePointerId = null;
  }

  function handleGraphDblclick(e: MouseEvent): void {
    if (e.button !== 0) return;
    e.preventDefault();
    graphWrapEl?.focus({ preventScroll: true });
    const hit = hitKeyframe(e.clientX, e.clientY);
    if (hit !== null) {
      openValueOverlayForKeyframe(hit, e.clientX, e.clientY);
      return;
    }
    const { t, v } = clientToGraph(e.clientX, e.clientY);
    addKeyframeAt(t, v);
  }

  function handleKeyDownCapture(e: KeyboardEvent): void {
    const ae = document.activeElement as HTMLElement | null;
    if (
      ae?.tagName === 'INPUT' ||
      ae?.tagName === 'TEXTAREA' ||
      ae?.tagName === 'SELECT' ||
      ae?.isContentEditable
    )
      return;
    if (!rootEl?.matches(':focus-within')) return;
    if (e.key !== 'Delete' && e.key !== 'Backspace') return;
    if (selectedKeyframeIndices.length === 0) return;
    e.preventDefault();
    removeSelectedKeyframes();
  }

  const curvePathD = $derived.by(() => {
    if (!curve) return '';
    return buildCurveEditorCurvePathD(curve, graphWidth, graphHeight);
  });

  /** Waveform background path (stereo: up = left, down = right; peak-normalized like bottom bar). */
  const waveformPathD = $derived.by(() =>
    buildCurveEditorWaveformPathD(waveformSliceLeft, waveformSliceRight, graphWidth, graphHeight)
  );

  const gridLines = $derived.by(() =>
    buildCurveEditorGridLines(graphWidth, graphHeight, effectiveRegionBars, snapDivision)
  );

  // Fetch waveform slice for region when getWaveformData and region available (stereo: left + right)
  $effect(() => {
    const getData = getWaveformData;
    const range = waveformRegionTimeRange;
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

  // Global pointer move/up while dragging (multi-select group drag uses frozen session snapshot).
  $effect(() => {
    const cand = dragKeyframeSession;
    if (cand === null) return;
    const dragSnap: CurveEditorDragSession = cand;
    const ptrId = dragKeyframePointerId;
    if (ptrId == null) return;

    function onPointerMove(e: PointerEvent) {
      if (dragKeyframeSession === null) return;
      if (e.pointerId !== ptrId) return;
      const activeCurve = resolveCurveEditorRegion(getGraph(), laneId, regionId, nodeSpecsMap).region?.curve;
      if (!activeCurve) return;

      const ptr = clientToGraph(e.clientX, e.clientY);
      const proposed = proposeDragKeyframes(
        dragSnap.startKeyframes,
        dragSnap.selectedIndicesSorted,
        dragSnap.anchorT,
        dragSnap.anchorV,
        ptr.t,
        ptr.v,
        (tn) => maybeSnapCurveKeyframeTime(tn, { snapEnabled, regionBars: effectiveRegionBars, snapDivision })
      );

      const { sorted, oldToNew } = stableTimeSortKeyframes(proposed);
      updateCurve({ ...activeCurve, keyframes: sorted });
      selectedKeyframeIndices = remapSelectionIndices(dragSnap.selectedIndicesSorted, oldToNew);
    }

    function onPointerUp(e: PointerEvent) {
      if (e.pointerId !== ptrId) return;
      dragKeyframeSession = null;
      dragKeyframePointerId = null;
    }

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  });

</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex keyboard events require focus trap on graph-wrap; shortcuts gated by focus-within -->
<div
  bind:this={rootEl}
  class="curve-editor"
  data-category={categorySlug}
  data-subgroup={subGroupSlug || undefined}
  onkeydowncapture={handleKeyDownCapture}
>
  <span
    class="curve-editor-selection-sync"
    aria-hidden="true"
    use:pruneStaleKeyframeSelection={{ keyframesRef: keyframesSorted }}
  ></span>
  <div class="header">
    <div class="header-left">
      <Button
        variant="ghost"
        size="sm"
        class="header-jump"
        title="Reveal in node editor"
        disabled={!nodeJumpEnabled}
        onclick={handleRevealClick}
      >
        {#if nodeIconIdentifier}
          <span class="title-icon" aria-hidden="true">
            <NodeIconSvg identifier={nodeIconIdentifier} />
          </span>
        {/if}
        <span class="header-title" title={paramLabel}>{paramLabel}</span>
      </Button>
    </div>
    <div class="header-right">
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
        <Button
          variant="ghost"
          size="sm"
          mode="icon-only"
          class="remove-keyframes"
          title="Remove selected keyframes"
          disabled={!hasKeyframeSelection}
          onclick={removeSelectedKeyframes}
        >
          <IconSvg name="trash" />
        </Button>
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
    tabindex="0"
    role="application"
    aria-label="Automation curve graph. Double-click empty area adds a keyframe; double-click a keyframe to edit its value. Hover a keyframe to see its value. Shift-click or Ctrl-click to multi-select."
    aria-keyshortcuts="Delete Backspace"
    use:focusGraphWhenRegionTargeted={{ laneId, regionId }}
    onpointerdown={handleGraphPointerdown}
    ondblclick={handleGraphDblclick}
    onpointermove={handleGraphPointermove}
    onmouseleave={handleGraphMouseleave}
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
        <filter id="curve-keyframe-selected-glow" x="-55%" y="-55%" width="210%" height="210%">
          <feGaussianBlur stdDeviation="1.35" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
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
            {@const cx = timeToX(kf.time)}
            {@const cy = valueToY(kf.value)}
            {@const isEndpoint = index === 0 || index === keyframesSorted.length - 1}
            <g
              class="graph-keyframe"
              class:is-selected={selectedKeyframeSet.has(index)}
              class:is-endpoint={isEndpoint}
              data-index={index}
            >
              {#if isEndpoint}
                <rect
                  class="graph-keyframe-shape graph-keyframe-end"
                  x={cx - KEYFRAME_MARK_HALF}
                  y={cy - KEYFRAME_MARK_HALF}
                  width={KEYFRAME_MARK_HALF * 2}
                  height={KEYFRAME_MARK_HALF * 2}
                />
              {:else}
                <polygon
                  class="graph-keyframe-shape graph-keyframe-diamond"
                  points={diamondPolygonPoints(cx, cy, KEYFRAME_DIAMOND_R)}
                />
              {/if}
            </g>
          {/each}
        </g>
      {/if}
      {#if transportPlayheadSvgX != null}
        <line
          class="graph-transport-playhead"
          x1={transportPlayheadSvgX}
          x2={transportPlayheadSvgX}
          y1={GRAPH_PADDING.top}
          y2={graphHeight - GRAPH_PADDING.bottom}
          aria-hidden="true"
        />
      {/if}
    </svg>
  </div>

  {#if keyframeTooltipScreen && keyframeTooltipText && hoveredKeyframeIndex !== null}
    <div
      class="keyframe-value-tooltip"
      role="tooltip"
      style="left: {keyframeTooltipScreen.x}px; top: {keyframeTooltipScreen.y}px;"
    >
      {keyframeTooltipText}
    </div>
  {/if}
</div>

<EditorParameterValueOverlay
  visible={valueOverlayVisible}
  x={valueOverlayX}
  y={valueOverlayY}
  width={valueOverlayW}
  height={valueOverlayH}
  value={valueOverlayValue}
  paramType={paramSpec.paramType}
  onCommit={commitKeyframeValueFromOverlay}
  onCancel={closeValueOverlay}
/>

<style>
  .curve-editor {
    /** Hit slop (~ apex + stroke); diamond corners extend slightly past former circle radius. */
    --curve-keyframe-radius: 9.5px;
    --curve-editor-bg: var(--color-gray-60, #2a2a2a);
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    min-width: 0;
    color: var(--print-light, #e8e8e8);
    background: var(--curve-editor-bg);
    border-radius: var(--radius-md) var(--radius-md) 0 0;
    overflow: hidden;
  }

  .header {
    flex-shrink: 0;
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    gap: var(--pd-sm);
    padding: var(--pd-xs);
    border-bottom: 1px solid var(--color-gray-70, #333);
    min-width: 0;
  }

  .curve-editor .header :global(.button) {
    border-radius: calc(var(--radius-md) - var(--pd-xs)) !important;
  }

  .header-left {
    flex: 1 0 auto;
    display: flex;
    align-items: center;
    gap: var(--pd-sm);
    min-width: 0;
    max-width: 200px;
  }

  .header-jump {
    flex: 1 1 auto;
    min-width: 0;
    justify-content: flex-start;
    gap: var(--pd-sm);
  }

  .title-icon {
    flex-shrink: 0;
    width: var(--icon-size-sm);
    height: var(--icon-size-sm);
    display: inline-flex;
  }

  .title-icon :global(svg) {
    width: 100%;
    height: 100%;
    display: block;
  }

  .header-title {
    flex: 1 1 auto;
    min-width: 0;
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--print-highlight, #fff);
    line-height: 1.25;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: left;
  }

  .header-right {
    display: flex;
    align-items: center;
    flex-wrap: nowrap;
    flex: 1;
    gap: var(--pd-sm);
    min-width: 0;
    justify-content: flex-end;
  }

  .header-controls {
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: flex-end;
    flex-wrap: nowrap;
    gap: var(--pd-xs);
  }

  .snap-wrap {
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    flex-shrink: 0;
    gap: 0;
  }

  .keyframe-value-tooltip {
    position: fixed;
    z-index: 900;
    transform: translate(-50%, -100%);
    pointer-events: none;
    padding: 2px 6px;
    border-radius: var(--radius-sm);
    font-size: var(--text-2xs);
    font-family: var(--font-mono);
    color: var(--print-light, #e8e8e8);
    background: color-mix(in srgb, var(--curve-editor-bg) 82%, var(--print-highlight, #fff) 18%);
    border: 1px solid color-mix(in srgb, var(--curve-editor-bg) 55%, var(--print-subtle, #888) 45%);
    box-shadow: 0 1px 4px rgb(0 0 0 / 35%);
    white-space: nowrap;
  }

  .graph-wrap {
    flex: 1;
    min-height: 120px;
    min-width: 0;
    cursor: crosshair;
  }

  .graph-svg {
    display: block;
    width: 100%;
    height: 100%;
  }

  .graph-border {
    stroke: var(--color-gray-75, #383838);
    stroke-width: 0.75px;
    vector-effect: non-scaling-stroke;
    opacity: 0.55;
  }

  .graph-waveform-path {
    color: var(--print-subtle, #888);
    fill: currentColor;
  }

  .graph-path {
    fill: none;
    stroke: var(--color-teal-120, #5dd);
    stroke-width: 2;
    vector-effect: non-scaling-stroke;
    stroke-linejoin: round;
  }

  .graph-transport-playhead {
    stroke: var(--print-highlight, #fff);
    stroke-width: 1.5px;
    stroke-opacity: 0.85;
    vector-effect: non-scaling-stroke;
    pointer-events: none;
  }

  .grid-line {
    stroke: var(--color-gray-70, #333);
    stroke-width: 0.66px;
    vector-effect: non-scaling-stroke;
    opacity: 0.2;
  }

  .grid-line-minor {
    opacity: 0.09;
  }

  .grid-line-major {
    stroke: var(--color-gray-85, #444);
    opacity: 0.32;
  }

  .grid-line-sub {
    opacity: 0.06;
  }

  .value-axis-label {
    fill: var(--print-subtle, #aaa);
    font-size: var(--text-2xs);
    font-family: var(--font-mono);
  }

  .graph-keyframe {
    cursor: grab;
  }

  .graph-keyframe-shape {
    vector-effect: non-scaling-stroke;
    paint-order: stroke fill;
    stroke-linejoin: round;
  }

  /* Endpoint (t=0 / t=1): fixed in time, non-deletable */
  .graph-keyframe-end {
    fill: color-mix(in srgb, var(--color-gray-90, #4a4a4a) 88%, var(--color-teal-100, #3aa) 12%);
    stroke: var(--curve-editor-bg);
    stroke-width: 1.2px;
  }

  .graph-keyframe.is-selected .graph-keyframe-end {
    fill: color-mix(in srgb, var(--primary-bg-active, #088) 78%, var(--print-highlight, #fff) 22%);
    stroke: var(--print-highlight, #fff);
    stroke-width: 2.35px;
    filter: url(#curve-keyframe-selected-glow);
  }

  /* Interior keyframes: diamond */
  .graph-keyframe-diamond {
    stroke-linejoin: miter;
    fill: color-mix(in srgb, var(--color-teal-gray-100, #355) 75%, var(--color-teal-120, #5dd) 25%);
    stroke: var(--curve-editor-bg);
    stroke-width: 1.25px;
  }

  .graph-keyframe.is-selected .graph-keyframe-diamond {
    fill: var(--primary-bg-active, #088);
    stroke: var(--print-highlight, #fff);
    stroke-width: 2.5px;
    filter: url(#curve-keyframe-selected-glow);
  }
</style>
