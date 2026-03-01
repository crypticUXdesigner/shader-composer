<script lang="ts">
  /**
   * AudioSignalPickerLargeContent - WP audio-signal-picker 02A
   * Large popover when port has no audio connection: two-column layout (bands | remappers for selected band),
   * New band, full band config and remapper add/edit, explicit Connect band (raw) / Connect [remapper] actions.
   * Used only by AudioSignalPickerPanel (floating-panel).
   */
  import { Button, IconSvg, ValueInput } from '../ui';
  import BandCard from '../audio/BandCard.svelte';
  import RemapperCard from '../audio/RemapperCard.svelte';
  import type { LargeSlotProps } from './AudioSignalPicker.types';
  import type { AudioBandEntry, AudioRemapperEntry } from '../../../data-model/audioSetupTypes';
  import {
    updateAudioBand,
    addAudioRemapper,
    updateAudioRemapper,
    removeAudioBand,
    removeAudioRemapper,
    generateUUID,
  } from '../../../data-model';
  import { getVirtualNodeId } from '../../../utils/virtualNodes';
  import { subscribeParameterValueTick } from '../../stores/parameterValueTickStore';

  let {
    audioSetup,
    onSelect,
    onClose,
    onAudioSetupChange,
    getAudioManager,
    initialBandId,
    registerDeleteHandler,
  }: LargeSlotProps = $props();

  /** Selected band filters the right column (remappers). Null = show all remappers. */
  let selectedBandId = $state<string | null>(null);
  /** Remapper IDs selected for delete (e.g. Del key). */
  let selectedRemapperIds = $state<Set<string>>(new Set());
  /** Tracks which initialBandId we already applied so we don't overwrite user selection on every reactive run. */
  let lastAppliedInitialBandId = $state<string | null>(null);

  let spectrumDataByBand = $state<Map<string, { frequencyData: Uint8Array; fftSize: number; sampleRate: number }>>(new Map());
  let liveValuesByRemapper = $state<Map<string, { incoming: number | null; outgoing: number | null }>>(new Map());

  /** Throttle live updates to ~20 fps to avoid driving Svelte reactivity at 60 fps. */
  const LIVE_UPDATE_INTERVAL_MS = 50;

  $effect(() => {
    const am = getAudioManager?.();
    const setup = audioSetup;
    if (!am || typeof am.getAnalyzerSpectrumData !== 'function') return;
    let lastUpdateTime = 0;
    const specMap = new Map<string, { frequencyData: Uint8Array; fftSize: number; sampleRate: number }>();
    const liveMap = new Map<string, { incoming: number | null; outgoing: number | null }>();
    return subscribeParameterValueTick(() => {
      specMap.clear();
      liveMap.clear();
      for (const band of setup.bands) {
        const spec = am.getAnalyzerSpectrumData(band.id);
        if (spec) specMap.set(band.id, spec);
        for (const remap of setup.remappers.filter((r) => r.bandId === band.id)) {
          const live = am.getPanelBandLiveValues?.(band.id, {
            inMin: remap.inMin,
            inMax: remap.inMax,
            outMin: remap.outMin,
            outMax: remap.outMax,
          });
          if (live) liveMap.set(remap.id, live);
        }
      }
      const now = performance.now();
      if (now - lastUpdateTime >= LIVE_UPDATE_INTERVAL_MS) {
        lastUpdateTime = now;
        spectrumDataByBand = new Map(specMap);
        liveValuesByRemapper = new Map(liveMap);
      }
    });
  });

  const bands = $derived(audioSetup.bands);
  const files = $derived(audioSetup.files);
  const remappers = $derived(audioSetup.remappers);
  const hasFiles = $derived(files.length > 0);

  const selectedBand = $derived(
    selectedBandId != null ? bands.find((b) => b.id === selectedBandId) ?? null : null
  );
  const selectedBandRemappers = $derived(
    selectedBandId != null
      ? remappers.filter((r) => r.bandId === selectedBandId)
      : remappers
  );

  /** Keep selection valid: clear when there are no bands or the selected band was removed. */
  $effect(() => {
    if (bands.length === 0) {
      selectedBandId = null;
      lastAppliedInitialBandId = null;
    } else if (selectedBandId != null && !bands.some((b) => b.id === selectedBandId)) {
      selectedBandId = null;
    }
  });

  /** When a band is created (count increases by one), select the new band. Use a plain ref so updating it doesn't re-trigger the effect. */
  const prevBandIdsRef = { current: new Set<string>() };
  $effect(() => {
    const currentIds = new Set(bands.map((b) => b.id));
    const prev = prevBandIdsRef.current;
    if (currentIds.size === prev.size + 1) {
      const newId = [...currentIds].find((id) => !prev.has(id));
      if (newId != null) selectedBandId = newId;
    }
    prevBandIdsRef.current = currentIds;
  });

  /** When opened from compact with a specific band, pre-select it once (do not overwrite user selection later). */
  $effect(() => {
    const bid = initialBandId ?? null;
    if (!bid || !bands.some((b) => b.id === bid)) return;
    if (lastAppliedInitialBandId === bid) return;
    lastAppliedInitialBandId = bid;
    selectedBandId = bid;
  });

  function toggleBandSelection(bandId: string) {
    selectedBandId = selectedBandId === bandId ? null : bandId;
  }

  function toggleRemapperSelection(remapperId: string, e: MouseEvent) {
    const target = e.target instanceof HTMLElement ? e.target : null;
    if (target?.closest('input, textarea, select, button, [contenteditable="true"]')) return;
    selectedRemapperIds = new Set(
      selectedRemapperIds.has(remapperId)
        ? [...selectedRemapperIds].filter((id) => id !== remapperId)
        : [...selectedRemapperIds, remapperId]
    );
  }

  function deleteSelected() {
    let next = audioSetup;
    const hadRemappersToDelete = selectedRemapperIds.size > 0;
    for (const id of selectedRemapperIds) {
      next = removeAudioRemapper(next, id);
    }
    // Only delete the band when no remappers were selected (so "Del" means "delete band" not "delete remappers only")
    const bandRemoved =
      !hadRemappersToDelete && selectedBandId != null;
    if (bandRemoved) {
      next = removeAudioBand(next, selectedBandId!);
    }
    if (next !== audioSetup) {
      onAudioSetupChange?.(next);
      if (bandRemoved) selectedBandId = null;
      selectedRemapperIds = new Set();
    }
  }

  $effect(() => {
    registerDeleteHandler?.(deleteSelected);
    return () => registerDeleteHandler?.(null);
  });

  function handleBandChange(bandId: string, updater: (b: AudioBandEntry) => AudioBandEntry) {
    onAudioSetupChange?.(updateAudioBand(audioSetup, bandId, updater));
  }

  function handleConnectBandRaw(bandId: string) {
    const band = bands.find((b) => b.id === bandId);
    if (!band?.sourceFileId) return;
    const virtualNodeId = getVirtualNodeId(`band-${bandId}-raw`);
    onSelect?.({ type: 'audio', virtualNodeId });
    onClose?.();
  }

  function handleAddRemapper() {
    if (!selectedBandId) return;
    const newRemapper: AudioRemapperEntry = {
      id: `remap-${generateUUID()}`,
      name: `Remap ${selectedBandRemappers.length + 1}`,
      bandId: selectedBandId,
      inMin: 0,
      inMax: 1,
      outMin: 0,
      outMax: 1,
    };
    onAudioSetupChange?.(addAudioRemapper(audioSetup, newRemapper));
  }

  function handleRemapperChange(remapperId: string, updater: (r: AudioRemapperEntry) => AudioRemapperEntry) {
    onAudioSetupChange?.(updateAudioRemapper(audioSetup, remapperId, updater));
  }

  function handleConnectRemapper(remapperId: string) {
    const virtualNodeId = getVirtualNodeId(`remap-${remapperId}`);
    onSelect?.({ type: 'audio', virtualNodeId });
    onClose?.();
  }

  /** Document-level Del/Backspace so it works reliably (focus may be on band/remapper card; portal can affect bubbling). */
  const INPUT_LIKE_SELECTOR = 'input, textarea, select, [contenteditable="true"]';
  let largeContentRoot = $state<HTMLDivElement | null>(null);
  const deleteSelectedRef = { current: () => {} };

  $effect(() => {
    deleteSelectedRef.current = deleteSelected;
  });

  function onDocKeydown(e: KeyboardEvent) {
    if (e.key !== 'Delete' && e.key !== 'Backspace') return;
    const target = e.target instanceof Node ? e.target : null;
    if (!target || !largeContentRoot?.contains(target)) return;
    if (target instanceof Element && target.closest(INPUT_LIKE_SELECTOR)) return;
    deleteSelectedRef.current();
    e.preventDefault();
    e.stopPropagation();
  }

  $effect(() => {
    const root = largeContentRoot;
    if (!root) return;
    document.addEventListener('keydown', onDocKeydown, true);
    return () => document.removeEventListener('keydown', onDocKeydown, true);
  });
