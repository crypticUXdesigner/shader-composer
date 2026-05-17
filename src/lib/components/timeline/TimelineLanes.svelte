<script lang="ts">
  import type { Action } from 'svelte/action';
  import { Button, IconSvg, NodeIconSvg } from '../ui';
  import { getNodeIcon } from '../../../utils/nodeSpecUtils';
  import {
    getCategorySlug,
    isSystemInputNode,
    isStructuredPatternNode,
    isDerivedShapeNode,
    isWarpDistortNode,
    isFunctionsMathNode,
    isAdvancedMathNode,
    isStylizeEffectsNode,
    isSdfRaymarcherNode,
  } from '../../../utils/cssTokens';
  import type { NodeSpec } from '../../../types/nodeSpec';
  import type { TimelineLaneRowViewModel } from './timelineLaneViewModel';
  import { createStrictDoubleClickHandler } from '../../utils/strictDoubleClick';

  type RegionKey = { laneId: string; regionId: string };

  export type LaneViewModel = TimelineLaneRowViewModel;

  /** Mirrors DocsPanelItem / NodePanelItem subgroup classes for node-spec icon theming. */
  function laneHeaderIconVariantClasses(spec: NodeSpec): string {
    return [
      isSystemInputNode(spec.id, spec.category) ? 'system-input' : '',
      isStructuredPatternNode(spec.id, spec.category) ? 'structured' : '',
      isDerivedShapeNode(spec.id, spec.category) ? 'derived' : '',
      isWarpDistortNode(spec.id, spec.category) ? 'warp' : '',
      isFunctionsMathNode(spec.id, spec.category) ? 'functions' : '',
      isAdvancedMathNode(spec.id, spec.category) ? 'advanced' : '',
      isStylizeEffectsNode(spec.id, spec.category) ? 'stylize' : '',
      isSdfRaymarcherNode(spec.id, spec.category) ? 'raymarcher' : '',
    ]
      .filter(Boolean)
      .join(' ');
  }

  interface Props {
    laneVMs: LaneViewModel[];
    trackGridLines: number[];
    selectedRegion: RegionKey | null;
    regionDrag: {
      laneId: string;
      regionId: string;
      startTime: number;
      isDuplicate?: boolean;
      targetLaneId?: string;
    } | null;
    regionResize: { laneId: string; regionId: string; startTime: number; startDuration: number } | null;
    timeToX: (t: number) => number;

    showPlayhead: boolean;
    playheadDragging: boolean;
    playheadX: number;
    duration: number;
    currentTime: number;
    rulerSeekEnabled: boolean;

    onDeleteLane: (laneId: string) => void;
    onRegionMouseDown: (e: MouseEvent, laneId: string, regionId: string) => void;
    onRegionContextMenu: (e: MouseEvent, laneId: string, regionId: string) => void;
    onRegionDblClick?: (laneId: string, regionId: string) => void;
    onRegionResizeStart: (e: MouseEvent, laneId: string, regionId: string, edge: 'left' | 'right') => void;
    onPlayheadPointerDown: (e: PointerEvent) => void;
    onLaneRowPointerDown?: (e: PointerEvent, laneId: string) => void;
    onLaneRowDblClick?: (e: MouseEvent, laneId: string) => void;
    onLanesBackgroundSeekPointerDown?: (e: PointerEvent) => void;
    onRevealInNodeEditor?: (nodeId: string, paramName: string) => void;

    onTrackColumnEl?: (el: HTMLDivElement | null) => void;
    onLanesContainerEl?: (el: HTMLDivElement | null) => void;
    onPlayheadClipEl?: (el: HTMLDivElement | null) => void;

    /** When there are no lanes but the playhead is shown, reserve track height so the absolute playhead strip is visible. */
    playheadOnlyLayout?: boolean;
  }

  let {
    laneVMs,
    trackGridLines,
    selectedRegion,
    regionDrag,
    regionResize,
    timeToX,
    playheadOnlyLayout = false,
    showPlayhead,
    playheadDragging,
    playheadX,
    duration,
    currentTime,
    rulerSeekEnabled,
    onDeleteLane,
    onRegionMouseDown,
    onRegionContextMenu,
    onRegionDblClick,
    onRegionResizeStart,
    onPlayheadPointerDown,
    onLaneRowPointerDown,
    onLaneRowDblClick,
    onLanesBackgroundSeekPointerDown,
    onRevealInNodeEditor,
    onTrackColumnEl,
    onLanesContainerEl,
    onPlayheadClipEl,
  }: Props = $props();

  const trackStrictByLaneId = new Map<string, (e: MouseEvent) => void>();
  const regionStrictByKey = new Map<string, (e: MouseEvent) => void>();

  function strictTrackClick(laneId: string): (e: MouseEvent) => void {
    let handler = trackStrictByLaneId.get(laneId);
    if (!handler) {
      handler = createStrictDoubleClickHandler((e: MouseEvent) => onLaneRowDblClick?.(e, laneId));
      trackStrictByLaneId.set(laneId, handler);
    }
    return handler;
  }

  function strictRegionClick(laneId: string, regionId: string): (e: MouseEvent) => void {
    const key = `${laneId}:${regionId}`;
    let handler = regionStrictByKey.get(key);
    if (!handler) {
      handler = createStrictDoubleClickHandler((e: MouseEvent) => {
        e.stopPropagation();
        onRegionDblClick?.(laneId, regionId);
      });
      regionStrictByKey.set(key, handler);
    }
    return handler;
  }

  function handleLaneRevealClick(e: MouseEvent, nodeId: string, paramName: string): void {
    e.stopPropagation();
    onRevealInNodeEditor?.(nodeId, paramName);
  }

  const notifyDiv: Action<
    HTMLDivElement,
    ((el: HTMLDivElement | null) => void) | undefined
  > = (node, cb) => {
    cb?.(node);
    return {
      update(next) {
        next?.(node);
      },
    };
  };
