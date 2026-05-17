<script lang="ts">
  import { Button, IconSvg } from '../../ui';
  import FloatingPanel from '../../floating-panel/FloatingPanel.svelte';
  import {
    ARRANGEMENT_TRACK_FILTER_CLAMP_BOX,
    clampPanelCenterToViewport,
    getStoredPosition,
    setStoredPosition,
  } from '../../floating-panel/floatingPanelPosition';
  import type { AudioSetup } from '../../../../data-model/audioSetupTypes';
  import {
    type ArrangementTrackKind,
    ARRANGEMENT_NOTES_INTERACTIVE_PACK_LIMIT,
    ARRANGEMENT_NOTES_PERFORMANCE_WARN_COUNT,
    MAX_ARRANGEMENT_NOTES_PACKED,
    MAX_ARRANGEMENT_REGIONS,
  } from '../../../../audiotool/arrangement/types';
  import {
    arrangementTrackFilterButtonLabel,
    buildTrackFilterParams,
    listArrangementTracksForFilter,
    parseTrackFilterListOrdered,
    readSelectedTrackIds,
    wouldExceedArrangementBakeCap,
  } from '../../../../audiotool/arrangement/arrangementTrackFilter';
  import { packArrangementNotesForGlsl } from '../../../../shaders/arrangement/packArrangementNotesForGlsl';
  import {
    NOTE_COLOR_MODE,
    parseTrackNoteColors,
    projectOklchForTrack,
    serializeProjectTrackNoteColorsForTracks,
    serializeTrackNoteColors,
    type ParsedTrackNoteColors,
  } from '../../../../audiotool/arrangement/arrangementNoteColors';
  import { resolveVisibleTracks } from '../../../../shaders/arrangement/packArrangementRegionsForGlsl';
  import ColorPicker from './ColorPicker.svelte';
  import ColorPickerPopover from './ColorPickerPopover.svelte';
  import { appToastStore } from '../../../stores/appToastStore';

  interface Props {
    trackFilterMode: number;
    trackFilterList: string;
    audioSetup: AudioSetup;
    kinds?: ArrangementTrackKind[];
    hideEmpty?: boolean;
    showNoteCounts?: boolean;
    /** When set (Notes node), enables per-track color pickers in Custom mode. */
    noteColorMode?: number;
    trackNoteColors?: string;
    onTrackNoteColorsChange?: (trackNoteColors: string) => void;
    disabled?: boolean;
    /** Persist floating-panel position per node (`node.id`). */
    positionStorageVariant?: string;
    onFilterChange: (trackFilterMode: number, trackFilterList: string) => void;
    class?: string;
  }

  const PANEL_STORAGE_ID = 'arrangement-track-filter';
  const BAKE_LIMIT_TOAST_SOURCE = 'arrangement-track-filter-bake-limit';
  const BAKE_LIMIT_TOAST_MESSAGE = 'Would exceed limit';

  let {
    trackFilterMode,
    trackFilterList,
    audioSetup,
    kinds,
    hideEmpty = false,
    showNoteCounts = false,
    noteColorMode,
    trackNoteColors = '',
    onTrackNoteColorsChange,
    disabled = false,
    positionStorageVariant,
    onFilterChange,
    class: className = '',
  }: Props = $props();

  let panelOpen = $state(false);
  let panelX = $state(0);
  let panelY = $state(0);
  let triggerEl = $state<HTMLElement | null>(null);
  let sortListEl = $state<HTMLElement | null>(null);
  let dragFromTrackId = $state<string | null>(null);
  let dropInsertIndex = $state<number | null>(null);
  let trackColorPickerOpen = $state(false);
  let trackColorPickerX = $state(0);
  let trackColorPickerY = $state(0);
  let trackColorPickerValue = $state({ l: 0.65, c: 0.12, h: 240 });
  let trackColorPickerOnApply = $state<((l: number, c: number, h: number) => void) | null>(null);

  const kindSet = $derived(
    kinds === undefined ? undefined : new Set<ArrangementTrackKind>(kinds)
  );

  const rows = $derived(
    listArrangementTracksForFilter(audioSetup.arrangementSnapshot, {
      kinds: kindSet,
      hideEmpty,
      hideEmptyMetric: hideEmpty ? (showNoteCounts ? 'notes' : 'regions') : undefined,
    })
  );

  const allTrackIds = $derived(rows.map((r) => r.id));

  /** Persisted stacking order when `trackFilterMode === 1`; DAW row order otherwise. */
  const orderedSelectionIds = $derived.by((): string[] => {
    if (trackFilterMode !== 1) {
      return allTrackIds.slice();
    }
    const parsed = parseTrackFilterListOrdered(trackFilterList);
    const allowed = new Set(allTrackIds);
    return parsed.filter((id) => allowed.has(id));
  });

  const rowsById = $derived(new Map(rows.map((r) => [r.id, r] as const)));

  const selectedIds = $derived(readSelectedTrackIds(trackFilterMode, trackFilterList, allTrackIds));

  /** Not baked — click row to add at top of bake order. */
  const excludedRows = $derived(rows.filter((r) => !selectedIds.has(r.id)));

  const canReorderLanes = $derived(trackFilterMode === 1 && orderedSelectionIds.length >= 2);

  const buttonLabel = $derived(arrangementTrackFilterButtonLabel(rows, selectedIds));

  const panelTitle = $derived(showNoteCounts ? 'Note tracks' : 'Region tracks');

  /** Sum of notes (or regions) on selected tracks from the snapshot — not the GPU bake size. */
  const selectedItemsTotal = $derived.by(() => {
    let sum = 0;
    for (const row of rows) {
      if (!selectedIds.has(row.id)) continue;
      sum += showNoteCounts ? row.noteCount : row.regionCount;
    }
    return sum;
  });

  /**
   * Notes actually packed for preview (filter + 2048 cap + interactive subsample).
   * Matches {@link packArrangementNotesForGlsl}; null when not in note-count mode.
   */
  const previewBakeNoteCount = $derived.by((): number | null => {
    if (!showNoteCounts) return null;
    const snap = audioSetup.arrangementSnapshot;
    if (!snap) return null;
    return packArrangementNotesForGlsl(snap, {
      trackFilterMode,
      trackFilterList,
      trackLayout: 0,
      noteColorMode: 0,
      trackNoteColors: '',
    }).notes.length;
  });

  const showPreviewBakeHint = $derived(
    previewBakeNoteCount !== null &&
      previewBakeNoteCount < selectedItemsTotal
  );

  const totalUnit = $derived(showNoteCounts ? 'notes' : 'regions');

  /** GPU bake cap for the active mode (arrangement-notes vs arrangement-lanes packing). */
  const itemsBakeCap = $derived(
    showNoteCounts ? MAX_ARRANGEMENT_NOTES_PACKED : MAX_ARRANGEMENT_REGIONS
  );

  /** Near cap (warn) at 90%+ of bake limit; perf when Notes count is heavy for the shader; over when selection exceeds pack cap. */
  const bakeSummaryTone = $derived.by((): 'ok' | 'warn' | 'perf' | 'over' => {
    const n = selectedItemsTotal;
    const cap = itemsBakeCap;
    if (n > cap) return 'over';
    if (
      showNoteCounts &&
      (n >= ARRANGEMENT_NOTES_INTERACTIVE_PACK_LIMIT || n >= ARRANGEMENT_NOTES_PERFORMANCE_WARN_COUNT)
    ) {
      return 'perf';
    }
    if (cap > 0 && n >= cap * 0.9) return 'warn';
    return 'ok';
  });

  const summaryTitle = $derived(
    bakeSummaryTone === 'over'
      ? `Selected count exceeds the GPU bake limit (${itemsBakeCap.toLocaleString()} ${totalUnit}); extras are omitted in the shader.`
      : bakeSummaryTone === 'perf'
        ? selectedItemsTotal >= ARRANGEMENT_NOTES_INTERACTIVE_PACK_LIMIT
          ? `${selectedItemsTotal.toLocaleString()} notes on selected tracks; preview bakes ${previewBakeNoteCount?.toLocaleString() ?? 'fewer'} (subsampled above ~${ARRANGEMENT_NOTES_INTERACTIVE_PACK_LIMIT.toLocaleString()}). Per-frame scan is playhead-centered when the window is dense. Deselect tracks or shorten Window.`
          : `Above ~${ARRANGEMENT_NOTES_PERFORMANCE_WARN_COUNT.toLocaleString()} notes on selected tracks, preview compile and playback may be slow. When many notes overlap the timeline window, only a playhead-centered subset is drawn each frame. Deselect tracks or shorten Window.`
        : bakeSummaryTone === 'warn'
          ? `Close to the GPU bake limit (${itemsBakeCap.toLocaleString()} ${totalUnit}); some items may be omitted if you add more or widen the selection.`
          : 'In the imported arrangement, for the tracks currently included in this filter'
  );

  const noSnapshot = $derived(audioSetup.arrangementSnapshot === undefined);
  const controlDisabled = $derived(disabled || noSnapshot || rows.length === 0);

  const showTrackColorPickers = $derived(
    showNoteCounts &&
      noteColorMode === NOTE_COLOR_MODE.CUSTOM &&
      onTrackNoteColorsChange !== undefined
  );

  const parsedTrackColors = $derived(parseTrackNoteColors(trackNoteColors));

  const visibleNoteTracks = $derived.by(() => {
    const snap = audioSetup.arrangementSnapshot;
    if (!snap || !showTrackColorPickers) return [];
    const visible = resolveVisibleTracks(snap, {
      trackFilterMode,
      trackFilterList,
    });
    return visible.filter((t) => t.kind === 'note');
  });

  function trackColorForId(trackId: string): { l: number; c: number; h: number } {
    const custom = parsedTrackColors.get(trackId);
    if (custom) return custom;
    const track = visibleNoteTracks.find((t) => t.id === trackId);
    if (track) return projectOklchForTrack(track, visibleNoteTracks);
    return { l: 0.65, c: 0.12, h: 240 };
  }

  function persistTrackColors(next: ParsedTrackNoteColors) {
    onTrackNoteColorsChange?.(serializeTrackNoteColors(next));
  }

  function setTrackColor(trackId: string, l: number, c: number, h: number) {
    const next = new Map(parsedTrackColors);
    next.set(trackId, { l, c, h });
    persistTrackColors(next);
  }

  function openTrackColorPicker(
    initial: { l: number; c: number; h: number },
    screenX: number,
    screenY: number,
    onApply: (l: number, c: number, h: number) => void
  ) {
    trackColorPickerValue = initial;
    trackColorPickerX = screenX;
    trackColorPickerY = screenY;
    trackColorPickerOnApply = onApply;
    trackColorPickerOpen = true;
  }

  function closeTrackColorPicker() {
    trackColorPickerOpen = false;
    trackColorPickerOnApply = null;
  }

  function resetTrackColorsFromProject() {
    if (visibleNoteTracks.length === 0) return;
    onTrackNoteColorsChange?.(serializeProjectTrackNoteColorsForTracks(visibleNoteTracks));
  }

  function triggerCenter(): { x: number; y: number } {
    if (!triggerEl) {
      if (typeof window === 'undefined') return { x: 0, y: 0 };
      return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    }
    const r = triggerEl.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function openPanelFromTriggerOrStorage() {
    const fallback = triggerCenter();
    const stored = getStoredPosition(PANEL_STORAGE_ID, {
      variant: positionStorageVariant,
      fallback,
    });
    const box = ARRANGEMENT_TRACK_FILTER_CLAMP_BOX;
    const clamped = clampPanelCenterToViewport(stored, box.width, box.height);
    panelX = clamped.x;
    panelY = clamped.y;
  }

  function togglePanel() {
    if (controlDisabled) return;
    if (!panelOpen) {
      openPanelFromTriggerOrStorage();
    }
    panelOpen = !panelOpen;
  }

  function handlePanelMove(x: number, y: number) {
    panelX = x;
    panelY = y;
    setStoredPosition(PANEL_STORAGE_ID, x, y, positionStorageVariant);
  }

  function persistSelectionOrder(nextOrdered: string[]) {
    const params = buildTrackFilterParams(nextOrdered, allTrackIds);
    onFilterChange(params.trackFilterMode, params.trackFilterList);
  }

  function trackItemCount(row: { noteCount: number; regionCount: number }): number {
    return showNoteCounts ? row.noteCount : row.regionCount;
  }

  function addTrackToBake(trackId: string) {
    if (selectedIds.has(trackId)) return;
    const row = rowsById.get(trackId);
    if (
      row &&
      wouldExceedArrangementBakeCap(
        selectedItemsTotal,
        trackItemCount(row),
        itemsBakeCap
      )
    ) {
      appToastStore.addToast({
        variant: 'info',
        message: BAKE_LIMIT_TOAST_MESSAGE,
        source: BAKE_LIMIT_TOAST_SOURCE,
      });
      return;
    }
    persistSelectionOrder([trackId, ...orderedSelectionIds]);
  }

  function removeFromBake(trackId: string) {
    persistSelectionOrder(orderedSelectionIds.filter((id) => id !== trackId));
  }

  function clearAll() {
    persistSelectionOrder([]);
  }

  function closePanel() {
    panelOpen = false;
  }

  function dropIndexFromPointer(listEl: HTMLElement, clientY: number): number {
    const rowEls = [...listEl.querySelectorAll<HTMLElement>('[data-track-id]')];
    for (let i = 0; i < rowEls.length; i++) {
      const rect = rowEls[i]!.getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) return i;
    }
    return rowEls.length;
  }

  function reorderIdsByIndex(ids: string[], fromIndex: number, toIndex: number): string[] {
    if (fromIndex < 0 || fromIndex >= ids.length || toIndex < 0 || toIndex > ids.length) {
      return ids;
    }
    if (fromIndex === toIndex || (fromIndex + 1 === toIndex && toIndex === ids.length)) {
      return ids;
    }
    const next = [...ids];
    const [item] = next.splice(fromIndex, 1);
    const insertAt = toIndex > fromIndex ? toIndex - 1 : toIndex;
    next.splice(insertAt, 0, item!);
    return next;
  }

  function isSortDragExcludedTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    return Boolean(
      target.closest('.track-trail, .track-color-picker-wrap, button, a, input, label')
    );
  }

  function startSortDrag(trackId: string, e: PointerEvent) {
    if (!canReorderLanes || !sortListEl) return;
    if (isSortDragExcludedTarget(e.target)) return;
    e.preventDefault();
    e.stopPropagation();

    const fromIndex = orderedSelectionIds.indexOf(trackId);
    if (fromIndex < 0) return;

    dragFromTrackId = trackId;

    const onMove = (ev: PointerEvent) => {
      if (!sortListEl) return;
      dropInsertIndex = dropIndexFromPointer(sortListEl, ev.clientY);
    };

    const onEnd = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);

      if (dragFromTrackId !== null && dropInsertIndex !== null) {
        const next = reorderIdsByIndex(orderedSelectionIds, fromIndex, dropInsertIndex);
        if (JSON.stringify(next) !== JSON.stringify(orderedSelectionIds)) {
          persistSelectionOrder(next);
        }
      }

      dragFromTrackId = null;
      dropInsertIndex = null;
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
    onMove(e);
  }