</script>

<div class="large" bind:this={largeContentRoot} role="group">
  <div class="columns" role="group" aria-label="Audio signal picker: bands and remappers">
    <div
      class="left"
      role={bands.length !== 0 ? 'listbox' : 'group'}
      aria-label="Bands"
    >
      {#if bands.length !== 0}
        {#each bands as band (band.id)}
          <BandCard
            band={band}
            isSelected={selectedBandId === band.id}
            spectrumData={spectrumDataByBand.get(band.id) ?? null}
            onSelect={() => toggleBandSelection(band.id)}
            onConnect={() => handleConnectBandRaw(band.id)}
            onDelete={() => {
              onAudioSetupChange?.(removeAudioBand(audioSetup, band.id));
              if (selectedBandId === band.id) selectedBandId = null;
            }}
            onBandChange={(updater) => handleBandChange(band.id, updater)}
          />
        {/each}
      {/if}
      {#if !hasFiles}
        <p class="hint">Upload to add an audio file and create bands.</p>
      {/if}
    </div>

    <div class="right frame-elevated" role="group" aria-label="Remappers for selected band">
      {#if selectedBand}
        <div class="toolbar">
          <div class="row">
            <span class="label">Smooth</span>
            <ValueInput
              value={selectedBand.smoothing}
              min={0}
              max={1}
              step={0.01}
              decimals={2}
              size="sm"
              onChange={(v) => handleBandChange(selectedBand.id, (b) => ({ ...b, smoothing: Math.max(0, Math.min(1, v)) }))}
              onCommit={(v) => handleBandChange(selectedBand.id, (b) => ({ ...b, smoothing: Math.max(0, Math.min(1, v)) }))}
              class="smoothing"
            />
          </div>
          <div class="row">
            <span class="label">FFT size</span>
            <ValueInput
              value={selectedBand.fftSize}
              min={256}
              max={8192}
              step={256}
              decimals={0}
              size="sm"
              onChange={(v) => handleBandChange(selectedBand.id, (b) => ({ ...b, fftSize: Math.max(256, Math.min(8192, Math.round(v / 256) * 256)) }))}
              onCommit={(v) => handleBandChange(selectedBand.id, (b) => ({ ...b, fftSize: Math.max(256, Math.min(8192, Math.round(v / 256) * 256)) }))}
              class="fft"
            />
          </div>
        </div>
      {/if}
      <div class="header">
        <span class="label">
          {#if bands.length === 0}
            Get started
          {:else if selectedBand}
            Remappers: {selectedBand.name || `Band`} ({remappers.length})
          {:else}
            Remappers ({remappers.length})
          {/if}
        </span>
        {#if selectedBand}
          <Button variant="secondary" size="sm" mode="both" iconPosition="trailing" onclick={handleAddRemapper}>
            <IconSvg name="plus" variant="line" />
            Add remapper
          </Button>
        {/if}
      </div>
      {#if selectedBandRemappers.length === 0}
        <p class="empty">
          {#if bands.length === 0}
            Create your first band.
          {:else if selectedBand}
            No remappers for this band. Add one or connect band (raw) on the left.
          {:else}
            No remappers yet. Select a band on the left to add one.
          {/if}
        </p>
      {:else}
        <div class="cards" role="listbox" aria-label="Remappers">
          {#each selectedBandRemappers as remapper (remapper.id)}
            <RemapperCard
              remapper={remapper}
              bandName={bands.find((b) => b.id === remapper.bandId)?.name ?? 'Band'}
              isSelected={selectedRemapperIds.has(remapper.id)}
              liveValues={liveValuesByRemapper.get(remapper.id) ?? null}
              onSelect={(e) => toggleRemapperSelection(remapper.id, e)}
              onConnect={() => handleConnectRemapper(remapper.id)}
              onDelete={() => {
                onAudioSetupChange?.(removeAudioRemapper(audioSetup, remapper.id));
                selectedRemapperIds = new Set([...selectedRemapperIds].filter((id) => id !== remapper.id));
              }}
              onRemapperChange={(updater) => handleRemapperChange(remapper.id, updater)}
            />
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .large {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 0;

    .columns {
      display: grid;
      grid-template-columns: 300px 460px; /* one-off: bands | remappers column widths */
      gap: 0;
      flex: 1;
      min-height: 0;

      .left {
        display: flex;
        flex-direction: column;
        gap: var(--pd-md);
        flex: 1;
        min-width: 0;
        min-height: 0;
        padding: var(--pd-md);
        overflow: auto;
        scrollbar-width: none;
        -ms-overflow-style: none;

        &::-webkit-scrollbar {
          display: none;
        }

        .hint {
          margin: var(--pd-xs) 0 0;
          font-size: var(--text-xs);
          color: var(--color-gray-110);
        }
      }

      .right {
        display: flex;
        flex-direction: column;
        min-width: 0;
        min-height: 0;
        padding: var(--pd-lg);
        gap: var(--pd-sm);
        background: var(--color-gray-60);
        border-radius: var(--radius-md);
        overflow: auto;
        scrollbar-width: none;
        -ms-overflow-style: none;

        &::-webkit-scrollbar {
          display: none;
        }

        .toolbar {
          display: flex;
          flex-direction: row;
          gap: var(--pd-md);
          margin-bottom: var(--pd-md);
          flex-shrink: 0;

          .row {
            display: flex;
            flex-direction: row;
            align-items: center;
            gap: var(--pd-sm);

            .label {
              font-size: var(--text-xs);
              color: var(--color-gray-110);
            }
          }
        }

        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--pd-sm);
          margin-bottom: var(--pd-sm);
          flex-shrink: 0;

          .label {
            font-size: var(--text-xs);
            font-weight: 600;
            color: var(--color-gray-110);
          }
        }

        .empty {
          margin: 0 0 var(--pd-sm);
          font-size: var(--text-sm);
          color: var(--text-muted, var(--color-gray-100));
        }

        .cards {
          display: flex;
          flex-direction: column;
          gap: var(--pd-sm);
          overflow: auto;
          scrollbar-width: none;
          -ms-overflow-style: none;

          &::-webkit-scrollbar {
            display: none;
          }
        }
      }
    }
  }
</style>
