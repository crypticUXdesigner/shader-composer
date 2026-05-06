<script lang="ts">
  /**
   * BottomBar
   * Composes BottomBarPlaybackControls, BottomBarScrubber, BottomBarToolSelector; hosts timeline panel and keyboard shortcuts.
   */
  import { graphStore } from '../../stores';
  import type { ToolType } from '../../stores';
  import type { AudioSetup } from '../../../data-model/audioSetupTypes';
  import type { WaveformData } from '../../../runtime';
  import type { AuthenticatedClient } from '@audiotool/nexus';
  import type { PlaylistTrackPickMeta } from '../../../data-model/audioSetupTypes';
  import BottomBarPlaybackControls from './BottomBarPlaybackControls.svelte';
  import BottomBarScrubber from './BottomBarScrubber.svelte';
  import BottomBarToolSelector from './BottomBarToolSelector.svelte';
  import { pollOnAnimationFrame } from '../../utils/pollOnAnimationFrame';

  interface PlaybackState {
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    /** When true, primary audio has a decoded buffer (see runtime TimelineState). */
    hasAudio?: boolean;
  }

  interface Props {
    getState?: () => PlaybackState | null;
    getWaveformForPrimary?: (trackKey?: string) => Promise<WaveformData>;
    onPlayToggle?: () => void;
    loopCurrentTrack?: boolean;
    onLoopToggle?: () => void;
    onTimeChange?: (time: number) => void;
    onToolChange?: (tool: ToolType) => void;
    onTimelinePanelOpen?: () => void;
    audioSetup?: AudioSetup;
    /** Primary track key from App (ensures waveform scrubber updates on track change when rendered via snippet). */
    primaryTrackKey?: string | null;
    /** If provided, scrubber uses this as fallback. */
    getTrackKey?: () => string | undefined;
    getPrimaryAudioFileNodeId?: () => string | undefined;
    onSelectTrack?: (trackId: string, pickMeta?: PlaylistTrackPickMeta) => void | Promise<void>;
    onAudioFileSelected?: (nodeId: string, file: File) => Promise<void>;
    /** Optional Audiotool OAuth session for listing user tracks in LoadTrackDialog. */
    audiotoolRpcClient?: AuthenticatedClient | null;
    /** OAuth user name (handle) for user-scoped APIs. */
    audiotoolUserName?: string | null;
    /** Called when RPC indicates OAuth bearer is invalid (expired/revoked). */
    onAudiotoolSessionInvalidated?: () => void;
    timelinePanel?: import('svelte').Snippet<[]>;
    curveEditorSlot?: import('svelte').Snippet<[]>;
  }

  let {
    getState,
    getWaveformForPrimary,
    onPlayToggle,
    loopCurrentTrack = false,
    onLoopToggle,
    onTimeChange,
    onToolChange,
    onTimelinePanelOpen,
    audioSetup = { files: [], bands: [], remappers: [] },
    primaryTrackKey = null,
    getTrackKey,
    getPrimaryAudioFileNodeId,
    onSelectTrack,
    onAudioFileSelected,
    audiotoolRpcClient = null,
    audiotoolUserName = null,
    onAudiotoolSessionInvalidated,
    timelinePanel,
    curveEditorSlot,
  }: Props = $props();

  let bottomBarEl: HTMLDivElement;
  let contentEl: HTMLDivElement;
  let curveSlotEl: HTMLDivElement;

  let isTimelinePanelOpen = $state(false);
  let isSpacebarPressed = $state(false);
  let isPlaying = $state(false);
  /** Bumps when decoded primary audio attaches so the scrubber re-fetches waveform (reload race). */
  let playbackWaveformToken = $state('0:0.000');
  const SPACE_PRESS_THRESHOLD = 200;
  let spacebarPressTime: number | null = null;

  function primaryKey(src: NonNullable<AudioSetup['primarySource']>): string {
    return src.type === 'playlist' ? src.trackId : src.type === 'upload' ? src.file?.id ?? '' : '';
  }

  const currentPrimary = $derived(graphStore.audioSetup?.primarySource);
  const currentKey = $derived(currentPrimary ? primaryKey(currentPrimary) : null);

  const activeTool = $derived(graphStore.activeTool);
  const effectiveTool = $derived(isSpacebarPressed ? 'hand' : activeTool);

  const scrubberTrackKey = $derived.by(() => {
    const base = primaryTrackKey ?? currentKey ?? '';
    return `${base}|${playbackWaveformToken}`;
  });

  // Transport tick for BottomBarPlaybackControls + waveform reload token when MP3 decodes
  $effect(() => {
    if (!getState) return;
    return pollOnAnimationFrame(() => {
      const state = getState();
      isPlaying = state?.isPlaying ?? false;
      const has = state?.hasAudio === true;
      const dur = state?.duration ?? 0;
      playbackWaveformToken = `${has ? 1 : 0}:${dur.toFixed(3)}`;
    });
  });

  function handleToolClick(tool: ToolType) {
    graphStore.setActiveTool(tool);
    onToolChange?.(tool);
  }

  function handleToggleTimelinePanel() {
    isTimelinePanelOpen = !isTimelinePanelOpen;
    if (isTimelinePanelOpen) {
      onTimelinePanelOpen?.();
    }
  }

  // Keyboard shortcuts
  $effect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      if ((e.key === ' ' || e.key === 'Space') && !isInput && !e.repeat && spacebarPressTime === null) {
        spacebarPressTime = Date.now();
      }

      if (!isInput && !e.ctrlKey && !e.metaKey) {
        if (e.key === 'v' || e.key === 'V') {
          e.preventDefault();
          handleToolClick('cursor');
        } else if (e.key === 'h' || e.key === 'H') {
          e.preventDefault();
          handleToolClick('hand');
        } else if (e.key === 's' || e.key === 'S') {
          e.preventDefault();
          handleToolClick('select');
        } else if (e.key === 'p' || e.key === 'P') {
          e.preventDefault();
          handleToolClick('patch');
        }
      }
    }

    function onKeyUp(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      if ((e.key === ' ' || e.key === 'Space') && !isInput && spacebarPressTime !== null) {
        const pressDuration = Date.now() - spacebarPressTime;
        if (pressDuration < SPACE_PRESS_THRESHOLD) {
          e.preventDefault();
          onPlayToggle?.();
        }
        spacebarPressTime = null;
      }
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  });

  export function setSpacebarPressed(isPressed: boolean): void {
    isSpacebarPressed = isPressed;
  }
  export function setTimelinePanelOpen(open: boolean): void {
    isTimelinePanelOpen = open;
  }
  export function isTimelinePanelVisible(): boolean {
    return isTimelinePanelOpen;
  }
  export function getTimelinePanelContentElement(): HTMLElement | null {
    return contentEl ?? null;
  }
  export function getTimelineCurveEditorSlotElement(): HTMLElement | null {
    return curveSlotEl ?? null;
  }
  export function getElement(): HTMLElement | null {
    return bottomBarEl ?? null;
  }
