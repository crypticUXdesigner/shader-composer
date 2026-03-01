<script lang="ts">
  /**
   * BottomBar - Svelte 5 Migration WP 04B
   * Composes BottomBarPlaybackControls, BottomBarScrubber, BottomBarToolSelector; hosts timeline panel and keyboard shortcuts.
   */
  import { graphStore } from '../../stores';
  import type { ToolType } from '../../stores';
  import type { AudioSetup } from '../../../data-model/audioSetupTypes';
  import type { WaveformData } from '../../../runtime';
  import BottomBarPlaybackControls from './BottomBarPlaybackControls.svelte';
  import BottomBarScrubber from './BottomBarScrubber.svelte';
  import BottomBarToolSelector from './BottomBarToolSelector.svelte';

  interface PlaybackState {
    isPlaying: boolean;
    currentTime: number;
    duration: number;
  }

  interface Props {
    getState?: () => PlaybackState | null;
    getWaveformForPrimary?: (trackKey?: string) => Promise<WaveformData>;
    onPlayToggle?: () => void;
    loopCurrentTrack?: boolean;
    onLoopToggle?: () => void;
    onSkipBack?: () => void;
    onSkipForward?: () => void;
    onTimeChange?: (time: number) => void;
    onToolChange?: (tool: ToolType) => void;
    onTimelinePanelOpen?: () => void;
    audioSetup?: AudioSetup;
    /** Primary track key from App (ensures waveform scrubber updates on track change when rendered via snippet). */
    primaryTrackKey?: string | null;
    /** If provided, scrubber uses this as fallback. */
    getTrackKey?: () => string | undefined;
    getPrimaryAudioFileNodeId?: () => string | undefined;
    onSelectTrack?: (trackId: string) => void;
    onAudioFileSelected?: (nodeId: string, file: File) => Promise<void>;
    timelinePanel?: import('svelte').Snippet<[]>;
    curveEditorSlot?: import('svelte').Snippet<[]>;
  }

  let {
    getState,
    getWaveformForPrimary,
    onPlayToggle,
    loopCurrentTrack = false,
    onLoopToggle,
    onSkipBack,
    onSkipForward,
    onTimeChange,
    onToolChange,
    onTimelinePanelOpen,
    audioSetup = { files: [], bands: [], remappers: [] },
    primaryTrackKey = null,
    getTrackKey,
    getPrimaryAudioFileNodeId,
    onSelectTrack,
    onAudioFileSelected,
    timelinePanel,
    curveEditorSlot,
  }: Props = $props();

  let bottomBarEl: HTMLDivElement;
  let contentEl: HTMLDivElement;
  let curveSlotEl: HTMLDivElement;

  let isTimelinePanelOpen = $state(false);
  let isSpacebarPressed = $state(false);
  let isPlaying = $state(false);
  const SPACE_PRESS_THRESHOLD = 200;
  let spacebarPressTime: number | null = null;

  function primaryKey(src: NonNullable<AudioSetup['primarySource']>): string {
    return src.type === 'playlist' ? src.trackId : src.type === 'upload' ? src.file?.id ?? '' : '';
  }

  const currentPrimary = $derived(graphStore.audioSetup?.primarySource);
  const currentKey = $derived(currentPrimary ? primaryKey(currentPrimary) : null);

  const activeTool = $derived(graphStore.activeTool);
  const effectiveTool = $derived(isSpacebarPressed ? 'hand' : activeTool);

  // Poll play state for BottomBarPlaybackControls
  $effect(() => {
    if (!getState) return;
    const interval = setInterval(() => {
      const state = getState();
      isPlaying = state?.isPlaying ?? false;
    }, 100);
    return () => clearInterval(interval);
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
        onSkipBack={onSkipBack}
        onSkipForward={onSkipForward}
        getPrimaryAudioFileNodeId={getPrimaryAudioFileNodeId}
        onSelectTrack={onSelectTrack}
        onAudioFileSelected={onAudioFileSelected}
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
        trackKey={primaryTrackKey ?? currentKey}
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
    transition: left 0.3s ease;
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
</style>
