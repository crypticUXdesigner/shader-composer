<script lang="ts">
  /**
   * BottomBarPlaybackControls - Play/pause, loop, skip, and track selector for the bottom bar.
   */
  import { Button, ButtonGroup, IconSvg } from '../ui';
  import BottomBarTrackSelector from './BottomBarTrackSelector.svelte';
  import type { AudioSetup } from '../../../data-model/audioSetupTypes';

  interface Props {
    isPlaying: boolean;
    audioSetup: AudioSetup;
    loopCurrentTrack?: boolean;
    onPlayToggle?: () => void;
    onLoopToggle?: () => void;
    onSkipBack?: () => void;
    onSkipForward?: () => void;
    getPrimaryAudioFileNodeId?: () => string | undefined;
    onSelectTrack?: (trackId: string) => void;
    onAudioFileSelected?: (nodeId: string, file: File) => Promise<void>;
  }

  let {
    isPlaying,
    audioSetup,
    loopCurrentTrack = false,
    onPlayToggle,
    onLoopToggle,
    onSkipBack,
    onSkipForward,
    getPrimaryAudioFileNodeId,
    onSelectTrack,
    onAudioFileSelected,
  }: Props = $props();

  function handlePlayToggle() {
    onPlayToggle?.();
  }
</script>

<div class="playback-controls">
  <ButtonGroup class="playback-controls-group">
    <Button variant="ghost" size="sm" mode="icon-only" class={isPlaying ? 'is-active' : ''} title="Play/Pause all audio (Space)" onclick={handlePlayToggle}>
      {#if isPlaying}
        <IconSvg name="pause" variant="filled" />
      {:else}
        <IconSvg name="play" variant="filled" />
      {/if}
    </Button>
    {#if audioSetup?.primarySource?.type === 'playlist'}
      <Button
        variant="ghost"
        size="sm"
        mode="icon-only"
        class={loopCurrentTrack ? 'is-active' : ''}
        title={loopCurrentTrack ? 'Loop current track (on)' : 'Loop current track (off) — playlist continues'}
        onclick={() => onLoopToggle?.()}
      >
        <IconSvg name="repeat" variant="line" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        mode="icon-only"
        title="Previous track"
        onclick={() => onSkipBack?.()}
      >
        <IconSvg name="skip-back" variant="filled" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        mode="icon-only"
        title="Next track"
        onclick={() => onSkipForward?.()}
      >
        <IconSvg name="skip-forward" variant="filled" />
      </Button>
    {/if}
    <BottomBarTrackSelector
      audioSetup={audioSetup}
      getPrimaryAudioFileNodeId={getPrimaryAudioFileNodeId ?? (() => undefined)}
      onSelectTrack={onSelectTrack ?? (() => {})}
      onAudioFileSelected={onAudioFileSelected ?? (async () => {})}
    />
  </ButtonGroup>
</div>

<style>
  .playback-controls {
    width: fit-content;
    max-width: min(320px, 100%); /* cap at 320px but never exceed parent */
    min-width: 0;
  }

  /* ButtonGroup root has .playback-controls-group (child component); use :global so selectors match */
  :global(.playback-controls-group) {
    min-width: 0; /* allow track selector to shrink within playback controls */
 
    :global(> .button:first-child) {
      flex-shrink: 0;
    }

    :global(.track-selector .label) {
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
</style>