</script>

<svelte:window />

<div class="bottom-bar-wrapper">
  <div bind:this={bottomBarEl} class="bottom-bar">
    <!-- Left: Play + Track selector -->
    <div class="section">
      <BottomBarPlaybackControls
        isPlaying={isPlaying}
        audioSetup={audioSetup}
        loopCurrentTrack={loopCurrentTrack}
        onPlayToggle={onPlayToggle}
        onLoopToggle={onLoopToggle}
        getPrimaryAudioFileNodeId={getPrimaryAudioFileNodeId}
        onSelectTrack={onSelectTrack}
        onAudioFileSelected={onAudioFileSelected}
        audiotoolRpcClient={audiotoolRpcClient}
        audiotoolUserName={audiotoolUserName ?? undefined}
        onAudiotoolSessionInvalidated={onAudiotoolSessionInvalidated}
      />
    </div>

    <!-- Center: Timeline panel + scrubber -->
    <div class="section center timeline-center">
      <div class="timeline-panel frame" class:is-open={isTimelinePanelOpen} aria-hidden={!isTimelinePanelOpen}>
        <div bind:this={curveSlotEl} class="curve-slot">
          {@render curveEditorSlot?.()}
        </div>
        <div bind:this={contentEl} class="content">
          {#if timelinePanel}
            {@render timelinePanel()}
          {:else}
            No lanes
          {/if}
        </div>
      </div>

      <BottomBarScrubber
        trackKey={scrubberTrackKey}
        getTrackKey={getTrackKey}
        getState={getState}
        getWaveformForPrimary={getWaveformForPrimary}
        onTimeChange={onTimeChange}
        isTimelinePanelOpen={isTimelinePanelOpen}
        onToggleTimelinePanel={handleToggleTimelinePanel}
      />
    </div>

    <!-- Right: Tool selector -->
    <div class="section">
      <BottomBarToolSelector effectiveTool={effectiveTool} onToolChange={onToolChange} />
    </div>
  </div>
</div>

<style>
  /* === Bottom bar layout (moved from layout/bottom-bar.css) === */
  .bottom-bar-wrapper {
    /* Layout */
    position: fixed;
    bottom: 0;
    left: var(--top-bar-left-offset, 0px);
    right: 0;

    /* Visual: transparent so gradient in .bottom-bar shows through */
    background: transparent;

    /* Other */
    z-index: var(--bottom-bar-z-index);
    pointer-events: none;
    transition: left var(--motion-spatial-fast-duration) var(--motion-spatial-fast-easing);
  }

  .bottom-bar {
    /* Layout */
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: var(--bottom-bar-height);

    /* Box model */
    padding: 0 var(--pd-xl);

    /* Visual */
    background: radial-gradient(ellipse 40% 80% at 50% 100%, rgba(0, 0, 0, 0.35) 0%, transparent 100%);

    /* Other */
    pointer-events: none;

    .section {
      /* Layout */
      display: flex;
      align-items: center;
      gap: var(--pd-xl);
      min-width: 0; /* allow shrink so track selector stays within bar */

      /* Box model */
      padding: var(--pd-lg) 0;

      /* Other */
      pointer-events: auto;

      &.center.timeline-center {
        position: absolute;
        left: 0;
        right: 0;
        display: flex;
        justify-content: center;
        align-items: center;
        pointer-events: none;

        .timeline-panel,
        :global(.playback-scrubber .timeline-preview-block) {
          pointer-events: auto;
        }
      }
    }
  }

  /* === Timeline panel shell (hosts TimelinePanel + curve editor slot) === */
  .timeline-panel {
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
      var(--timeline-viewport-left, 0) +
        (var(--timeline-viewport-width, 100vw) - var(--timeline-panel-computed-width)) / 2
    );
    display: none;
    flex-direction: column;
    min-height: 0;

    /* Box model: width/height from here; frame look from layer .frame */
    width: var(--timeline-panel-computed-width);
    min-height: var(--timeline-panel-height);
    height: auto;
    max-height: min(80vh, 520px); /* One-off max height */
    padding: 0;

    /* Other */
    z-index: var(--timeline-panel-z-index);
    pointer-events: auto;
    transition: left var(--motion-spatial-fast-duration) var(--motion-spatial-fast-easing);

    &.is-open {
      display: flex;
      /* Use full available height so timeline body (and bg column) can fill it */
      height: min(30vh, 360px);
      min-height: var(--timeline-panel-height);
    }

    /* Total height = same lane stack as when closed + curve band (do not steal lane height). */
    &:has(.curve-slot:not(:empty)) {
      height: calc(min(30vh, 360px) + var(--timeline-curve-editor-slot-height));
      min-height: var(--timeline-panel-height-with-editor);
      max-height: min(80vh, calc(520px + var(--timeline-curve-editor-slot-height)));
    }

    /* With curve editor open: curve-slot has fixed height so graph stays within bounds, timeline below */
    &:has(.curve-slot:not(:empty)) .curve-slot {
      flex-shrink: 0;
      height: var(--timeline-curve-editor-slot-height);
      max-height: var(--timeline-curve-editor-slot-height);
      min-height: 0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    &:has(.curve-slot:not(:empty)) .curve-slot :global(.curve-editor) {
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
    --track-header-width: 200px;

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
</style>