</script>

<div bind:this={triggerEl} class="arrangement-track-filter {className}">
  <Button
    variant="secondary"
    size="md"
    mode="label-only"
    disabled={controlDisabled}
    onclick={togglePanel}
    aria-haspopup="dialog"
    aria-expanded={panelOpen}
    title={noSnapshot ? 'Import arrangement from the audio panel first' : undefined}
  >
    <span class="label">{noSnapshot ? 'No arrangement' : buttonLabel}</span>
  </Button>
</div>

<FloatingPanel
  open={panelOpen}
  x={panelX}
  y={panelY}
  triggerElement={triggerEl}
  onClose={() => {
    panelOpen = false;
  }}
  onPositionChange={handlePanelMove}
  ariaLabel="Arrangement track filter"
  dragSurface="grip-only"
  mainOverflow="hidden"
  class="arrangement-track-filter-panel"
>
  {#snippet headerLeft()}
    <span class="panel-title">{panelTitle}</span>
  {/snippet}

  {#snippet children()}
    <div class="track-filter-menu">
      {#if rows.length > 0}
        <div
          class="track-filter-summary"
          class:is-perf={bakeSummaryTone === 'perf'}
          class:is-warn={bakeSummaryTone === 'warn'}
          class:is-over={bakeSummaryTone === 'over'}
          aria-live="polite"
          title={summaryTitle}
        >
          <span class="current-count">{selectedItemsTotal.toLocaleString()}</span>
          <span class="summary-rest">
            <span class="slash" aria-hidden="true">/</span>
            <span class="bake-cap">{itemsBakeCap.toLocaleString()}</span>
            {` ${totalUnit} selected`}
          </span>
          {#if showPreviewBakeHint && previewBakeNoteCount !== null}
            <span class="preview-bake-hint">
              · {previewBakeNoteCount.toLocaleString()} in preview
            </span>
          {/if}
        </div>
      {/if}
      <div class="track-filter-scroll scrollbar-styled frame-elevated">
        <section class="track-section" aria-label="Sort">
          <div class="track-section-head">
            <span class="track-section-title">Sort</span>
            {#if showTrackColorPickers}
              <Button
                variant="secondary"
                size="sm"
                class="track-colors-reset-btn"
                onclick={resetTrackColorsFromProject}
              >
                From project
              </Button>
            {/if}
          </div>

          {#if orderedSelectionIds.length === 0}
            <div class="track-empty" id="included-empty-hint">No tracks selected.</div>
          {:else}
            <div
              bind:this={sortListEl}
              class="track-sort-list"
              class:is-sort-dragging={dragFromTrackId !== null}
              role="list"
            >
            {#each orderedSelectionIds as trackId, stackIdx (trackId)}
              {@const row = rowsById.get(trackId)}
              {#if row}
                <div
                  class="track-grid track-row"
                  class:has-track-colors={showTrackColorPickers}
                  class:is-sortable={canReorderLanes}
                  class:is-dragging={dragFromTrackId === trackId}
                  class:is-drop-before={dropInsertIndex === stackIdx &&
                    dragFromTrackId !== null &&
                    dragFromTrackId !== trackId}
                  data-track-id={trackId}
                  role="listitem"
                  aria-label="Position {stackIdx + 1}, {row.label}"
                  title={canReorderLanes ? 'Drag to reorder' : undefined}
                  onpointerdown={(e) => startSortDrag(trackId, e)}
                >
                  <div class="track-lead">
                    {#if canReorderLanes}
                      <span class="track-drag-handle" aria-hidden="true">
                        <IconSvg name="grip-vertical" variant="line" />
                      </span>
                    {/if}
                  </div>
                  <span class="track-name">{row.label}</span>
                  <div class="track-trail">
                    {#if showTrackColorPickers}
                      {@const trackColor = trackColorForId(trackId)}
                      <div
                        class="track-color-picker-wrap"
                        role="presentation"
                        onclick={(e) => e.stopPropagation()}
                        onpointerdown={(e) => e.stopPropagation()}
                      >
                        <ColorPicker
                          class="track-color-picker"
                          variant="compact"
                          color={trackColor}
                          onClick={(sx, sy) =>
                            openTrackColorPicker(trackColor, sx, sy, (l, c, h) =>
                              setTrackColor(trackId, l, c, h)
                            )}
                        />
                      </div>
                    {/if}
                    <Button
                      variant="ghost"
                      size="sm"
                      mode="icon-only"
                      class="track-remove-btn"
                      title="Remove"
                      aria-label={`Remove ${row.label}`}
                      onclick={() => removeFromBake(trackId)}
                    >
                      <IconSvg name="trash" variant="line" />
                    </Button>
                  </div>
                </div>
              {:else}
                <div
                  class="track-grid track-row is-stale"
                  data-track-id={trackId}
                  role="listitem"
                >
                  <div class="track-lead" aria-hidden="true"></div>
                  <span class="stale-track-id">{trackId}</span>
                  <div class="track-trail">
                    <Button
                      variant="ghost"
                      size="sm"
                      mode="icon-only"
                      class="track-remove-btn"
                      title="Remove"
                      aria-label={`Remove stale id ${trackId}`}
                      onclick={() => removeFromBake(trackId)}
                    >
                      <IconSvg name="trash" variant="line" />
                    </Button>
                  </div>
                </div>
              {/if}
            {/each}
            </div>
          {/if}
        </section>

        {#if excludedRows.length > 0}
          <div class="track-section-divider" role="presentation"></div>
          <section class="track-section" aria-labelledby="pool-heading">
            <div class="track-section-head">
              <span id="pool-heading" class="track-section-title">Select</span>
              <span class="track-section-badge">{excludedRows.length}</span>
            </div>
            {#each excludedRows as row (row.id)}
              <div
                class="track-grid track-row track-pool-row"
                role="button"
                tabindex="0"
                title={`Add ${row.label}`}
                aria-label={`Add ${row.label}`}
                onclick={() => addTrackToBake(row.id)}
                onkeydown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    addTrackToBake(row.id);
                  }
                }}
              >
                <div class="track-lead" aria-hidden="true">
                  <span class="track-add-icon">
                    <IconSvg name="plus" variant="line" />
                  </span>
                </div>
                <span class="track-name">{row.label}</span>
                <div class="track-trail" aria-hidden="true">
                  {#if showNoteCounts && row.noteCount > 0}
                    <span class="track-count">{row.noteCount}</span>
                  {:else if !showNoteCounts && row.regionCount > 0}
                    <span class="track-count">{row.regionCount}</span>
                  {/if}
                </div>
              </div>
            {/each}
          </section>
        {/if}
      </div>
    </div>
  {/snippet}

  {#snippet footer()}
    <div class="track-filter-actions">
      <Button
        variant="ghost"
        size="sm"
        mode="label-only"
        disabled={selectedIds.size === 0}
        onclick={clearAll}
      >
        Clear
      </Button>
      <Button variant="primary" size="sm" mode="label-only" onclick={closePanel}>
        Done
      </Button>
    </div>
  {/snippet}
</FloatingPanel>

<ColorPickerPopover
  visible={trackColorPickerOpen}
  x={trackColorPickerX}
  y={trackColorPickerY}
  value={trackColorPickerValue}
  onChange={(l, c, h) => {
    trackColorPickerValue = { l, c, h };
    trackColorPickerOnApply?.(l, c, h);
  }}
  onClose={closeTrackColorPicker}
/>

<style>
  /* Narrow floating shell + single scroll region inside FloatingPanel `.main`. */
  :global(.popover-base.frame.floating-panel.arrangement-track-filter-panel) {
    width: auto;
    min-width: 320px;
    max-width: 380px;
    max-height: min(520px, 85vh);
  }

  .panel-title {
    font-size: var(--text-sm);
    font-weight: 500;
    line-height: 1;
    color: var(--color-blue-100);
    letter-spacing: 0;
  }

  .arrangement-track-filter {
    display: flex;
    min-width: 120px;
    max-width: 220px;
    width: fit-content;

    &.in-cell {
      width: fit-content;
      max-width: 11rem;
      flex: 0 0 auto;
    }

    :global(.button) {
      flex: 1;
      min-width: 0;
      justify-content: flex-start;
    }

    &.in-cell :global(.button) {
      flex: 0 1 auto;
      max-width: 11rem;
    }

    .label {
      min-width: 0;
      text-align: left;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  :global(.floating-panel.arrangement-track-filter-panel) .track-filter-menu {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-width: 320px;
    max-width: 380px;
    min-height: 0;
    overflow: hidden;
  }

  :global(.floating-panel.arrangement-track-filter-panel) .track-filter-summary {
    flex-shrink: 0;
    padding: var(--pd-xs) var(--pd-md) var(--pd-xs) var(--pd-sm);
    font-size: var(--text-xs);
    color: var(--search-result-desc-color);
    font-variant-numeric: tabular-nums;
    text-align: center;

    .current-count {
      font-weight: 600;
      color: var(--print-highlight);
    }

    .summary-rest {
      font-weight: 400;
    }

    .preview-bake-hint {
      font-weight: 400;
      color: var(--search-result-desc-color);
    }

    .slash {
      margin: 0 0.12em;
      color: var(--print-subtle);
    }

    &.is-perf .current-count,
    &.is-warn .current-count {
      color: var(--color-orange-100);
    }

    &.is-over .current-count {
      color: var(--color-red-100);
    }
  }

  :global(.floating-panel.arrangement-track-filter-panel) .track-filter-scroll {
    overflow-y: auto;
    flex: 1;
    min-height: 0;
    margin: 0;
    padding: var(--frame-elevated-pd);
    box-sizing: border-box;
  }

  .track-section {
    padding: 0;

    .track-section-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--pd-sm);
      margin-bottom: var(--pd-xs);

      :global(.track-colors-reset-btn.button) {
        flex-shrink: 0;
        font-size: var(--text-xs);
      }

      .track-section-title {
        font-size: var(--text-xs);
        font-weight: 600;
        color: var(--print-highlight);
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }

      .track-section-badge {
        font-size: var(--text-xs);
        font-variant-numeric: tabular-nums;
        color: var(--print-subtle);
      }
    }

    .track-empty {
      font-size: var(--text-sm);
      color: var(--print-subtle);
      padding: var(--pd-xs) var(--pd-md) var(--pd-sm) var(--pd-sm);
    }
  }

  .track-section-divider {
    height: 1px;
    margin: var(--pd-sm) 0;
    background: var(--color-gray-100);
  }

  .track-section > .track-grid + .track-grid {
    margin-top: var(--pd-2xs);
  }

  .track-sort-list {
    display: flex;
    flex-direction: column;
    gap: var(--pd-2xs);
  }

  .track-grid {
    --track-lead-col: 1.75rem;
    --track-trail-col: 1.75rem;

    &.has-track-colors {
      --track-trail-col: 3.5rem;
    }

    display: grid;
    grid-template-columns: var(--track-lead-col) minmax(0, 1fr) var(--track-trail-col);
    column-gap: var(--pd-sm);
    align-items: center;
    box-sizing: border-box;
    min-height: var(--size-md);
    padding: var(--pd-sm) var(--pd-md) var(--pd-sm) var(--pd-sm);
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    background: var(--ghost-bg);
    color: var(--print-highlight);
    transition:
      background var(--motion-effects-fast-duration) var(--motion-effects-fast-easing),
      border-color var(--motion-effects-fast-duration) var(--motion-effects-fast-easing),
      color var(--motion-effects-fast-duration) var(--motion-effects-fast-easing);

    &:hover {
      background: var(--ghost-bg-hover);
      border-color: var(--panel-card-border-hover);
      color: var(--print-light);

      .track-name {
        color: var(--print-light);
      }
    }

    &:focus-within {
      background: var(--ghost-bg-hover);
      border-color: var(--panel-card-border-hover);
      color: var(--print-light);

      .track-name {
        color: var(--print-light);
      }
    }

    &:active {
      background: var(--ghost-bg-active);
      border-color: var(--panel-card-border-active);
      color: var(--color-blue-110);

      .track-name {
        color: var(--color-blue-110);
      }
    }

    &.is-stale {
      border-left: 2px solid var(--color-orange-100);
      padding-left: calc(var(--pd-sm) - 1px);
    }

    .track-lead {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: var(--size-sm);
    }

    .track-name {
      min-width: 0;
      font-size: var(--text-sm);
      font-weight: 400;
      color: inherit;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .stale-track-id {
      min-width: 0;
      font-size: var(--text-xs);
      font-family: ui-monospace, monospace;
      color: var(--color-orange-100);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .track-trail {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: var(--pd-2xs);
      min-height: var(--size-sm);
    }

    .track-color-picker-wrap {
      display: flex;
      flex-shrink: 0;
      align-items: center;
    }

    .track-count {
      font-size: var(--text-xs);
      color: var(--search-result-desc-color);
      font-variant-numeric: tabular-nums;
    }

  }

  .track-sort-list.is-sort-dragging {
    user-select: none;

    .track-row:not(.is-dragging) {
      pointer-events: none;
    }

    .track-row:not(.is-dragging):hover,
    .track-row:not(.is-dragging):focus-within,
    .track-row:not(.is-dragging):active {
      background: var(--ghost-bg);
      border-color: transparent;
      color: var(--print-highlight);

      .track-name {
        color: inherit;
      }
    }
  }

  .track-row {
    position: relative;

    &.is-sortable {
      cursor: grab;
      touch-action: none;
    }

    &.is-dragging {
      opacity: var(--opacity-disabled, 0.45);
      border-color: var(--panel-card-border-active);
    }

    &.is-drop-before::before {
      content: '';
      position: absolute;
      top: 0;
      right: var(--pd-md);
      left: calc(var(--pd-sm) + var(--track-lead-col) + var(--pd-sm));
      height: 2px;
      background: var(--color-teal-light-110, currentColor);
      border-radius: 1px;
      pointer-events: none;
    }
  }

  .track-sort-list.is-sort-dragging .track-row.is-sortable {
    cursor: grabbing;
  }

  .track-drag-handle {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--print-subtle);
    line-height: 0;
    pointer-events: none;
  }

  .track-row:hover .track-drag-handle,
  .track-row:focus-within .track-drag-handle {
    color: currentColor;
  }

  .track-sort-list.is-sort-dragging .track-row:not(.is-dragging):hover .track-drag-handle {
    color: var(--print-subtle);
  }

  .track-drag-handle :global(.icon-svg svg),
  .track-add-icon :global(.icon-svg svg) {
    min-width: 14px;
    min-height: 14px;
    width: 0.875em;
    height: 0.875em;
  }

  .track-add-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--print-subtle);
    line-height: 0;
    pointer-events: none;
  }

  .track-pool-row:hover .track-add-icon,
  .track-pool-row:focus-visible .track-add-icon {
    color: currentColor;
  }

  .track-pool-row:focus-visible {
    outline: 2px solid var(--color-teal-light-110, currentColor);
    outline-offset: 2px;
  }

  .track-grid :global(.track-remove-btn.button.sm.icon-only) {
    flex-shrink: 0;
  }

  :global(.floating-panel.arrangement-track-filter-panel) .track-filter-actions {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--pd-md);
    width: 100%;
    padding: var(--pd-md) var(--pd-md) var(--pd-md) var(--pd-sm);
  }
</style>
