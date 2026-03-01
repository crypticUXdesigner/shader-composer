<script lang="ts">
  /**
   * Timeline Panel - Svelte 5 Migration WP 05B
   * Lanes, regions, BPM, ruler, playhead, snap, add-lane dropdown.
   */
  import { Button, Input, DropdownMenu, MenuInput, MenuHeader, MenuItem, MenuNoResults, IconSvg, NodeIconSvg } from '../ui';
  import { getNodeIcon } from '../../../utils/nodeSpecUtils';
  import { getSubGroupSlug } from '../../../utils/cssTokens';
  import { wheelNonPassive } from '../../actions/wheelPassive';
  import {
    addAutomationLane,
    addAutomationRegion,
    updateAutomationRegion,
    removeAutomationRegion,
    removeAutomationLane,
    setAutomationBpm,
    generateUUID,
  } from '../../../data-model';
  import { snapToGrid, snapToGridAvoidZero, SNAP_GRID_OPTIONS } from '../../../utils/timelineSnap';
  import type { NodeGraph } from '../../../data-model/types';
  import type { NodeSpec } from '../../../types/nodeSpec';
  import type { TimelineState } from '../../../runtime/types';
  import type { AutomationLane, AutomationRegion } from '../../../data-model/types';
  import type { WaveformService } from '../../../runtime/waveform';

  const DEFAULT_BPM = 120;
  const DEFAULT_BARS_NEW_REGION = 16;
  const ZOOM_MIN = 1;
  const ZOOM_MAX = 8;
  const ZOOM_DEFAULT = 1;
  const TRACK_WIDTH = 400;
  const TRACK_HEADER_WIDTH = 260;

  const CATEGORY_SLUG_MAP: Record<string, string> = {
    Inputs: 'inputs',
    Patterns: 'patterns',
    SDF: 'sdf',
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

  interface FloatParamOption {
    nodeId: string;
    paramName: string;
    nodeLabel: string;
    paramLabel: string;
  }

  interface Props {
    getGraph: () => NodeGraph;
    onGraphUpdate: (graph: NodeGraph) => void;
    getTimelineState: () => TimelineState | null;
    onSeek?: (time: number) => void;
    waveformService?: WaveformService | null;
    onOpenCurveEditor?: (laneId: string, regionId: string, laneLabel: string) => void;
    onClose?: () => void;
    nodeSpecs: NodeSpec[];
  }

  let {
    getGraph,
    onGraphUpdate,
    getTimelineState,
    onSeek,
    waveformService = null,
    onOpenCurveEditor,
    onClose,
    nodeSpecs,
  }: Props = $props();

  const nodeSpecsMap = $derived(new Map(nodeSpecs.map((s) => [s.id, s])));

  let zoomLevel = $state(ZOOM_DEFAULT);
  let panOffset = $state(0);
  let snapEnabled = $state(true);
  let snapGridBars = $state(4);
  let selectedRegion = $state<{ laneId: string; regionId: string } | null>(null);
  let regionDrag = $state<{
    laneId: string;
    regionId: string;
    startTime: number;
    /** Time offset from cursor to region start (cursorTime - region.startTime) so region sticks to cursor. */
    gripOffset: number;
    isDuplicate: boolean;
  } | null>(null);
  let regionResize = $state<{
    laneId: string;
    regionId: string;
    edge: 'left' | 'right';
    startX: number;
    startTime: number;
    startDuration: number;
  } | null>(null);
  let addLaneOpen = $state(false);
  let addLaneSearch = $state('');
  let addLaneButtonEl = $state<HTMLDivElement | null>(null);
  let snapGridOpen = $state(false);
  let snapGridButtonEl = $state<HTMLDivElement | null>(null);
  let regionContextMenuRef: import('../ui/menu/DropdownMenu.svelte').default | undefined;
  let scrollerDragStart = $state<{ x: number; panOffset: number } | null>(null);
  let scrollEl: HTMLDivElement | null = null;
  let lanesContainerEl: HTMLDivElement | null = null;
  let rulerTrackEl: HTMLDivElement | null = null;
  let trackColumnEl: HTMLDivElement | null = null;
  let playheadClipEl = $state<HTMLDivElement | null>(null);
  let rulerSeekDragging = $state(false);
  let playheadDragging = $state(false);
  let trackWidth = $state(TRACK_WIDTH);
  /** Full waveform for current primary (from 02B); null when no data or no service. Stereo: values = left, valuesRight = right. */
  let fullWaveformData = $state<{ values: number[]; valuesRight?: number[]; durationSeconds: number } | null>(null);
  let rulerWaveformCanvasEl = $state<HTMLCanvasElement | null>(null);

  const lanes = $derived(getGraph().automation?.lanes ?? []);

  /** Snapshot of timeline state so playhead and ruler react to playback (getTimelineState is not reactive). */
  let timelineStateSnapshot = $state<{ currentTime: number; duration: number } | null>(null);

  $effect(() => {
    if (!getTimelineState) return;
    const poll = () => {
      const state = getTimelineState();
      timelineStateSnapshot = state
        ? { currentTime: state.currentTime, duration: state.duration }
        : null;
    };
    poll();
    const interval = setInterval(poll, 100);
    return () => clearInterval(interval);
  });

  /** Fetch full waveform when service or timeline duration (primary) changes. */
  $effect(() => {
    const svc = waveformService;
    void (timelineStateSnapshot?.duration ?? getDuration());
    if (!svc) {
      fullWaveformData = null;
      return;
    }
    void svc.getWaveformForPrimary().then((data) => {
      const duration =
        data.durationSeconds > 0 ? data.durationSeconds : getDuration();
      fullWaveformData =
        data.values.length > 0 && duration > 0
          ? {
              values: data.values,
              valuesRight: data.valuesRight,
              durationSeconds: duration,
            }
          : null;
    });
  });

  /** Draw waveform slice in ruler canvas when data or view (zoom/pan) changes. */
  $effect(() => {
    const canvas = rulerWaveformCanvasEl;
    const full = fullWaveformData;
    const start = panOffset;
    const visDur = visibleDuration;
    const end = start + visDur;
    const svc = waveformService;
    void trackWidth;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio ?? 1;
    const w = Math.max(1, Math.round((rect.width || 0) * dpr));
    const h = Math.max(1, Math.round((rect.height || 20) * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    ctx.clearRect(0, 0, w, h);
    if (!full || !svc || end <= start || full.values.length === 0) return;
    const sliceL = svc.getWaveformSlice(full.values, full.durationSeconds, start, end);
    if (sliceL.length === 0) return;
    const rightValues =
      full.valuesRight != null && full.valuesRight.length === full.values.length
        ? full.valuesRight
        : full.values;
    const sliceR = svc.getWaveformSlice(rightValues, full.durationSeconds, start, end);
    const n = sliceL.length;
    const midY = h / 2;
    const halfH = (h / 2) * 0.85;
    const minBarPx = Math.max(0.5, 1 * (dpr || 1));
    /* Data is already 0–1 from service; only scale by half height. */
    /* Only draw over the fraction of the canvas that has data (avoids stretch when panned past track end). */
    const visibleSpan = end - start;
    const actualStart = Math.max(0, start);
    const actualEnd = Math.min(full.durationSeconds, end);
    const dataSpan = Math.max(0, actualEnd - actualStart);
    const drawWidth = visibleSpan > 0 ? Math.min(w, Math.round((dataSpan / visibleSpan) * w)) : 0;
    const root = canvas.closest('.ruler-track') ?? document.documentElement;
    const color =
      getComputedStyle(root as Element).getPropertyValue('--print-subtle').trim() || '#666666';
    ctx.fillStyle = color;
    for (let x = 0; x < drawWidth; x++) {
      const t = drawWidth > 0 ? x / drawWidth : 0;
      const idx = Math.min(Math.floor(t * n), n - 1);
      const vL = Math.min(1, Math.max(0, sliceL[idx] ?? 0));
      const vR = Math.min(1, Math.max(0, sliceR[idx] ?? 0));
      const rawAmpL = vL * halfH;
      const rawAmpR = vR * halfH;
      const ampL = rawAmpL > 0 ? rawAmpL : minBarPx;
      const ampR = rawAmpR > 0 ? rawAmpR : minBarPx;
      const yTop = midY - ampL;
      const yBottom = midY + ampR;
      ctx.fillRect(x, Math.min(yTop, midY), 1, Math.abs(midY - yTop));
      ctx.fillRect(x, midY, 1, Math.abs(yBottom - midY));
    }
  });

  function getDuration(): number {
    const state = getTimelineState();
    if (state != null) return state.duration;
    return getGraph().automation?.durationSeconds ?? 30;
  }

  function getBpm(): number {
    return getGraph().automation?.bpm ?? DEFAULT_BPM;
  }

  const visibleDuration = $derived.by(() => {
    const d = getDuration();
    return d <= 0 ? 0 : d / zoomLevel;
  });

  function clampPan(): void {
    const duration = getDuration();
    const visible = visibleDuration;
    const maxPan = Math.max(0, duration - visible);
    panOffset = Math.max(0, Math.min(panOffset, maxPan));
  }

  function timeToX(time: number): number {
    const visible = visibleDuration;
    if (visible <= 0) return 0;
    return ((time - panOffset) / visible) * trackWidth;
  }

  function xToTime(x: number): number {
    const visible = visibleDuration;
    return panOffset + (x / trackWidth) * visible;
  }

  /** Get time (0..duration) under a clientX position for a track rect; used for region drag so movement is 1:1 with cursor. */
  function getTimeFromTrackRect(clientX: number, trackRect: DOMRect): number {
    const duration = getDuration();
    if (duration <= 0 || trackRect.width <= 0) return 0;
    const xPx = Math.max(0, Math.min(clientX - trackRect.left, trackRect.width));
    const x = (xPx / trackRect.width) * trackWidth;
    const time = xToTime(x);
    return Math.max(0, Math.min(duration, time));
  }

  /** Get time (0..duration) from a mouse event on the ruler track; null if invalid. */
  function getRulerTimeFromEvent(e: MouseEvent): number | null {
    if (!rulerTrackEl) return null;
    const rect = rulerTrackEl.getBoundingClientRect();
    if (rect.width <= 0) return null;
    const duration = getDuration();
    if (duration <= 0) return null;
    const xPx = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const x = (xPx / rect.width) * trackWidth;
    const time = xToTime(x);
    return Math.max(0, Math.min(duration, time));
  }

  function onRulerSeekMouseDown(e: MouseEvent): void {
    if (e.button !== 0) return;
    if (!onSeek || getDuration() <= 0 || getTimelineState() == null) return;
    const t = getRulerTimeFromEvent(e);
    if (t != null) onSeek(t);
    rulerSeekDragging = true;

    const onMove = (e2: MouseEvent): void => {
      if (!rulerSeekDragging) return;
      const t2 = getRulerTimeFromEvent(e2);
      if (t2 != null) onSeek(t2);
    };
    const onUp = (): void => {
      rulerSeekDragging = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  /** Get time (0..duration) from clientX using the playhead track (lane column) rect; null if invalid. */
  function getTimeFromPlayheadTrack(clientX: number): number | null {
    if (!playheadClipEl) return null;
    const rect = playheadClipEl.getBoundingClientRect();
    if (rect.width <= 0) return null;
    const duration = getDuration();
    if (duration <= 0) return null;
    const xPx = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const x = (xPx / rect.width) * trackWidth;
    const time = xToTime(x);
    return Math.max(0, Math.min(duration, time));
  }

  function onPlayheadPointerDown(e: PointerEvent): void {
    if (e.button !== 0) return;
    if (!onSeek || getDuration() <= 0) return;
    e.preventDefault();
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    playheadDragging = true;
    const t = getTimeFromPlayheadTrack(e.clientX);
    if (t != null) onSeek(t);

    const onMove = (e2: PointerEvent): void => {
      e2.preventDefault();
      const t2 = getTimeFromPlayheadTrack(e2.clientX);
      if (t2 != null) onSeek(t2);
    };
    const onUp = (e2: PointerEvent): void => {
      if (e2.pointerId === e.pointerId) {
        target.releasePointerCapture(e2.pointerId);
      }
      playheadDragging = false;
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);
      target.removeEventListener('pointercancel', onUp);
    };
    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onUp);
    target.addEventListener('pointercancel', onUp);
  }

  const scrollerLeftPct = $derived.by(() => {
    const duration = getDuration();
    if (duration <= 0) return 0;
    return (panOffset / duration) * 100;
  });

  const scrollerWidthPct = $derived.by(() => {
    const duration = getDuration();
    if (duration <= 0) return 100;
    const visible = visibleDuration;
    return Math.max(2, (visible / duration) * 100);
  });

  const currentTime = $derived(timelineStateSnapshot?.currentTime ?? 0);
  const showPlayhead = $derived(timelineStateSnapshot != null && lanes.length > 0);
  const playheadX = $derived(timeToX(currentTime));

  const snapGridLabel = $derived(
    SNAP_GRID_OPTIONS.find((o) => o.value === snapGridBars)?.label ?? String(snapGridBars)
  );

  /** Add Lane: only float parameters (automation is float-only; evaluator/GLSL do not support int). */
  function getFloatParamOptions(): FloatParamOption[] {
    const graph = getGraph();
    const existing = new Set(
      (graph.automation?.lanes ?? []).map((l) => `${l.nodeId}:${l.paramName}`)
    );
    const options: FloatParamOption[] = [];
    for (const node of graph.nodes) {
      const spec = nodeSpecsMap.get(node.type);
      if (!spec?.parameters) continue;
      const nodeLabel = node.label ?? spec.displayName ?? node.type;
      for (const [paramName, paramSpec] of Object.entries(spec.parameters)) {
        if (paramSpec.type !== 'float') continue;
        if (existing.has(`${node.id}:${paramName}`)) continue;
        options.push({
          nodeId: node.id,
          paramName,
          nodeLabel,
          paramLabel: paramSpec.label ?? paramName,
        });
      }
    }
    return options;
  }

  const filteredFloatParams = $derived.by(() => {
    const query = addLaneSearch.trim().toLowerCase();
    let opts = getFloatParamOptions();
    if (query) {
      opts = opts.filter(
        (o) =>
          o.nodeLabel.toLowerCase().includes(query) ||
          o.paramLabel.toLowerCase().includes(query)
      );
    }
    const grouped = new Map<string, FloatParamOption[]>();
    for (const o of opts) {
      if (!grouped.has(o.nodeId)) grouped.set(o.nodeId, []);
      grouped.get(o.nodeId)!.push(o);
    }
    return { options: opts, grouped };
  });

  const rulerSeekEnabled = $derived.by(() => {
    return Boolean(onSeek && getDuration() > 0 && timelineStateSnapshot != null);
  });

  const rulerData = $derived.by(() => {
    const duration = getDuration();
    const bpm = getBpm();
    const state = getTimelineState();
    const hasAudio = state?.hasAudio ?? false;
    if (duration <= 0) return null;
    const barSeconds = 60 / bpm;
    const maxBarNumber = Math.ceil(duration / barSeconds) || 1;
    const barStep = maxBarNumber <= 16 ? 1 : maxBarNumber <= 32 ? 2 : maxBarNumber <= 64 ? 4 : 8;
    const ticks: number[] = [];
    for (let n = 1; n <= maxBarNumber; n += barStep) {
      ticks.push(n);
    }
    return { barSeconds, ticks, hasAudio };
  });

  /** Grid step positions (x in px) for track lanes; same step as snap grid. */
  const trackGridLines = $derived.by(() => {
    const visible = visibleDuration;
    const bpm = getBpm();
    if (visible <= 0 || bpm <= 0 || snapGridBars <= 0) return [];
    const stepSec = (snapGridBars * 60) / bpm;
    const start = panOffset;
    const end = panOffset + visible;
    const firstStep = Math.ceil(start / stepSec) * stepSec;
    const lines: number[] = [];
    for (let t = firstStep; t < end; t += stepSec) {
      const x = timeToX(t);
      if (x >= 0 && x <= trackWidth) lines.push(x);
    }
    return lines;
  });

  function applyBpm(value: number): void {
    const num = Number.isFinite(value) ? Math.max(20, Math.min(300, value)) : DEFAULT_BPM;
    const updated = setAutomationBpm(getGraph(), num);
    onGraphUpdate(updated);
  }

  function addLane(nodeId: string, paramName: string): void {
    const laneId = generateUUID();
    const updated = addAutomationLane(getGraph(), { id: laneId, nodeId, paramName });
    onGraphUpdate(updated);
    addLaneOpen = false;
    addLaneSearch = '';
  }

  function createRegion(laneId: string, startTime: number): void {
    const graph = getGraph();
    const lane = graph.automation?.lanes.find((l: AutomationLane) => l.id === laneId);
    const node = lane ? graph.nodes.find((n: { id: string }) => n.id === lane.nodeId) : undefined;
    const spec = node ? nodeSpecsMap.get(node.type) : undefined;
    const nodeLabel = node?.label ?? spec?.displayName ?? lane?.nodeId ?? '';
    const paramLabel = spec?.parameters?.[lane?.paramName ?? '']?.label ?? lane?.paramName ?? '';
    const bpm = getBpm();
    const durationSec = Math.max(0.001, (DEFAULT_BARS_NEW_REGION * 60) / bpm);
    const start = snapEnabled ? snapToGrid(startTime, bpm, snapGridBars) : startTime;
    const regionId = generateUUID();
    const paramSpec = lane ? spec?.parameters?.[lane.paramName] : undefined;
    const isFloat = paramSpec && paramSpec.type === 'float';
    const rawValue =
      isFloat && node && lane
        ? (node.parameters?.[lane.paramName] ?? paramSpec?.default)
        : undefined;
    const numValue = typeof rawValue === 'number' ? rawValue : undefined;
    const min = typeof paramSpec?.min === 'number' ? paramSpec.min : 0;
    const max = typeof paramSpec?.max === 'number' ? paramSpec.max : 1;
    const range = max - min;
    const normalized =
      numValue !== undefined
        ? range === 0
          ? 0.5
          : Math.max(0, Math.min(1, (numValue - min) / range))
        : undefined;
    const curve =
      normalized !== undefined
        ? {
            keyframes: [
              { time: 0, value: normalized },
              { time: 1, value: normalized },
            ],
            interpolation: 'bezier' as const,
          }
        : undefined;
    const updated = addAutomationRegion(graph, laneId, {
      id: regionId,
      startTime: start,
      duration: durationSec,
      loop: false,
      ...(curve ? { curve } : {}),
    });
    onGraphUpdate(updated);
    selectedRegion = { laneId, regionId };
    if (onOpenCurveEditor) {
      onOpenCurveEditor(laneId, regionId, `${nodeLabel}: ${paramLabel}`);
    }
  }

  function deleteRegion(laneId: string, regionId: string): void {
    const updated = removeAutomationRegion(getGraph(), laneId, regionId);
    onGraphUpdate(updated);
    if (selectedRegion?.laneId === laneId && selectedRegion?.regionId === regionId) {
      selectedRegion = null;
    }
  }

  function deleteLane(laneId: string): void {
    const updated = removeAutomationLane(getGraph(), laneId);
    onGraphUpdate(updated);
    if (selectedRegion?.laneId === laneId) {
      selectedRegion = null;
    }
  }

  function duplicateRegion(
    laneId: string,
    sourceRegionId: string,
    startTime: number
  ): void {
    const graph = getGraph();
    const lane = graph.automation?.lanes.find((l: AutomationLane) => l.id === laneId);
    const region = lane?.regions.find((r: AutomationRegion) => r.id === sourceRegionId);
    if (!lane || !region) return;
    const newId = generateUUID();
    const updated = addAutomationRegion(graph, laneId, {
      id: newId,
      startTime,
      duration: region.duration,
      loop: region.loop,
      curve: region.curve,
    });
    onGraphUpdate(updated);
    selectedRegion = { laneId, regionId: newId };
  }

  function handleTrackDblClick(e: MouseEvent, laneId: string) {
    const target = e.target as HTMLElement;
    if (target.classList.contains('region-block')) return;
    const track = (e.currentTarget as HTMLElement).closest('.track') as HTMLElement;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const xPx = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const x = rect.width > 0 ? (xPx / rect.width) * trackWidth : 0;
    const time = xToTime(x);
    createRegion(laneId, time);
  }

  function onRegionResizeStart(
    e: MouseEvent,
    laneId: string,
    regionId: string,
    edge: 'left' | 'right'
  ) {
    e.preventDefault();
    e.stopPropagation();
    const graph = getGraph();
    const lane = graph.automation?.lanes.find((l: AutomationLane) => l.id === laneId);
    const region = lane?.regions.find((r: AutomationRegion) => r.id === regionId);
    if (!lane || !region) return;
    regionResize = {
      laneId,
      regionId,
      edge,
      startX: e.clientX,
      startTime: region.startTime,
      startDuration: region.duration,
    };
    const track = lanesContainerEl?.querySelector(
      `.track[data-lane-id="${laneId}"]`
    ) as HTMLElement;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const visible = visibleDuration;
    const scale = rect.width > 0 ? visible / rect.width : 0;
    const bpm = getBpm();
    const durationMax = getDuration();
    const minDuration = 0.001;

    const onMove = (e2: MouseEvent): void => {
      if (!regionResize) return;
      const dx = e2.clientX - regionResize.startX;
      const dt = dx * scale;
      let newStart = regionResize.startTime;
      let newDuration = regionResize.startDuration;
      if (regionResize.edge === 'left') {
        newStart = Math.max(0, Math.min(regionResize.startTime + dt, regionResize.startTime + regionResize.startDuration - minDuration));
        newDuration = regionResize.startTime + regionResize.startDuration - newStart;
      } else {
        const newEnd = Math.max(regionResize.startTime + minDuration, Math.min(durationMax, regionResize.startTime + regionResize.startDuration + dt));
        newDuration = newEnd - regionResize.startTime;
      }
      /* Snap only the start time to grid; never snap the end (right edge). */
      if (snapEnabled && regionResize.edge === 'left') {
        newStart = snapToGridAvoidZero(newStart, bpm, snapGridBars);
        newStart = Math.max(0, Math.min(newStart, regionResize.startTime + regionResize.startDuration - minDuration));
        newDuration = regionResize.startTime + regionResize.startDuration - newStart;
      }
      regionResize = { ...regionResize, startX: e2.clientX, startTime: regionResize.edge === 'left' ? newStart : regionResize.startTime, startDuration: newDuration };
    };
    const onUp = (): void => {
      const final = regionResize;
      regionResize = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (final) {
        const updated = updateAutomationRegion(getGraph(), laneId, regionId, {
          startTime: final.startTime,
          duration: final.startDuration,
        });
        onGraphUpdate(updated);
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function onRegionMouseDown(e: MouseEvent, laneId: string, regionId: string) {
    if ((e.target as HTMLElement).closest('.region-resize')) return;
    e.preventDefault();
    selectedRegion = { laneId, regionId };
    const graph = getGraph();
    const lane = graph.automation?.lanes.find((l: AutomationLane) => l.id === laneId);
    const region = lane?.regions.find((r: AutomationRegion) => r.id === regionId);
    if (!lane || !region) return;

    const track = lanesContainerEl?.querySelector(
      `.track[data-lane-id="${laneId}"]`
    ) as HTMLElement | null;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const cursorTime = getTimeFromTrackRect(e.clientX, rect);
    const gripOffset = cursorTime - region.startTime;

    const isDuplicate = e.altKey || e.metaKey;
    regionDrag = {
      laneId,
      regionId,
      startTime: region.startTime,
      gripOffset,
      isDuplicate,
    };

    const onMouseMove = (e2: MouseEvent): void => {
      if (!regionDrag) return;
      const trackEl = lanesContainerEl?.querySelector(
        `.track[data-lane-id="${laneId}"]`
      ) as HTMLElement;
      if (!trackEl) return;
      const trackRect = trackEl.getBoundingClientRect();
      const cursorTimeNow = getTimeFromTrackRect(e2.clientX, trackRect);
      const duration = getDuration();
      const maxStart = Math.max(0, duration - region.duration);
      let newStart = cursorTimeNow - regionDrag.gripOffset;
      newStart = Math.max(0, Math.min(maxStart, newStart));
      if (snapEnabled) {
        newStart = snapToGridAvoidZero(newStart, getBpm(), snapGridBars);
        newStart = Math.max(0, Math.min(maxStart, newStart));
      }
      regionDrag = { ...regionDrag, startTime: newStart };
    };

    const onMouseUp = (): void => {
      const final = regionDrag;
      regionDrag = null;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      if (final) {
        const updated = updateAutomationRegion(getGraph(), laneId, regionId, {
          startTime: final.startTime,
        });
        onGraphUpdate(updated);
      }
    };

    if (isDuplicate) {
      const onMouseUpDup = (e2: MouseEvent): void => {
        window.removeEventListener('mouseup', onMouseUpDup);
        const track = lanesContainerEl?.querySelector(
          `.track[data-lane-id="${laneId}"]`
        ) as HTMLElement;
        if (track) {
          const rect = track.getBoundingClientRect();
          const xPx = Math.max(0, Math.min(e2.clientX - rect.left, rect.width));
          const x = rect.width > 0 ? (xPx / rect.width) * trackWidth : 0;
          let newStart = xToTime(x);
          if (snapEnabled) {
            newStart = snapToGrid(newStart, getBpm(), snapGridBars);
            newStart = Math.max(0, newStart);
          }
          duplicateRegion(laneId, regionId, newStart);
        }
        regionDrag = null;
      };
      window.addEventListener('mouseup', onMouseUpDup);
      return;
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  function onRegionContextMenu(e: MouseEvent, laneId: string, regionId: string) {
    e.preventDefault();
    selectedRegion = { laneId, regionId };
    regionContextMenuRef?.show(e.clientX, e.clientY, [
      { label: 'Delete', action: () => deleteRegion(laneId, regionId) },
    ]);
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key !== 'Delete' && e.key !== 'Backspace') return;
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
    if (!selectedRegion) return;
    e.preventDefault();
    deleteRegion(selectedRegion.laneId, selectedRegion.regionId);
  }

  function onScrollerMouseDown(e: MouseEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    const scrollerEl = (e.currentTarget as HTMLElement).closest('.scroller') as HTMLElement | null;
    scrollerDragStart = { x: e.clientX, panOffset };
    const onMove = (e2: MouseEvent): void => {
      if (!scrollerDragStart || !scrollerEl) return;
      const duration = getDuration();
      if (duration <= 0) return;
      const dx = e2.clientX - scrollerDragStart.x;
      const rect = scrollerEl.getBoundingClientRect();
      const frac = rect && rect.width > 0 ? dx / rect.width : 0;
      panOffset = Math.max(0, Math.min(duration - visibleDuration, scrollerDragStart.panOffset + frac * duration));
      clampPan();
      scrollerDragStart = { x: e2.clientX, panOffset };
    };
    const onUp = (): void => {
      scrollerDragStart = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function onScrollerWheel(e: WheelEvent) {
    e.preventDefault();
    const duration = getDuration();
    if (duration <= 0) return;
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoomLevel * (1 + delta)));
    const visible = duration / newZoom;
    const centerTime = panOffset + visibleDuration / 2;
    zoomLevel = newZoom;
    panOffset = Math.max(0, Math.min(centerTime - visible / 2, duration - visible));
    clampPan();
  }

  function onTimelineWheel(e: WheelEvent) {
    if (!e.altKey && !e.metaKey) return;
    e.preventDefault();
    const duration = getDuration();
    if (duration <= 0) return;
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoomLevel * (1 + delta)));
    const visible = duration / newZoom;
    const rect = scrollEl?.getBoundingClientRect();
    if (!rect) return;
    const scrollX = e.clientX - rect.left;
    const trackAreaLeft = TRACK_HEADER_WIDTH + 12; /* --pd-md */
    const trackX = Math.max(0, Math.min(trackWidth, scrollX - trackAreaLeft));
    const timeUnderCursor = xToTime(trackX);
    zoomLevel = newZoom;
    panOffset = Math.max(0, Math.min(timeUnderCursor - visible / 2, duration - visible));
    clampPan();
  }

  const snapGridMenuItems = $derived(
    SNAP_GRID_OPTIONS.map((opt) => ({
      label: opt.label,
      action: () => {
        snapGridBars = opt.value;
      },
    }))
  );

  $effect(() => {
    function onKey(e: KeyboardEvent) {
      handleKeydown(e);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  $effect(() => {
    const el = trackColumnEl;
    if (!el) {
      trackWidth = TRACK_WIDTH;
      return;
    }
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry?.contentRect.width != null && entry.contentRect.width > 0) {
        trackWidth = Math.round(entry.contentRect.width);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  });
</script>

<div class="inner" style="--timeline-track-width: {trackWidth}px; --track-header-width: {TRACK_HEADER_WIDTH}px">
  <header class="timeline-header">
    <div class="header-left">
      <div class="actions">
        <div bind:this={addLaneButtonEl} class="add-lane-btn-anchor">
          <Button
            variant="ghost"
            size="sm"
            mode="both"
            class="add-lane-btn"
            title="Add automation lane"
            onclick={() => (addLaneOpen = !addLaneOpen)}
          >
            <IconSvg name="plus" />
            <span>Add Lane</span>
          </Button>
        </div>
        <DropdownMenu
          open={addLaneOpen}
          anchor={addLaneButtonEl}
          openAbove={true}
          onClose={() => {
            addLaneOpen = false;
          }}
          class="timeline-add-lane-dropdown"
        >
          {#snippet children()}
            <MenuInput
              value={addLaneSearch}
              placeholder="Search node or param…"
              oninput={(e) => {
                addLaneSearch = (e.currentTarget as HTMLInputElement).value;
              }}
            />
            <div class="timeline-add-lane-list">
              {#if filteredFloatParams.options.length === 0}
                <MenuNoResults>
                  {addLaneSearch.trim() ? 'No matching params' : 'No float params available'}
                </MenuNoResults>
              {:else}
                {#each filteredFloatParams.grouped as [nodeId, params]}
                  {@const graph = getGraph()}
                  {@const node = graph.nodes.find((n) => n.id === nodeId)}
                  {@const spec = node ? nodeSpecsMap.get(node.type) : undefined}
                  {@const nodeLabel = node?.label ?? spec?.displayName ?? nodeId}
                  <MenuHeader text={nodeLabel} />
                  {#each params as p}
                    <MenuItem
                      label={p.paramLabel}
                      onclick={() => addLane(p.nodeId, p.paramName)}
                    />
                  {/each}
                {/each}
              {/if}
            </div>
          {/snippet}
        </DropdownMenu>
      </div>
    </div>
    <div class="header-right">
      <div class="bpm-wrap">
        <label class="bpm-label" for="timeline-bpm-input">BPM</label>
        <Input
          id="timeline-bpm-input"
          type="number"
          variant="ghost"
          size="sm"
          class="bpm-input"
          value={getBpm()}
          min={20}
          max={300}
          title="Beats per minute (default 120 when no audio)"
          onchange={(e: Event) => {
            const el = e.currentTarget as HTMLInputElement;
            const v = el.valueAsNumber;
            applyBpm(Number.isFinite(v) ? v : DEFAULT_BPM);
          }}
        />
      </div>
      <div class="snap-wrap">
        <Button
          variant="ghost"
          size="sm"
          mode="icon-only"
          class="snap-toggle {snapEnabled ? 'is-active' : ''}"
          title="Snap regions to bar grid"
          onclick={() => {
            snapEnabled = !snapEnabled;
          }}
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
      <Button
        variant="ghost"
        size="sm"
        mode="both"
        class="close"
        title="Close timeline"
        aria-label="Close timeline"
        onclick={() => onClose?.()}
      >
        Close
        <IconSvg name="x" variant="line" />
      </Button>
    </div>
  </header>

  <div
    bind:this={scrollEl}
    class="scroll"
    use:wheelNonPassive={onTimelineWheel}
    role="presentation"
  >
    <div class="scroll-viewport">
      <div class="scroll-content">
      <div class="track-headers-col">
        {#each lanes as lane}
          {@const graph = getGraph()}
          {@const node = graph.nodes.find((n) => n.id === lane.nodeId)}
          {@const spec = node ? nodeSpecsMap.get(node.type) : undefined}
          {@const nodeLabel = node?.label ?? spec?.displayName ?? lane.nodeId}
          {@const paramSpec = spec?.parameters?.[lane.paramName]}
          {@const paramLabel = paramSpec?.label ?? lane.paramName}
          <div class="lane-header" data-lane-id={lane.id}>
            <div class="lane-label">
              {#if spec}
                <div class="lane-label-icon">
                  <NodeIconSvg identifier={getNodeIcon(spec)} />
                </div>
              {/if}
              <span class="lane-label-text">{nodeLabel}: {paramLabel}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              mode="icon-only"
              class="delete-lane-btn"
              title="Delete lane"
              onclick={(e: MouseEvent) => {
                e.stopPropagation();
                deleteLane(lane.id);
              }}
            >
              <IconSvg name="circle-x" variant="filled" />
            </Button>
          </div>
        {/each}
        <div class="footer-spacer"></div>
      </div>
      <div bind:this={trackColumnEl} class="lanes-and-scrubber-col">
        <div bind:this={lanesContainerEl} class="lanes-inner">
          {#each lanes as lane}
            {@const graph = getGraph()}
            {@const node = graph.nodes.find((n) => n.id === lane.nodeId)}
            {@const spec = node ? nodeSpecsMap.get(node.type) : undefined}
            {@const nodeLabel = node?.label ?? spec?.displayName ?? lane.nodeId}
            {@const paramSpec = spec?.parameters?.[lane.paramName]}
            {@const paramLabel = paramSpec?.label ?? lane.paramName}
            {@const categorySlug = (spec?.category && CATEGORY_SLUG_MAP[spec.category]) || 'default'}
            {@const subGroupSlug = node ? getSubGroupSlug(node.type, spec?.category ?? '') : ''}
            <div class="lane-row" data-lane-id={lane.id}>
              <div class="track-wrap">
                <div
                  class="track"
                  data-lane-id={lane.id}
                  role="button"
                  tabindex={0}
                  ondblclick={(e: MouseEvent) => handleTrackDblClick(e, lane.id)}
                >
                  <div class="track-grid" aria-hidden="true">
                    {#each trackGridLines as x}
                      <div class="track-grid-line" style="left: {x}px"></div>
                    {/each}
                  </div>
                  {#each lane.regions as region}
                    {@const isDragging = regionDrag?.laneId === lane.id && regionDrag?.regionId === region.id}
                    {@const isResizing = regionResize?.laneId === lane.id && regionResize?.regionId === region.id}
                    {@const displayStart = isDragging ? regionDrag!.startTime : isResizing ? regionResize!.startTime : region.startTime}
                    {@const displayDuration = isResizing ? regionResize!.startDuration : region.duration}
                    {@const left = timeToX(displayStart)}
                    {@const right = timeToX(displayStart + displayDuration)}
                    {@const w = Math.max(2, right - left)}
                    <div
                      class="region-block"
                      data-lane-id={lane.id}
                      data-region-id={region.id}
                      data-category={categorySlug}
                      data-subgroup={subGroupSlug || undefined}
                      class:is-selected={selectedRegion?.laneId === lane.id && selectedRegion?.regionId === region.id}
                      style="left: {left}px; width: {w}px"
                      role="button"
                      tabindex={0}
                      onmousedown={(e: MouseEvent) => onRegionMouseDown(e, lane.id, region.id)}
                      oncontextmenu={(e: MouseEvent) => onRegionContextMenu(e, lane.id, region.id)}
                      ondblclick={(e: MouseEvent) => {
                        e.stopPropagation();
                        onOpenCurveEditor?.(lane.id, region.id, `${nodeLabel}: ${paramLabel}`);
                      }}
                    >
                      <div
                        class="region-resize region-resize-left"
                        title="Resize left"
                        role="button"
                        aria-label="Resize left edge"
                        tabindex={0}
                        onmousedown={(e: MouseEvent) => onRegionResizeStart(e, lane.id, region.id, 'left')}
                      ></div>
                      <div
                        class="region-resize region-resize-right"
                        title="Resize right"
                        role="button"
                        aria-label="Resize right edge"
                        tabindex={0}
                        onmousedown={(e: MouseEvent) => onRegionResizeStart(e, lane.id, region.id, 'right')}
                      ></div>
                    </div>
                  {/each}
                </div>
              </div>
            </div>
          {/each}
          {#if showPlayhead}
            <div
              bind:this={playheadClipEl}
              class="playhead-clip"
              aria-hidden="true"
            >
              <div
                class="playhead-handle"
                class:is-dragging={playheadDragging}
                style="left: {playheadX - 6}px"
                role="slider"
                tabindex={rulerSeekEnabled ? 0 : -1}
                aria-label="Playhead position"
                aria-valuemin={0}
                aria-valuemax={getDuration()}
                aria-valuenow={currentTime}
                title="Drag to scrub or set play position"
                onpointerdown={onPlayheadPointerDown}
              >
                <div class="playhead"></div>
              </div>
            </div>
          {/if}
        </div>
        <div class="timeline-footer-right">
          <div class="scroller-row">
            <div
              class="scroller"
              title="Drag to pan, scroll to zoom"
              onmousedown={(e) => onScrollerMouseDown(e)}
              use:wheelNonPassive={onScrollerWheel}
              role="presentation"
            >
              <div
                class="scroller-thumb"
                style="left: {scrollerLeftPct}%; width: {scrollerWidthPct}%"
              ></div>
            </div>
          </div>
          <div class="ruler-row">
            <div
              bind:this={rulerTrackEl}
              class="ruler-track"
              class:ruler-seek-enabled={rulerSeekEnabled}
              role="slider"
              tabindex={rulerSeekEnabled ? 0 : -1}
              aria-label="Timeline position"
              aria-valuemin={0}
              aria-valuemax={getDuration()}
              aria-valuenow={currentTime}
              title={rulerSeekEnabled ? 'Click or drag to seek' : ''}
              onmousedown={onRulerSeekMouseDown}
            >
              {#if waveformService}
                <div class="ruler-waveform" aria-hidden="true">
                  <canvas bind:this={rulerWaveformCanvasEl}></canvas>
                </div>
              {/if}
              {#if rulerData}
                <div
                  class="ruler-bars"
                  class:no-audio={!rulerData.hasAudio}
                  title={rulerData.hasAudio ? '' : 'No audio — bars at default BPM. Load audio for timeline duration from track.'}
                  aria-hidden="true"
                >
                  {#each rulerData.ticks as n}
                    {@const t = (n - 1) * rulerData.barSeconds}
                    <div class="ruler-tick" style="left: {timeToX(t)}px">
                      <span class="ruler-label">{n}</span>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  </div>

  <DropdownMenu bind:this={regionContextMenuRef} class="timeline-region-context-menu" />
</div>

<style>
  /* === Timeline panel shell (parent in BottomBar; :global so selectors apply) === */
  :global(.timeline-panel) {
    /* Region colors by node category — match node panel icon box colors (node-categories/*.css) */
    --timeline-region-color-inputs: var(--node-icon-box-color-inputs);
    --timeline-region-color-patterns: var(--node-icon-box-bg-patterns);
    --timeline-region-color-sdf: var(--node-icon-box-color-sdf);
    --timeline-region-color-shapes: var(--node-icon-box-color-shapes);
    --timeline-region-color-math: var(--node-icon-box-color-math);
    --timeline-region-color-utilities: var(--node-icon-box-color-utilities);
    --timeline-region-color-distort: var(--node-icon-box-color-distort);
    --timeline-region-color-blend: var(--node-icon-box-color-blend);
    --timeline-region-color-mask: var(--node-icon-box-color-mask);
    --timeline-region-color-effects: var(--node-icon-box-color-effects);
    --timeline-region-color-output: var(--node-icon-box-color-output);
    --timeline-region-color-audio: var(--node-icon-box-color-audio);
    --timeline-region-color-default: var(--node-icon-box-color-default);

    /* Sub-group colors (override category when data-subgroup is set) */
    --timeline-region-color-inputs-system: var(--node-icon-box-color-inputs-system);
    --timeline-region-color-patterns-structured: var(--node-icon-box-color-patterns-structured);
    --timeline-region-color-shapes-derived: var(--node-icon-box-color-shapes-derived);
    --timeline-region-color-math-functions: var(--node-icon-box-color-math-functions);
    --timeline-region-color-math-advanced: var(--node-icon-box-color-math-advanced);
    --timeline-region-color-distort-warp: var(--node-icon-box-color-distort-warp);
    --timeline-region-color-effects-stylize: var(--node-icon-box-color-effects-stylize);

    --timeline-panel-computed-width: min(
      var(--timeline-panel-max-width),
      max(
        var(--timeline-panel-min-width),
        calc(var(--timeline-viewport-width, 100vw) * var(--timeline-panel-width-ratio, 0.6))
      )
    );

    /* Layout */
    position: fixed;
    bottom: calc(var(--bottom-bar-height) + var(--pd-xl));
    left: calc(
      var(--timeline-viewport-left, 0) + (var(--timeline-viewport-width, 100vw) - var(--timeline-panel-computed-width)) / 2
    );
    display: none;
    flex-direction: column;

    /* Box model: width/height from here; frame look from layer .frame */
    width: var(--timeline-panel-computed-width);
    min-height: var(--timeline-panel-height);
    height: auto;
    max-height: min(80vh, 520px); /* One-off max height */

    /* Other */
    z-index: var(--timeline-panel-z-index);
    pointer-events: auto;
    transition: left 0.3s ease;

    &.is-open {
      display: flex;
      /* Use full available height so timeline body (and bg column) can fill it */
      height: min(30vh, 360px);
      min-height: var(--timeline-panel-height);
    }

    &:has(.curve-slot:not(:empty)) {
      min-height: var(--timeline-panel-height-with-editor);
      max-height: 80vh;
    }

    /* With curve editor open: curve-slot has fixed height so graph stays within bounds, timeline below */
    &:has(.curve-slot:not(:empty)) .curve-slot {
      flex-shrink: 0;
      height: 240px; /* One-off - curve editor band; graph must fit inside */
      max-height: 240px;
      min-height: 0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    &:has(.curve-slot:not(:empty)) .curve-slot .curve-editor {
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }

    &:has(.curve-slot:not(:empty)) .content {
      flex: 1;
      min-height: 0;
    }

    .curve-slot {
      flex-shrink: 0;
      min-height: 0;
      overflow: hidden;
    }

    .curve-slot:empty {
      display: none;
    }

    /* Curve editor inherits track header width when inside timeline panel */
    --track-header-width: 260px;

    /* === Curve editor (Bezier) === */
    .curve-slot .curve-editor {
      display: flex;
      flex-direction: column;
      min-height: 0; /* Allow shrink when in fixed-height slot */
      border-bottom: 1px solid var(--layout-divider-bg);

      .header {
        display: flex;
        align-items: center;
        gap: 0;
        flex-shrink: 0;
        padding: var(--pd-xs);
      }

      /* Match timeline editor button/input radius */
      .header .button {
        border-radius: calc(var(--radius-md) - var(--pd-xs));
      }

      .header .keyframe-input-wrap input {
        border-radius: calc(var(--radius-md) - var(--pd-xs));
      }

      .header-left {
        width: var(--track-header-width);
        flex-shrink: 0;
        display: flex;
        align-items: center;
        gap: var(--pd-sm);
        padding-left: var(--pd-md);
        min-width: 0;
      }

      .title-icon {
        display: inline-flex;
        flex-shrink: 0;
        color: var(--print-highlight);
      }

      .title-icon :global(svg) {
        width: 1em;
        height: 1em;
      }

      .header .title {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: var(--text-sm);
        font-weight: 600;
        color: var(--print-highlight);
      }

      .header-right {
        flex: 1;
        min-width: 0;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--pd-md);
      }

      .keyframe-input-wrap {
        flex-shrink: 0;
      }

      .keyframe-input-wrap :global(input) {
        width: 5em;
      }

      .header-controls {
        display: flex;
        align-items: center;
        gap: var(--pd-sm);
        flex-shrink: 0;
      }

      .interp-button-anchor {
        position: relative;
      }

      :global(.interp-button),
      :global(.interp-button *) {
        padding: 0 var(--pd-sm);
      }

      .snap-wrap {
        display: flex;
        align-items: center;
        gap: var(--pd-xs);
      }

      .snap-grid-button-anchor {
        position: relative;
      }

      :global(.snap-grid-button),
      :global(.snap-grid-button *) {
        padding: 0 var(--pd-sm);
      }

      .close {
        flex-shrink: 0;
      }

      .graph-wrap {
        flex: 1;
        min-height: 0;
        padding: 0 var(--pd-md) var(--pd-md);

        .graph-svg {
          width: 100%;
          height: 100%;
          min-height: 120px; /* One-off min height */
        }

        .graph-grid .grid-line {
          stroke-width: 1;
        }

        .graph-grid .grid-line-major {
          stroke: var(--color-gray-70);
        }

        .graph-grid .grid-line-minor {
          stroke: var(--color-gray-60);
        }

        .graph-grid .grid-line-sub {
          stroke: var(--color-gray-50);
          opacity: 0.7;
        }

        .value-axis-labels .value-axis-label {
          font-size: 10px;
          fill: var(--color-gray-80);
        }

        .graph-border {
          stroke: var(--color-gray-70);
          stroke-width: 1;
        }

        .graph-waveform-path {
          fill: var(--color-gray-90);
          pointer-events: none;
        }

        .graph-path {
          fill: none;
          stroke: var(--timeline-region-color-default);
          stroke-width: 2;
          vector-effect: non-scaling-stroke;
        }

        .graph-keyframes .graph-keyframe .graph-keyframe-circle {
          r: var(--curve-keyframe-radius, 5);
          fill: var(--timeline-region-color-default);
          stroke: var(--color-gray-130);
          stroke-width: 2;
          cursor: default;
        }

        .graph-keyframes .graph-keyframe .graph-keyframe-circle.is-selected {
          stroke: var(--timeline-region-color-default);
          stroke-width: 3;
        }

        .curve-editor[data-category='inputs'] .graph-path { stroke: var(--timeline-region-color-inputs); }
        .curve-editor[data-category='inputs'] .graph-keyframe-circle { fill: var(--timeline-region-color-inputs); }
        .curve-editor[data-category='inputs'] .graph-keyframe-circle.is-selected { stroke: var(--timeline-region-color-inputs); }
        .curve-editor[data-category='patterns'] .graph-path { stroke: var(--timeline-region-color-patterns); }
        .curve-editor[data-category='patterns'] .graph-keyframe-circle { fill: var(--timeline-region-color-patterns); }
        .curve-editor[data-category='patterns'] .graph-keyframe-circle.is-selected { stroke: var(--timeline-region-color-patterns); }
        .curve-editor[data-category='shapes'] .graph-path { stroke: var(--timeline-region-color-shapes); }
        .curve-editor[data-category='shapes'] .graph-keyframe-circle { fill: var(--timeline-region-color-shapes); }
        .curve-editor[data-category='shapes'] .graph-keyframe-circle.is-selected { stroke: var(--timeline-region-color-shapes); }
        .curve-editor[data-category='sdf'] .graph-path { stroke: var(--timeline-region-color-sdf); }
        .curve-editor[data-category='sdf'] .graph-keyframe-circle { fill: var(--timeline-region-color-sdf); }
        .curve-editor[data-category='sdf'] .graph-keyframe-circle.is-selected { stroke: var(--timeline-region-color-sdf); }
        .curve-editor[data-category='math'] .graph-path { stroke: var(--timeline-region-color-math); }
        .curve-editor[data-category='math'] .graph-keyframe-circle { fill: var(--timeline-region-color-math); }
        .curve-editor[data-category='math'] .graph-keyframe-circle.is-selected { stroke: var(--timeline-region-color-math); }
        .curve-editor[data-category='utilities'] .graph-path { stroke: var(--timeline-region-color-utilities); }
        .curve-editor[data-category='utilities'] .graph-keyframe-circle { fill: var(--timeline-region-color-utilities); }
        .curve-editor[data-category='utilities'] .graph-keyframe-circle.is-selected { stroke: var(--timeline-region-color-utilities); }
        .curve-editor[data-category='distort'] .graph-path { stroke: var(--timeline-region-color-distort); }
        .curve-editor[data-category='distort'] .graph-keyframe-circle { fill: var(--timeline-region-color-distort); }
        .curve-editor[data-category='distort'] .graph-keyframe-circle.is-selected { stroke: var(--timeline-region-color-distort); }
        .curve-editor[data-category='blend'] .graph-path { stroke: var(--timeline-region-color-blend); }
        .curve-editor[data-category='blend'] .graph-keyframe-circle { fill: var(--timeline-region-color-blend); }
        .curve-editor[data-category='blend'] .graph-keyframe-circle.is-selected { stroke: var(--timeline-region-color-blend); }
        .curve-editor[data-category='mask'] .graph-path { stroke: var(--timeline-region-color-mask); }
        .curve-editor[data-category='mask'] .graph-keyframe-circle { fill: var(--timeline-region-color-mask); }
        .curve-editor[data-category='mask'] .graph-keyframe-circle.is-selected { stroke: var(--timeline-region-color-mask); }
        .curve-editor[data-category='effects'] .graph-path { stroke: var(--timeline-region-color-effects); }
        .curve-editor[data-category='effects'] .graph-keyframe-circle { fill: var(--timeline-region-color-effects); }
        .curve-editor[data-category='effects'] .graph-keyframe-circle.is-selected { stroke: var(--timeline-region-color-effects); }
        .curve-editor[data-category='output'] .graph-path { stroke: var(--timeline-region-color-output); }
        .curve-editor[data-category='output'] .graph-keyframe-circle { fill: var(--timeline-region-color-output); }
        .curve-editor[data-category='output'] .graph-keyframe-circle.is-selected { stroke: var(--timeline-region-color-output); }
        .curve-editor[data-category='audio'] .graph-path { stroke: var(--timeline-region-color-audio); }
        .curve-editor[data-category='audio'] .graph-keyframe-circle { fill: var(--timeline-region-color-audio); }
        .curve-editor[data-category='audio'] .graph-keyframe-circle.is-selected { stroke: var(--timeline-region-color-audio); }

        /* Sub-group overrides (match node panel icon box sub-group colors) */
        .curve-editor[data-category='inputs'][data-subgroup='system-input'] .graph-path { stroke: var(--timeline-region-color-inputs-system); }
        .curve-editor[data-category='inputs'][data-subgroup='system-input'] .graph-keyframe-circle { fill: var(--timeline-region-color-inputs-system); }
        .curve-editor[data-category='inputs'][data-subgroup='system-input'] .graph-keyframe-circle.is-selected { stroke: var(--timeline-region-color-inputs-system); }
        .curve-editor[data-category='patterns'][data-subgroup='structured'] .graph-path { stroke: var(--timeline-region-color-patterns-structured); }
        .curve-editor[data-category='patterns'][data-subgroup='structured'] .graph-keyframe-circle { fill: var(--timeline-region-color-patterns-structured); }
        .curve-editor[data-category='patterns'][data-subgroup='structured'] .graph-keyframe-circle.is-selected { stroke: var(--timeline-region-color-patterns-structured); }
        .curve-editor[data-category='shapes'][data-subgroup='derived'] .graph-path { stroke: var(--timeline-region-color-shapes-derived); }
        .curve-editor[data-category='shapes'][data-subgroup='derived'] .graph-keyframe-circle { fill: var(--timeline-region-color-shapes-derived); }
        .curve-editor[data-category='shapes'][data-subgroup='derived'] .graph-keyframe-circle.is-selected { stroke: var(--timeline-region-color-shapes-derived); }
        .curve-editor[data-category='math'][data-subgroup='functions'] .graph-path { stroke: var(--timeline-region-color-math-functions); }
        .curve-editor[data-category='math'][data-subgroup='functions'] .graph-keyframe-circle { fill: var(--timeline-region-color-math-functions); }
        .curve-editor[data-category='math'][data-subgroup='functions'] .graph-keyframe-circle.is-selected { stroke: var(--timeline-region-color-math-functions); }
        .curve-editor[data-category='math'][data-subgroup='advanced'] .graph-path { stroke: var(--timeline-region-color-math-advanced); }
        .curve-editor[data-category='math'][data-subgroup='advanced'] .graph-keyframe-circle { fill: var(--timeline-region-color-math-advanced); }
        .curve-editor[data-category='math'][data-subgroup='advanced'] .graph-keyframe-circle.is-selected { stroke: var(--timeline-region-color-math-advanced); }
        .curve-editor[data-category='distort'][data-subgroup='warp'] .graph-path { stroke: var(--timeline-region-color-distort-warp); }
        .curve-editor[data-category='distort'][data-subgroup='warp'] .graph-keyframe-circle { fill: var(--timeline-region-color-distort-warp); }
        .curve-editor[data-category='distort'][data-subgroup='warp'] .graph-keyframe-circle.is-selected { stroke: var(--timeline-region-color-distort-warp); }
        .curve-editor[data-category='effects'][data-subgroup='stylize'] .graph-path { stroke: var(--timeline-region-color-effects-stylize); }
        .curve-editor[data-category='effects'][data-subgroup='stylize'] .graph-keyframe-circle { fill: var(--timeline-region-color-effects-stylize); }
        .curve-editor[data-category='effects'][data-subgroup='stylize'] .graph-keyframe-circle.is-selected { stroke: var(--timeline-region-color-effects-stylize); }
      }
    }

    /* Content: flex container for TimelinePanel (.inner) and curve-slot */
    .content {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      flex: 1;
      min-height: 0;
      overflow: hidden;
      padding: 0;
    }
  }

  /* Add Lane dropdown: uses Popover + .frame; layout/sizing here */
  :global(.timeline-add-lane-dropdown) {
    /* Layout */
    position: fixed;
    top: var(--dropdown-top, 0);
    left: var(--dropdown-left, 0);
    display: none;
    flex-direction: column;

    /* Box model: from layer .frame; overrides */
    min-width: 200px; /* One-off */
    max-height: 280px; /* One-off */

    /* Other */
    z-index: var(--message-z-index);
    overflow-x: hidden;
    overflow-y: hidden;

    &.is-open {
      display: flex;
    }

    .menu-input {
      margin-bottom: var(--pd-sm);
    }

    .timeline-add-lane-list {
      flex: 1;
      min-height: 0;
      max-height: 180px; /* One-off */
      overflow-y: auto;
      overflow-x: hidden;
      padding: 0;
      scrollbar-width: none;
      -ms-overflow-style: none;
    }

    .timeline-add-lane-list::-webkit-scrollbar {
      display: none;
    }
  }

  /* === Layout (component-owned: colocated from timeline layout) === */
  .inner {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    flex: 1;
    min-height: 0;

    .timeline-header {
      position: static;
      flex-shrink: 0;
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 0;
      padding: var(--pd-xs);
      height: fit-content;

      :global(.button) {
        border-radius: calc(var(--radius-md) - var(--pd-xs));
      }

      .header-left {
        width: var(--track-header-width);
        flex-shrink: 0;
        display: flex;
        align-items: center;

        .actions {
          position: relative;

          :global(.add-lane-btn) {
            display: inline-flex;
            align-items: center;
            gap: var(--pd-xs);
          }
        }
      }

      .header-right {
        margin-left: auto;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        gap: var(--pd-md);

        .bpm-wrap {
          display: flex;
          align-items: center;
          gap: var(--pd-xs);

          .bpm-label {
            font-size: var(--text-xs);
            color: var(--color-gray-100);
          }

          :global(.bpm-input) {
            width: 3.5em;
            appearance: textfield;
            -moz-appearance: textfield;
          }

          :global(.bpm-input)::-webkit-inner-spin-button,
          :global(.bpm-input)::-webkit-outer-spin-button {
            appearance: none;
            -webkit-appearance: none;
            margin: 0;
          }
        }

        .snap-wrap {
          display: flex;
          align-items: center;
          gap: var(--pd-xs);
        }

        :global(.snap-grid-button),
        :global(.snap-grid-button *) {
          padding: 0 var(--pd-sm);
        }

        :global(.snap-grid):focus {
          background: var(--ghost-bg-hover);
          border-color: var(--color-gray-70);
        }

        :global(.close) {
          flex-shrink: 0;
        }
      }
    }

    .scroll {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      overflow: hidden;
      padding: 0;

      .scroll-viewport {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
        overflow-y: auto;
        overflow-x: hidden;
        scrollbar-width: none;
        -ms-overflow-style: none;
      }

      .scroll-viewport::-webkit-scrollbar {
        display: none;
      }

      .scroll-content {
        flex: 1 0 auto;
        min-height: 100%;
        display: flex;
        flex-direction: row;
        align-items: stretch;
      }

      .track-headers-col {
        flex-shrink: 0;
        width: var(--track-header-width);
        min-height: 100%;
        display: flex;
        flex-direction: column;
        gap: var(--pd-sm);
        padding: var(--pd-xs) 0 var(--pd-xs) var(--pd-xs);

        .lane-header {
          display: flex;
          align-items: center;
          gap: var(--pd-xs);
          padding: 0 var(--pd-md);
          min-height: var(--size-md);
        }

        .footer-spacer {
          flex-shrink: 0;
          min-height: calc(var(--size-2xs) + var(--size-xs) + var(--pd-xs));
        }

        .lane-label {
          flex: 1;
          min-width: 0;
          display: flex;
          align-items: center;
          gap: var(--pd-sm);
          padding: var(--pd-xs) 0;
          font-size: var(--text-xs);
          color: var(--print-highlight);
        }

        .lane-label-icon {
          flex-shrink: 0;
          width: var(--icon-size-sm);
          height: var(--icon-size-sm);
        }

        .lane-label-icon :global(svg) {
          width: 100%;
          height: 100%;
          display: block;
        }

        .lane-label-text {
          min-width: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1;
        }

        :global(.delete-lane-btn) {
          flex-shrink: 0;
        }
      }

      .lanes-and-scrubber-col {
        flex: 1;
        min-width: 0;
        min-height: 100%;
        display: flex;
        flex-direction: column;
        background: var(--color-gray-60);
        border-radius: var(--radius-md);
        overflow: hidden;

      .lanes-inner {
        position: relative;
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
        gap: var(--pd-sm);
        padding: var(--pd-sm);
      }

      .timeline-footer-right {
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        gap: var(--pd-xs);
        padding: 0 var(--pd-xs) var(--pd-xs);
        box-sizing: border-box;

        .scroller-row {
          flex-shrink: 0;
          min-height: 12px;
        }

        .scroller {
          position: relative;
          width: 100%;
          height: var(--size-2xs);
          border-radius: var(--radius-2xs);
          background: var(--color-gray-50);
          cursor: grab;

          &:active {
            cursor: grabbing;
          }

          .scroller-thumb {
            position: absolute;
            top: 0;
            bottom: 0;
            left: 0;
            border-radius: var(--radius-2xs);
            background: var(--color-teal-gray-110);
            pointer-events: none;

            &:hover {
              background: var(--color-teal-gray-120);
            }

            &:active {
              background: var(--color-teal-120);
            }
          }
        }

        .ruler-row {
          flex-shrink: 0;
          min-height: 40px;
        }

        .ruler-track {
          position: relative;
          display: flex;
          flex-direction: column;
          width: 100%;
          min-height: var(--size-2xs);
          gap: 0;
        }

        .ruler-track.ruler-seek-enabled {
          cursor: default;
        }

        .ruler-track .ruler-waveform {
          position: relative;
          width: 100%;
          height: 20px;
          flex-shrink: 0;
          pointer-events: none;
        }

        .ruler-track .ruler-waveform canvas {
          display: block;
          width: 100%;
          height: 100%;
        }

        .ruler-track .ruler-bars {
          position: relative;
          height: var(--size-xs);
          flex-shrink: 0;
        }

        .ruler-track .ruler-tick {
          position: absolute;
          top: 0;
          bottom: 0;
          display: flex;
          align-items: center;
          transform: translateX(-50%);
        }

        .ruler-track .ruler-tick::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 1px;
          background: var(--print-subtle);
        }

        .ruler-track .ruler-label {
          position: relative;
          margin-left: var(--pd-xs);
          font-size: var(--text-xs);
          color: var(--print-subtle);
          font-family: var(--font-mono);
          font-weight: 700;
          padding-top: var(--pd-xs);
          white-space: nowrap;
        }
      }

      .lanes-inner .lane-row {
        display: flex;
        align-items: stretch;
        min-height: var(--size-md);

        .track-wrap {
            flex: 1;
            min-width: 0;
            width: 100%;

            .track {
              position: relative;
              width: var(--timeline-track-width, 400px);
              min-height: var(--size-md);
              border-radius: var(--radius-xs);
              overflow: hidden;
              background: var(--color-gray-50);

              .track-grid {
                position: absolute;
                inset: 0;
                pointer-events: none;
                z-index: 0;
              }

              .track-grid-line {
                position: absolute;
                top: 0;
                bottom: 0;
                width: 1px;
                margin-left: -0.5px;
                background: var(--color-gray-70);
              }

              .region-block {
                position: absolute;
                top: var(--pd-2xs);
                bottom: var(--pd-2xs);
                background: var(--timeline-region-color-default);
                border-radius: var(--radius-xs);
                box-sizing: border-box;
                cursor: default;
                user-select: none;
              }

              .region-block[data-category='inputs'] {
                background: var(--timeline-region-color-inputs);
              }
              .region-block[data-category='patterns'] {
                background: var(--timeline-region-color-patterns);
              }
              .region-block[data-category='shapes'] {
                background: var(--timeline-region-color-shapes);
              }
              .region-block[data-category='sdf'] {
                background: var(--timeline-region-color-sdf);
              }
              .region-block[data-category='math'] {
                background: var(--timeline-region-color-math);
              }
              .region-block[data-category='utilities'] {
                background: var(--timeline-region-color-utilities);
              }
              .region-block[data-category='distort'] {
                background: var(--timeline-region-color-distort);
              }
              .region-block[data-category='blend'] {
                background: var(--timeline-region-color-blend);
              }
              .region-block[data-category='mask'] {
                background: var(--timeline-region-color-mask);
              }
              .region-block[data-category='effects'] {
                background: var(--timeline-region-color-effects);
              }
              .region-block[data-category='output'] {
                background: var(--timeline-region-color-output);
              }
              .region-block[data-category='audio'] {
                background: var(--timeline-region-color-audio);
              }

              /* Sub-group overrides (match node panel icon box sub-group colors) */
              .region-block[data-category='inputs'][data-subgroup='system-input'] {
                background: var(--timeline-region-color-inputs-system);
              }
              .region-block[data-category='patterns'][data-subgroup='structured'] {
                background: var(--timeline-region-color-patterns-structured);
              }
              .region-block[data-category='shapes'][data-subgroup='derived'] {
                background: var(--timeline-region-color-shapes-derived);
              }
              .region-block[data-category='math'][data-subgroup='functions'] {
                background: var(--timeline-region-color-math-functions);
              }
              .region-block[data-category='math'][data-subgroup='advanced'] {
                background: var(--timeline-region-color-math-advanced);
              }
              .region-block[data-category='distort'][data-subgroup='warp'] {
                background: var(--timeline-region-color-distort-warp);
              }
              .region-block[data-category='effects'][data-subgroup='stylize'] {
                background: var(--timeline-region-color-effects-stylize);
              }

              .region-block.is-selected {
                border: 2px solid var(--color-gray-130);
              }

              .region-resize {
                position: absolute;
                top: 0;
                bottom: 0;
                width: 8px;
                cursor: ew-resize;
                pointer-events: auto;
              }

              .region-resize-left {
                left: 0;
              }

              .region-resize-right {
                right: 0;
              }
            }
          }
        }
      }

      .lanes-inner .playhead-clip {
        position: absolute;
        top: 0;
        bottom: 0;
        left: var(--pd-xs);
        width: var(--timeline-track-width, 400px);
        overflow: hidden;
        pointer-events: none;
        z-index: 1;
      }

      .lanes-inner .playhead-handle {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 12px;
        margin-left: -4px;
        pointer-events: auto;
        cursor: col-resize;
        touch-action: none;
        z-index: 2;
        --timeline-playhead-bg: var(--print-highlight);
      }

      .lanes-inner .playhead-handle:hover {
        --timeline-playhead-bg: var(--color-teal-120);
      }

      .lanes-inner .playhead-handle:active {
        --timeline-playhead-bg: var(--primary-bg-active);
      }

      .lanes-inner .playhead-handle.is-dragging {
        cursor: grabbing;
        user-select: none;
        --timeline-playhead-bg: var(--primary-bg-active);
      }

      .lanes-inner .playhead-handle .playhead {
        position: absolute;
        top: 0;
        bottom: 0;
        left: 5px;
        width: 2px;
        margin-left: -1px;
        background: var(--timeline-playhead-bg, var(--print-light));
        pointer-events: none;
      }
    }
  }
</style>