</script>

<div class="timeline-shell">
  <div class="timeline-main">
    <div class="track-headers-col">
      {#each laneVMs as vm (vm.lane.id)}
        <div class="lane-header" data-lane-id={vm.lane.id}>
          <Button
            variant="ghost"
            size="sm"
            class="lane-label-button"
            title={`${vm.paramLabel} — ${vm.nodeLabel}. Reveal in node editor.`}
            disabled={!onRevealInNodeEditor}
            onclick={(e) => handleLaneRevealClick(e, vm.lane.nodeId, vm.lane.paramName)}
          >
            {#if vm.spec}
              <div
                class="lane-docs-icon {laneHeaderIconVariantClasses(vm.spec)}"
                data-category={getCategorySlug(vm.spec.category)}
                aria-hidden="true"
              >
                <NodeIconSvg identifier={getNodeIcon(vm.spec)} />
              </div>
            {/if}
            <span class="lane-label-text-col">
              <span class="lane-label-param-row">
                <span class="lane-label-param">{vm.paramLabel}</span>
              </span>
              <span class="lane-label-node">{vm.nodeLabel}</span>
            </span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            mode="icon-only"
            class="delete-lane-btn"
            title="Delete lane"
            onclick={(e: MouseEvent) => {
              e.stopPropagation();
              onDeleteLane(vm.lane.id);
            }}
          >
            <IconSvg name="circle-x" variant="filled" />
          </Button>
        </div>
      {/each}
    </div>

    <div use:notifyDiv={onTrackColumnEl} class="lanes-tracks-wrap">
      <div
      use:notifyDiv={onLanesContainerEl}
      class="lanes-inner"
      class:lanes-inner--playhead-only={playheadOnlyLayout}
      class:lanes-inner--seek-enabled={rulerSeekEnabled}
      title={rulerSeekEnabled ? 'Click or drag to seek' : undefined}
      onpointerdown={rulerSeekEnabled ? onLanesBackgroundSeekPointerDown : undefined}
    >
        {#each laneVMs as vm (vm.lane.id)}
          {@const duplicatePreviewLaneId =
            regionDrag?.isDuplicate
              ? (regionDrag.targetLaneId ?? regionDrag.laneId)
              : null}
          {@const isDuplicateDropTarget =
            duplicatePreviewLaneId !== null && duplicatePreviewLaneId === vm.lane.id}
          <div
            class="lane-row"
            class:lane-row--duplicate-target={isDuplicateDropTarget}
            data-lane-id={vm.lane.id}
            title={rulerSeekEnabled
              ? 'Click or drag to seek; double-click empty lane to add a region'
              : undefined}
            onpointerdown={rulerSeekEnabled
              ? (e: PointerEvent) => onLaneRowPointerDown?.(e, vm.lane.id)
              : undefined}
          >
            <div class="track-wrap">
              <div
                class="track"
                data-lane-id={vm.lane.id}
                role="button"
                tabindex={0}
                onclick={rulerSeekEnabled ? undefined : strictTrackClick(vm.lane.id)}
              >
                <div class="track-grid" aria-hidden="true">
                  {#each trackGridLines as x (x)}
                    <div class="track-grid-line" style="left: {x}px"></div>
                  {/each}
                </div>
                {#each vm.lane.regions as region (region.id)}
                  {@const isDuplicateDragging =
                    regionDrag?.isDuplicate === true &&
                    regionDrag.laneId === vm.lane.id &&
                    regionDrag.regionId === region.id}
                  {@const isDragging =
                    regionDrag?.laneId === vm.lane.id &&
                    regionDrag?.regionId === region.id &&
                    !isDuplicateDragging}
                  {@const isResizing = regionResize?.laneId === vm.lane.id && regionResize?.regionId === region.id}
                  {@const displayStart = isDragging ? regionDrag!.startTime : isResizing ? regionResize!.startTime : region.startTime}
                  {@const displayDuration = isResizing ? regionResize!.startDuration : region.duration}
                  {@const left = timeToX(displayStart)}
                  {@const right = timeToX(displayStart + displayDuration)}
                  {@const w = Math.max(2, right - left)}
                  <div
                    class="region-block"
                    data-lane-id={vm.lane.id}
                    data-region-id={region.id}
                    data-category={vm.categorySlug}
                    data-subgroup={vm.subGroupSlug || undefined}
                    class:is-selected={selectedRegion?.laneId === vm.lane.id && selectedRegion?.regionId === region.id}
                    style="left: {left}px; width: {w}px"
                    role="button"
                    tabindex={0}
                    onmousedown={(e: MouseEvent) => onRegionMouseDown(e, vm.lane.id, region.id)}
                    oncontextmenu={(e: MouseEvent) => onRegionContextMenu(e, vm.lane.id, region.id)}
                    onclick={strictRegionClick(vm.lane.id, region.id)}
                  >
                    <div
                      class="region-resize region-resize-left"
                      title="Resize left"
                      role="button"
                      aria-label="Resize left edge"
                      tabindex={0}
                      onmousedown={(e) => onRegionResizeStart(e, vm.lane.id, region.id, 'left')}
                    ></div>
                    <div
                      class="region-resize region-resize-right"
                      title="Resize right"
                      role="button"
                      aria-label="Resize right edge"
                      tabindex={0}
                      onmousedown={(e) => onRegionResizeStart(e, vm.lane.id, region.id, 'right')}
                    ></div>
                    <div class="region-title">
                      <span class="region-title-param">{vm.paramLabel}</span>
                      <span class="region-title-node">{vm.nodeLabel}</span>
                    </div>
                  </div>
                {/each}
                {#if regionDrag?.isDuplicate && isDuplicateDropTarget}
                  {@const srcLaneVm = laneVMs.find((v) => v.lane.id === regionDrag.laneId)}
                  {@const srcRegion = srcLaneVm?.lane.regions.find((r) => r.id === regionDrag.regionId)}
                  {#if srcRegion}
                    {@const ghostStart = regionDrag.startTime}
                    {@const ghostLeft = timeToX(ghostStart)}
                    {@const ghostRight = timeToX(ghostStart + srcRegion.duration)}
                    {@const ghostW = Math.max(2, ghostRight - ghostLeft)}
                    <div
                      class="region-block is-duplicate-preview"
                      data-category={vm.categorySlug}
                      data-subgroup={vm.subGroupSlug || undefined}
                      style="left: {ghostLeft}px; width: {ghostW}px"
                      aria-hidden="true"
                    >
                      <div class="region-title">
                        <span class="region-title-param">{vm.paramLabel}</span>
                        <span class="region-title-node">{vm.nodeLabel}</span>
                      </div>
                    </div>
                  {/if}
                {/if}
              </div>
            </div>
          </div>
        {/each}
        {#if showPlayhead}
          <div use:notifyDiv={onPlayheadClipEl} class="playhead-clip" aria-hidden="true">
            <div
              class="playhead-handle"
              class:is-dragging={playheadDragging}
              style="left: {playheadX - 6}px"
              role="slider"
              tabindex={rulerSeekEnabled ? 0 : -1}
              aria-label="Playhead position"
              aria-valuemin={0}
              aria-valuemax={duration}
              aria-valuenow={currentTime}
              title="Drag to scrub or set play position"
              onpointerdown={onPlayheadPointerDown}
            >
              <div class="playhead"></div>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .timeline-shell {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    min-height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .timeline-main {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: row;
    align-items: stretch;
    gap: 0;
  }

  .track-headers-col {
    flex-shrink: 0;
    width: var(--track-header-width);
    display: flex;
    flex-direction: column;
    gap: var(--pd-sm);
    padding: var(--pd-xs) 0 var(--pd-xs) var(--pd-xs);
    box-sizing: border-box;
  }

  .lane-header {
    display: flex;
    align-items: center;
    gap: var(--pd-xs);
    padding: 0 var(--pd-sm);
    min-height: var(--size-md);
  }

  :global(.lane-label-button.sm.ghost) {
    flex: 1;
    min-width: 0;
    justify-content: flex-start;
    gap: var(--pd-sm);
    padding: var(--pd-xs) var(--pd-xs);
    transition: background-color var(--motion-effects-fast-duration) var(--motion-effects-fast-easing);
  }

  /* Docs-style category icon box (compact for track headers); tokens match DocsPanelItem.icon-box. */
  .lane-docs-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-sizing: border-box;
    width: var(--size-sm);
    height: var(--size-sm);
    padding: var(--pd-xs);
    border-radius: var(--radius-sm);
    background: var(--node-icon-box-bg-default);
  }

  .lane-docs-icon :global(svg) {
    width: 100%;
    height: 100%;
    display: block;
    color: var(--node-icon-box-color-default, var(--color-gray-120));
  }

  /* Category backgrounds (aligned with DocsPanelItem .icon-box) */
  .lane-docs-icon[data-category='inputs'] { background: var(--node-icon-box-bg-inputs); }
  .lane-docs-icon.system-input[data-category='inputs'] { background: var(--node-icon-box-bg-inputs-system); }
  .lane-docs-icon[data-category='patterns'] { background: var(--node-icon-box-bg-patterns); }
  .lane-docs-icon.structured[data-category='patterns'] { background: var(--node-icon-box-bg-patterns-structured); }
  .lane-docs-icon[data-category='shapes'] { background: var(--node-icon-box-bg-shapes); }
  .lane-docs-icon.derived[data-category='shapes'] { background: var(--node-icon-box-bg-shapes-derived); }
  .lane-docs-icon[data-category='math'] { background: var(--node-icon-box-bg-math); }
  .lane-docs-icon.functions[data-category='math'] { background: var(--node-icon-box-bg-math-functions); }
  .lane-docs-icon.advanced[data-category='math'] { background: var(--node-icon-box-bg-math-advanced); }
  .lane-docs-icon[data-category='utilities'] { background: var(--node-icon-box-bg-utilities); }
  .lane-docs-icon[data-category='distort'] { background: var(--node-icon-box-bg-distort); }
  .lane-docs-icon.warp[data-category='distort'] { background: var(--node-icon-box-bg-distort-warp); }
  .lane-docs-icon[data-category='blend'] { background: var(--node-icon-box-bg-blend); }
  .lane-docs-icon[data-category='mask'] { background: var(--node-icon-box-bg-mask); }
  .lane-docs-icon[data-category='effects'] { background: var(--node-icon-box-bg-effects); }
  .lane-docs-icon.stylize[data-category='effects'] { background: var(--node-icon-box-bg-effects-stylize); }
  .lane-docs-icon[data-category='output'] { background: var(--node-icon-box-bg-output); }
  .lane-docs-icon[data-category='audio'] { background: var(--node-icon-box-bg-audio); }
  .lane-docs-icon[data-category='sdf'] { background: var(--node-icon-box-bg-sdf); }
  .lane-docs-icon.raymarcher[data-category='sdf'] {
    background: var(--node-icon-box-bg-sdf-raymarcher);
  }

  /* Category icon colors */
  .lane-docs-icon[data-category='inputs'] :global(svg) {
    color: var(--node-icon-box-color-inputs);
  }
  .lane-docs-icon.system-input[data-category='inputs'] :global(svg) {
    color: var(--node-icon-box-color-inputs-system);
  }
  .lane-docs-icon[data-category='patterns'] :global(svg) {
    color: var(--node-icon-box-color-patterns);
  }
  .lane-docs-icon.structured[data-category='patterns'] :global(svg) {
    color: var(--node-icon-box-color-patterns-structured);
  }
  .lane-docs-icon[data-category='shapes'] :global(svg) {
    color: var(--node-icon-box-color-shapes);
  }
  .lane-docs-icon.derived[data-category='shapes'] :global(svg) {
    color: var(--node-icon-box-color-shapes-derived);
  }
  .lane-docs-icon[data-category='math'] :global(svg) {
    color: var(--node-icon-box-color-math);
  }
  .lane-docs-icon.functions[data-category='math'] :global(svg) {
    color: var(--node-icon-box-color-math-functions);
  }
  .lane-docs-icon.advanced[data-category='math'] :global(svg) {
    color: var(--node-icon-box-color-math-advanced);
  }
  .lane-docs-icon[data-category='utilities'] :global(svg) {
    color: var(--node-icon-box-color-utilities);
  }
  .lane-docs-icon[data-category='distort'] :global(svg) {
    color: var(--node-icon-box-color-distort);
  }
  .lane-docs-icon.warp[data-category='distort'] :global(svg) {
    color: var(--node-icon-box-color-distort-warp);
  }
  .lane-docs-icon[data-category='blend'] :global(svg) {
    color: var(--node-icon-box-color-blend);
  }
  .lane-docs-icon[data-category='mask'] :global(svg) {
    color: var(--node-icon-box-color-mask);
  }
  .lane-docs-icon[data-category='effects'] :global(svg) {
    color: var(--node-icon-box-color-effects);
  }
  .lane-docs-icon.stylize[data-category='effects'] :global(svg) {
    color: var(--node-icon-box-color-effects-stylize);
  }
  .lane-docs-icon[data-category='output'] :global(svg) {
    color: var(--node-icon-box-color-output);
  }
  .lane-docs-icon[data-category='audio'] :global(svg) {
    color: var(--node-icon-box-color-audio);
  }
  .lane-docs-icon[data-category='sdf'] :global(svg) {
    color: var(--node-icon-box-color-sdf);
  }
  .lane-docs-icon.raymarcher[data-category='sdf'] :global(svg) {
    color: var(--node-icon-box-color-sdf-raymarcher, var(--node-icon-box-color-sdf));
  }

  .lane-label-text-col {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    line-height: 1.15;
  }

  .lane-label-param-row {
    display: flex;
    align-items: flex-start;
    text-align: left;
    gap: 4px;
    min-width: 0;
  }

  .lane-label-param {
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--print-highlight);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
  }

  :global(.lane-timeline-hint) {
    flex-shrink: 0;
    display: inline-flex;
    opacity: 0.75;
    color: var(--color-teal-110, var(--print-subtle));
  }

  :global(.lane-timeline-hint-icon) {
    width: 12px;
    height: 12px;
  }

  .lane-label-node {
    font-size: var(--text-2xs);
    font-weight: 500;
    color: var(--print-subtle);
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: color var(--motion-effects-fast-duration) var(--motion-effects-fast-easing);
  }

  :global(.lane-label-button:hover) .lane-label-node,
  :global(.lane-label-button:focus-visible) .lane-label-node {
    color: var(--print-highlight);
  }

  :global(.delete-lane-btn) {
    flex-shrink: 0;
  }

  .lanes-tracks-wrap {
    flex: 1;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    background: var(--frame-elevated-bg);
    border-radius: var(--radius-md) var(--radius-md) 0 0;
    overflow: hidden;
  }

  .lanes-inner {
    position: relative;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: var(--pd-sm);
    padding: var(--pd-sm);
  }

  .lanes-inner--playhead-only {
    /* Match lane row + track min-height so absolute playhead strip has non-zero height. */
    min-height: calc(var(--size-md) + var(--pd-sm) * 2);
  }

  .lane-row {
    display: flex;
    align-items: stretch;
    min-height: var(--size-md);
  }

  .lane-row--duplicate-target .track {
    outline: 1px dashed var(--color-gray-100);
    outline-offset: -1px;
  }

  .track-wrap {
    flex: 1;
    min-width: 0;
    width: 100%;
  }

  .track {
    position: relative;
    width: var(--timeline-track-width, 400px);
    min-height: var(--size-md);
    border-radius: var(--radius-xs);
    overflow: hidden;
    background: var(--color-gray-50);
  }

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
    transform: translateX(-50%) scaleX(0.5);
    transform-origin: center;
    background: var(--color-gray-70);
  }

  .region-block {
    position: absolute;
    top: var(--pd-2xs);
    bottom: var(--pd-2xs);
    z-index: 2;
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

  .region-block.is-duplicate-preview {
    z-index: 3;
    pointer-events: none;
    opacity: 0.55;
    outline: 2px dashed var(--color-gray-130);
    outline-offset: -2px;
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

  .region-title {
    position: absolute;
    inset: 0 var(--pd-2xs);
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    gap: 1px;
    pointer-events: none;
    overflow: hidden;
    padding: 0 2px;
  }

  .region-title-param {
    font-size: var(--text-2xs);
    font-weight: 600;
    color: rgba(255, 255, 255, 0.95);
    line-height: 1.1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  .region-title-node {
    font-size: var(--text-2xs);
    font-weight: 500;
    color: rgba(255, 255, 255, 0.72);
    line-height: 1.1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  .playhead-clip {
    position: absolute;
    top: 0;
    bottom: 0;
    left: var(--pd-xs);
    width: var(--timeline-track-width, 400px);
    overflow: hidden;
    pointer-events: none;
    z-index: 1;
  }

  .playhead-handle {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 12px;
    margin-left: -4px;
    /* Let lane double-click / seek pass through unless the user targets the handle. */
    pointer-events: none;
    cursor: col-resize;
    touch-action: none;
    z-index: 2;
    --timeline-playhead-bg: var(--print-highlight);
  }

  .playhead-handle:hover,
  .playhead-handle:focus-visible,
  .playhead-handle.is-dragging {
    pointer-events: auto;
  }

  .playhead-handle:hover {
    --timeline-playhead-bg: var(--color-teal-120);
  }

  .playhead-handle:active {
    --timeline-playhead-bg: var(--primary-bg-active);
  }

  .playhead-handle.is-dragging {
    cursor: grabbing;
    user-select: none;
    --timeline-playhead-bg: var(--primary-bg-active);
  }

  .playhead-handle .playhead {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 5px;
    width: 2px;
    margin-left: -1px;
    background: var(--timeline-playhead-bg, var(--print-light));
    pointer-events: none;
  }
</style>

