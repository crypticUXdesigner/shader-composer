<script lang="ts">
  /**
   * Single draggable node card in the node panel (list or grid).
   * Used only inside NodePanelResults / NodePanelContent.
   */
  import { NodeIconSvg } from '../ui';
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
    isShinyNode,
    PANEL_GRID_SPAN_2_NODE_IDS,
  } from '../../../utils/cssTokens';
  import type { NodeSpec } from '../../../types/nodeSpec';

  type DisplayMode = 'list' | 'grid';

  interface Props {
    spec: NodeSpec;
    displayMode?: DisplayMode;
    onDragStart?: (e: DragEvent, nodeType: string) => void;
    onDragEnd?: (e: DragEvent) => void;
  }

  let { spec, displayMode = 'grid', onDragStart, onDragEnd }: Props = $props();

  const categorySlug = $derived(getCategorySlug(spec.category));
  const isShiny = $derived(isShinyNode(spec.id, spec.category));
  const variantClasses = $derived(
    [
      isSystemInputNode(spec.id, spec.category) ? 'system-input' : '',
      isStructuredPatternNode(spec.id, spec.category) ? 'structured' : '',
      isDerivedShapeNode(spec.id, spec.category) ? 'derived' : '',
      isWarpDistortNode(spec.id, spec.category) ? 'warp' : '',
      isFunctionsMathNode(spec.id, spec.category) ? 'functions' : '',
      isAdvancedMathNode(spec.id, spec.category) ? 'advanced' : '',
      isStylizeEffectsNode(spec.id, spec.category) ? 'stylize' : '',
      isSdfRaymarcherNode(spec.id, spec.category) ? 'raymarcher' : '',
      isShiny ? 'shiny' : '',
    ]
      .filter(Boolean)
      .join(' ')
  );
  const gridSpan = $derived(PANEL_GRID_SPAN_2_NODE_IDS.has(spec.id) ? 2 : undefined);

  /** Clone used as custom drag image so box-shadow isn't clipped by panel overflow. */
  let dragImageEl: HTMLElement | null = null;

  function handleDragStart(e: DragEvent) {
    const el = e.currentTarget as HTMLElement;
    el?.classList.add('is-dragging');

    if (e.dataTransfer && el) {
      const clone = el.cloneNode(true) as HTMLElement;
      clone.classList.add('node-panel-item-drag-image');
      clone.style.position = 'fixed';
      clone.style.left = '-9999px';
      clone.style.top = '0';
      clone.style.width = `${el.offsetWidth}px`;
      clone.style.overflow = 'visible';
      document.body.appendChild(clone);
      dragImageEl = clone;
      void clone.offsetHeight; /* force reflow so clone is styled before capture */
      const rect = el.getBoundingClientRect();
      e.dataTransfer.setDragImage(clone, rect.width / 2, rect.height / 2);
    }

    onDragStart?.(e, spec.id);
  }

  function handleDragEnd(e: DragEvent) {
    (e.currentTarget as HTMLElement)?.classList.remove('is-dragging');
    if (dragImageEl?.parentNode) {
      dragImageEl.parentNode.removeChild(dragImageEl);
      dragImageEl = null;
    }
    onDragEnd?.(e);
  }
</script>

<div
  class="item node-panel-item {variantClasses}"
  role="button"
  tabindex="0"
  data-category={categorySlug}
  data-highlight={isShiny ? 'shiny' : undefined}
  data-display-mode={displayMode}
  data-node-type={spec.id}
  data-panel-grid-span={gridSpan}
  draggable="true"
  ondragstart={handleDragStart}
  ondragend={handleDragEnd}
>
  <div class="icon-box" data-category={categorySlug}>
    <NodeIconSvg identifier={getNodeIcon(spec)} />
  </div>
  {#if spec.inputs.length > 0}
    <div class="input-types">
      {#each spec.inputs as input}
        <span class="tag xs" data-type={input.type}>{input.type}</span>
      {/each}
    </div>
  {/if}
  {#if spec.outputs.length > 0}
    <div class="output-types">
      {#each spec.outputs as output}
        <span class="tag xs" data-type={output.type}>{output.type}</span>
      {/each}
    </div>
  {/if}
  <div class="content">
    <div class="title">{spec.displayName}</div>
    <div class="types-row">
      {#if spec.inputs.length > 0}
        <div class="input-types list-types">
          {#each spec.inputs as input}
            <span class="tag xs" data-type={input.type}>{input.type}</span>
          {/each}
        </div>
      {/if}
      {#if spec.outputs.length > 0}
        <div class="output-types list-types">
          {#each spec.outputs as output}
            <span class="tag xs" data-type={output.type}>{output.type}</span>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  /* List mode: horizontal row */
  .node-panel-item[data-display-mode="list"] {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: var(--pd-md);
    padding: var(--pd-sm);
    border: 1px solid transparent;
    border-radius: calc(var(--radius-lg) + var(--pd-sm));
    background: var(--color-gray-30);
    cursor: grab;
    transition: background 0.15s, border-color 0.15s, transform 0.15s;
  }

  .node-panel-item[data-display-mode="list"]:hover {
    border-color: rgba(255, 255, 255, 0.12);
    transform: translateX(var(--pd-2xs));
    background: var(--color-gray-40);
  }

  .node-panel-item[data-display-mode="list"].is-dragging {
    opacity: var(--opacity-disabled);
    cursor: grabbing;
  }

  .node-panel-item[data-display-mode="list"] .input-types:not(.list-types),
  .node-panel-item[data-display-mode="list"] .output-types:not(.list-types) {
    display: none;
  }

  .node-panel-item[data-display-mode="list"] .content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--pd-sm);
  }

  .node-panel-item[data-display-mode="list"] .title {
    margin-bottom: 0;
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--node-header-print-default);
  }

  .node-panel-item[data-display-mode="list"] .types-row {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: var(--pd-sm);
  }

  .node-panel-item[data-display-mode="list"] .input-types.list-types,
  .node-panel-item[data-display-mode="list"] .output-types.list-types {
    display: flex;
    flex-direction: row;
    gap: var(--pd-xs);
    align-items: center;
  }

  .node-panel-item[data-display-mode="list"] .input-types.list-types .tag,
  .node-panel-item[data-display-mode="list"] .output-types.list-types .tag {
    pointer-events: none;
  }

  .node-panel-item[data-display-mode="list"] .output-types.list-types {
    margin-left: auto;
  }

  /* Grid mode: card */
  .node-panel-item[data-display-mode="grid"] {
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
    gap: var(--pd-sm);
    min-height: fit-content;
    height: auto;
    text-align: center;
    box-sizing: border-box;
    box-shadow: 0 0 0 2px transparent;
    padding: var(--pd-md) var(--pd-sm);
    padding-bottom: var(--pd-sm);
    border-radius: var(--radius-lg);
    overflow: hidden;
    background: radial-gradient(
      ellipse 200% 150% at 50% 15%,
      var(--node-header-bg-default, var(--color-gray-70)),
      var(--node-header-bg-end-default, var(--color-gray-50))
    );
    cursor: grab;
    transition: box-shadow 0.15s, transform 0.15s;
    border: 2px solid var(--color-gray-50);

    &:hover {
      box-shadow: 0 0 0 2px var(--color-teal-light-110);
      transform: translateY(calc(-1 * var(--pd-2xs))) scale(1.05);
    }

    &.is-dragging {
      opacity: var(--opacity-disabled);
      cursor: grabbing;
    }

    &.shiny {
      border-color: var(--panel-node-shiny-ring-color);
      box-shadow:
        0 0 0 var(--panel-node-shiny-ring-width) var(--panel-node-shiny-ring-color),
        0 0 var(--panel-node-shiny-glow-radius) var(--panel-node-shiny-glow-color);
    }
  }

  /* Custom drag preview (clone is in document.body). :global so the class we add in JS matches. */
  :global(.node-panel-item-drag-image) {
    border: 2px solid var(--color-teal-light-110);
    box-shadow: 0 0 0 2px var(--color-teal-light-110);
    transform: scale(0.7);
  }

  .node-panel-item[data-display-mode="grid"] .input-types:not(.list-types),
  .node-panel-item[data-display-mode="grid"] .output-types:not(.list-types) {
    position: absolute;
    top: var(--pd-xs);
    display: flex;
    flex-direction: column;
    gap: var(--pd-2xs);
    z-index: 2;
  }

  .node-panel-item[data-display-mode="grid"] .input-types:not(.list-types) {
    left: var(--pd-xs);
  }

  .node-panel-item[data-display-mode="grid"] .output-types:not(.list-types) {
    right: var(--pd-xs);
  }

  .node-panel-item[data-display-mode="grid"] .input-types:not(.list-types) .tag,
  .node-panel-item[data-display-mode="grid"] .output-types:not(.list-types) .tag {
    pointer-events: none;
    width: var(--size-2xs);
    height: var(--size-2xs);
    max-width: var(--size-2xs);
    max-height: var(--size-2xs);
    border-width: 2px;
    font-size: 0;
    line-height: 0;
    padding: 0;
  }

  .node-panel-item[data-display-mode="grid"] .input-types.list-types,
  .node-panel-item[data-display-mode="grid"] .output-types.list-types,
  .node-panel-item[data-display-mode="grid"] .types-row {
    display: none;
  }

  .node-panel-item[data-display-mode="grid"] .content {
    position: relative;
    width: 100%;
    z-index: 1;
  }

  .node-panel-item[data-display-mode="grid"] .title {
    margin-bottom: var(--pd-2xs);
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--node-header-print-default);
    word-break: break-word;
  }

  /* Type tag styling (list and grid) */
  .node-panel-item .tag.xs {
    padding: var(--pd-2xs) var(--pd-xs);
    border-radius: var(--radius-sm);
    background: rgba(255, 255, 255, 0.05);
    font-size: var(--text-xs);
    color: var(--color-gray-100);
  }

  .node-panel-item .tag[data-type="float"] {
    --tag-bg: var(--color-gray-80);
    --tag-border: var(--color-gray-30);
    --tag-color: var(--color-gray-130);
  }

  .node-panel-item .tag[data-type="vec2"] {
    --tag-bg: var(--color-blue-gray-80);
    --tag-border: var(--color-blue-gray-30);
    --tag-color: var(--color-blue-gray-130);
  }

  .node-panel-item .tag[data-type="vec3"] {
    --tag-bg: var(--color-teal-gray-80);
    --tag-border: var(--color-teal-gray-30);
    --tag-color: var(--color-teal-gray-130);
  }

  .node-panel-item .tag[data-type="vec4"] {
    --tag-bg: var(--color-purple-gray-80);
    --tag-border: var(--color-purple-gray-30);
    --tag-color: var(--color-purple-gray-130);
  }

  /* Icon box — list: larger; grid: smaller with shadow */
  .node-panel-item[data-display-mode="list"] .icon-box {
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    flex-shrink: 0;
    z-index: 1;
    width: var(--size-lg);
    height: var(--size-lg);
    padding: var(--pd-md);
    border-radius: var(--radius-lg);
    background: var(--node-icon-box-bg-default);
  }

  .node-panel-item[data-display-mode="list"] .icon-box :global(svg) {
    width: 100%;
    height: 100%;
    color: var(--node-header-print-default);
  }

  .node-panel-item[data-display-mode="grid"] .icon-box {
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    flex-shrink: 0;
    z-index: 1;
    width: var(--size-md);
    height: var(--size-md);
    padding: var(--pd-sm);
    border-radius: var(--radius-md);
    background: var(--node-icon-box-bg-default);
    box-shadow: 0 2px 6px 1px rgba(255, 255, 255, 0.17);
  }

  .node-panel-item[data-display-mode="grid"] .icon-box :global(svg) {
    width: 100%;
    height: 100%;
    color: var(--node-icon-box-color-default, var(--color-gray-120));
  }

  /* Category: icon-box background (list + grid) */
  .node-panel-item .icon-box[data-category="inputs"] { background: var(--node-icon-box-bg-inputs); }
  .node-panel-item.system-input .icon-box[data-category="inputs"] { background: var(--node-icon-box-bg-inputs-system); }
  .node-panel-item .icon-box[data-category="patterns"] { background: var(--node-icon-box-bg-patterns); }
  .node-panel-item.structured .icon-box[data-category="patterns"] { background: var(--node-icon-box-bg-patterns-structured); }
  .node-panel-item .icon-box[data-category="shapes"] { background: var(--node-icon-box-bg-shapes); }
  .node-panel-item.derived .icon-box[data-category="shapes"] { background: var(--node-icon-box-bg-shapes-derived); }
  .node-panel-item .icon-box[data-category="math"] { background: var(--node-icon-box-bg-math); }
  .node-panel-item.functions .icon-box[data-category="math"] { background: var(--node-icon-box-bg-math-functions); }
  .node-panel-item.advanced .icon-box[data-category="math"] { background: var(--node-icon-box-bg-math-advanced); }
  .node-panel-item .icon-box[data-category="utilities"] { background: var(--node-icon-box-bg-utilities); }
  .node-panel-item .icon-box[data-category="distort"] { background: var(--node-icon-box-bg-distort); }
  .node-panel-item.warp .icon-box[data-category="distort"] { background: var(--node-icon-box-bg-distort-warp); }
  .node-panel-item .icon-box[data-category="blend"] { background: var(--node-icon-box-bg-blend); }
  .node-panel-item .icon-box[data-category="mask"] { background: var(--node-icon-box-bg-mask); }
  .node-panel-item .icon-box[data-category="effects"] { background: var(--node-icon-box-bg-effects); }
  .node-panel-item.stylize .icon-box[data-category="effects"] { background: var(--node-icon-box-bg-effects-stylize); }
  .node-panel-item .icon-box[data-category="output"] { background: var(--node-icon-box-bg-output); }
  .node-panel-item .icon-box[data-category="audio"] { background: var(--node-icon-box-bg-audio); }
  .node-panel-item .icon-box[data-category="sdf"] { background: var(--node-icon-box-bg-sdf); }
  .node-panel-item.sdf-2d .icon-box[data-category="sdf"] { background: var(--node-icon-box-bg-sdf-2d); }
  .node-panel-item[data-display-mode="grid"] .icon-box[data-category="patterns"] { box-shadow: 0 0 9px 1px rgba(0, 0, 0, 0.15); }
  .node-panel-item[data-display-mode="grid"] .icon-box[data-category="shapes"] { box-shadow: 0 0 9px 1px rgba(0, 0, 0, 0.15); }
  .node-panel-item[data-display-mode="grid"] .icon-box[data-category="distort"] { box-shadow: 0 0 9px 1px rgba(0, 0, 0, 0.15); }
  .node-panel-item[data-display-mode="grid"] .icon-box[data-category="blend"] { box-shadow: 0 0 9px 1px rgba(0, 0, 0, 0.15); }
  .node-panel-item[data-display-mode="grid"] .icon-box[data-category="mask"] { box-shadow: 0 0 9px 1px rgba(0, 0, 0, 0.15); }
  .node-panel-item[data-display-mode="grid"] .icon-box[data-category="effects"] { box-shadow: 0 0 9px 1px rgba(0, 0, 0, 0.15); }

  /* Category: icon color */
  .node-panel-item[data-category="inputs"] .icon-box :global(svg) { color: var(--node-header-print-inputs); }
  .node-panel-item.system-input[data-category="inputs"] .icon-box :global(svg) { color: var(--node-header-print-inputs-system); }
  .node-panel-item[data-category="patterns"] .icon-box :global(svg) { color: var(--node-header-print-patterns); }
  .node-panel-item.structured[data-category="patterns"] .icon-box :global(svg) { color: var(--node-header-print-patterns-structured); }
  .node-panel-item[data-category="shapes"] .icon-box :global(svg) { color: var(--node-header-print-shapes); }
  .node-panel-item.derived[data-category="shapes"] .icon-box :global(svg) { color: var(--node-header-print-shapes-derived); }
  .node-panel-item[data-category="math"] .icon-box :global(svg) { color: var(--node-header-print-math); }
  .node-panel-item.functions[data-category="math"] .icon-box :global(svg) { color: var(--node-header-print-math-functions); }
  .node-panel-item.advanced[data-category="math"] .icon-box :global(svg) { color: var(--node-header-print-math-advanced); }
  .node-panel-item[data-category="utilities"] .icon-box :global(svg) { color: var(--node-header-print-utilities); }
  .node-panel-item[data-category="distort"] .icon-box :global(svg) { color: var(--node-header-print-distort); }
  .node-panel-item.warp[data-category="distort"] .icon-box :global(svg) { color: var(--node-header-print-distort-warp); }
  .node-panel-item[data-category="blend"] .icon-box :global(svg) { color: var(--node-header-print-blend); }
  .node-panel-item[data-category="mask"] .icon-box :global(svg) { color: var(--node-header-print-mask); }
  .node-panel-item[data-category="effects"] .icon-box :global(svg) { color: var(--node-header-print-effects); }
  .node-panel-item.stylize[data-category="effects"] .icon-box :global(svg) { color: var(--node-header-print-effects-stylize); }
  .node-panel-item[data-category="output"] .icon-box :global(svg) { color: var(--node-header-print-output); }
  .node-panel-item[data-category="audio"] .icon-box :global(svg) { color: var(--node-header-print-audio); }
  .node-panel-item[data-category="sdf"] .icon-box :global(svg) { color: var(--node-header-print-sdf); }
  .node-panel-item.sdf-2d[data-category="sdf"] .icon-box :global(svg) { color: var(--node-header-print-sdf-2d); }
  .node-panel-item[data-display-mode="grid"][data-category="inputs"] .icon-box :global(svg) { color: var(--node-icon-box-color-inputs); }
  .node-panel-item[data-display-mode="grid"].system-input[data-category="inputs"] .icon-box :global(svg) { color: var(--node-icon-box-color-inputs-system); }
  .node-panel-item[data-display-mode="grid"][data-category="patterns"] .icon-box :global(svg) { color: var(--node-icon-box-color-patterns); }
  .node-panel-item[data-display-mode="grid"].structured[data-category="patterns"] .icon-box :global(svg) { color: var(--node-icon-box-color-patterns-structured); }
  .node-panel-item[data-display-mode="grid"][data-category="shapes"] .icon-box :global(svg) { color: var(--node-icon-box-color-shapes); }
  .node-panel-item[data-display-mode="grid"].derived[data-category="shapes"] .icon-box :global(svg) { color: var(--node-icon-box-color-shapes-derived); }
  .node-panel-item[data-display-mode="grid"][data-category="math"] .icon-box :global(svg) { color: var(--node-icon-box-color-math); }
  .node-panel-item[data-display-mode="grid"].functions[data-category="math"] .icon-box :global(svg) { color: var(--node-icon-box-color-math-functions); }
  .node-panel-item[data-display-mode="grid"].advanced[data-category="math"] .icon-box :global(svg) { color: var(--node-icon-box-color-math-advanced); }
  .node-panel-item[data-display-mode="grid"][data-category="utilities"] .icon-box :global(svg) { color: var(--node-icon-box-color-utilities); }
  .node-panel-item[data-display-mode="grid"][data-category="distort"] .icon-box :global(svg) { color: var(--node-icon-box-color-distort); }
  .node-panel-item[data-display-mode="grid"].warp[data-category="distort"] .icon-box :global(svg) { color: var(--node-icon-box-color-distort-warp); }
  .node-panel-item[data-display-mode="grid"][data-category="blend"] .icon-box :global(svg) { color: var(--node-icon-box-color-blend); }
  .node-panel-item[data-display-mode="grid"][data-category="mask"] .icon-box :global(svg) { color: var(--node-icon-box-color-mask); }
  .node-panel-item[data-display-mode="grid"][data-category="effects"] .icon-box :global(svg) { color: var(--node-icon-box-color-effects); }
  .node-panel-item[data-display-mode="grid"].stylize[data-category="effects"] .icon-box :global(svg) { color: var(--node-icon-box-color-effects-stylize); }
  .node-panel-item[data-display-mode="grid"][data-category="output"] .icon-box :global(svg) { color: var(--node-icon-box-color-output); }
  .node-panel-item[data-display-mode="grid"][data-category="audio"] .icon-box :global(svg) { color: var(--node-icon-box-color-audio); }

  /* Category: title color */
  .node-panel-item[data-category="inputs"] .title { color: var(--node-header-print-inputs); }
  .node-panel-item.system-input[data-category="inputs"] .title { color: var(--node-header-print-inputs-system); }
  .node-panel-item[data-category="patterns"] .title { color: var(--node-header-print-patterns); }
  .node-panel-item.structured[data-category="patterns"] .title { color: var(--node-header-print-patterns-structured); }
  .node-panel-item[data-category="shapes"] .title { color: var(--node-header-print-shapes); }
  .node-panel-item.derived[data-category="shapes"] .title { color: var(--node-header-print-shapes-derived); }
  .node-panel-item[data-category="math"] .title { color: var(--node-header-print-math); }
  .node-panel-item.functions[data-category="math"] .title { color: var(--node-header-print-math-functions); }
  .node-panel-item.advanced[data-category="math"] .title { color: var(--node-header-print-math-advanced); }
  .node-panel-item[data-category="utilities"] .title { color: var(--node-header-print-utilities); }
  .node-panel-item[data-category="distort"] .title { color: var(--node-header-print-distort); }
  .node-panel-item.warp[data-category="distort"] .title { color: var(--node-header-print-distort-warp); }
  .node-panel-item[data-category="blend"] .title { color: var(--node-header-print-blend); }
  .node-panel-item[data-category="mask"] .title { color: var(--node-header-print-mask); }
  .node-panel-item[data-category="effects"] .title { color: var(--node-header-print-effects); }
  .node-panel-item.stylize[data-category="effects"] .title { color: var(--node-header-print-effects-stylize); }
  .node-panel-item[data-category="output"] .title { color: var(--node-header-print-output); }
  .node-panel-item[data-category="audio"] .title { color: var(--node-header-print-audio); }
  .node-panel-item[data-category="sdf"] .title { color: var(--node-header-print-sdf); }
  .node-panel-item.sdf-2d[data-category="sdf"] .title { color: var(--node-header-print-sdf-2d); }

  /* Category: grid card background */
  .node-panel-item[data-display-mode="grid"][data-category="inputs"] {
    background: radial-gradient(ellipse 200% 150% at 50% 15%, var(--node-header-bg-inputs), var(--node-header-bg-end-inputs));
  }
  .node-panel-item[data-display-mode="grid"].system-input[data-category="inputs"] {
    background: radial-gradient(ellipse 200% 150% at 50% 15%, var(--node-header-bg-inputs-system), var(--node-header-bg-end-inputs-system));
  }
  .node-panel-item[data-display-mode="grid"][data-category="patterns"] {
    background: radial-gradient(ellipse 200% 150% at 50% 15%, var(--node-header-bg-patterns), var(--node-header-bg-end-patterns));
  }
  .node-panel-item[data-display-mode="grid"].structured[data-category="patterns"] {
    background: radial-gradient(ellipse 200% 150% at 50% 15%, var(--node-header-bg-patterns-structured), var(--node-header-bg-end-patterns-structured));
  }
  .node-panel-item[data-display-mode="grid"][data-category="shapes"] {
    background: radial-gradient(ellipse 200% 150% at 50% 15%, var(--node-header-bg-shapes), var(--node-header-bg-end-shapes));
  }
  .node-panel-item[data-display-mode="grid"].derived[data-category="shapes"] {
    background: radial-gradient(ellipse 200% 150% at 50% 15%, var(--node-header-bg-shapes-derived), var(--node-header-bg-end-shapes-derived));
  }
  .node-panel-item[data-display-mode="grid"][data-category="math"] {
    background: radial-gradient(ellipse 200% 150% at 50% 15%, var(--node-header-bg-math), var(--node-header-bg-end-math));
  }
  .node-panel-item[data-display-mode="grid"].functions[data-category="math"] {
    background: radial-gradient(ellipse 200% 150% at 50% 15%, var(--node-header-bg-math-functions), var(--node-header-bg-end-math-functions));
  }
  .node-panel-item[data-display-mode="grid"].advanced[data-category="math"] {
    background: radial-gradient(ellipse 200% 150% at 50% 15%, var(--node-header-bg-math-advanced), var(--node-header-bg-end-math-advanced));
  }
  .node-panel-item[data-display-mode="grid"][data-category="utilities"] {
    background: radial-gradient(ellipse 200% 150% at 50% 15%, var(--node-header-bg-utilities), var(--node-header-bg-end-utilities));
  }
  .node-panel-item[data-display-mode="grid"][data-category="distort"] {
    background: radial-gradient(ellipse 200% 150% at 50% 15%, var(--node-header-bg-distort), var(--node-header-bg-end-distort));
  }
  .node-panel-item[data-display-mode="grid"].warp[data-category="distort"] {
    background: radial-gradient(ellipse 200% 150% at 50% 15%, var(--node-header-bg-distort-warp), var(--node-header-bg-end-distort-warp));
  }
  .node-panel-item[data-display-mode="grid"][data-category="blend"] {
    background: radial-gradient(ellipse 200% 150% at 50% 15%, var(--node-header-bg-blend), var(--node-header-bg-end-blend));
  }
  .node-panel-item[data-display-mode="grid"][data-category="mask"] {
    background: radial-gradient(ellipse 200% 150% at 50% 15%, var(--node-header-bg-mask), var(--node-header-bg-end-mask));
  }
  .node-panel-item[data-display-mode="grid"][data-category="effects"] {
    background: radial-gradient(ellipse 200% 150% at 50% 15%, var(--node-header-bg-effects), var(--node-header-bg-end-effects));
  }
  .node-panel-item[data-display-mode="grid"].stylize[data-category="effects"] {
    background: radial-gradient(ellipse 200% 150% at 50% 15%, var(--node-header-bg-effects-stylize), var(--node-header-bg-end-effects-stylize));
  }
  .node-panel-item[data-display-mode="grid"][data-category="output"] {
    background: radial-gradient(ellipse 200% 150% at 50% 15%, var(--node-header-bg-output), var(--node-header-bg-end-output));
  }
  .node-panel-item[data-display-mode="grid"][data-category="audio"] {
    background: radial-gradient(ellipse 200% 150% at 50% 15%, var(--node-header-bg-audio), var(--node-header-bg-end-audio));
  }
  .node-panel-item[data-display-mode="grid"][data-category="sdf"] {
    background: radial-gradient(ellipse 200% 150% at 50% 15%, var(--node-header-bg-sdf), var(--node-header-bg-end-sdf));
  }
  .node-panel-item[data-display-mode="grid"].sdf-2d[data-category="sdf"] {
    background: radial-gradient(ellipse 200% 150% at 50% 15%, var(--node-header-bg-sdf-2d), var(--node-header-bg-sdf));
  }

  /* Shiny: category-aware ring color (panel) */
  .node-panel-item.shiny[data-category="inputs"] { --panel-node-shiny-ring-color: var(--node-header-print-inputs); }
  .node-panel-item.shiny.system-input[data-category="inputs"] { --panel-node-shiny-ring-color: var(--node-header-print-inputs-system); }
  .node-panel-item.shiny[data-category="patterns"] { --panel-node-shiny-ring-color: var(--node-header-print-patterns); }
  .node-panel-item.shiny.structured[data-category="patterns"] { --panel-node-shiny-ring-color: var(--node-header-print-patterns-structured); }
  .node-panel-item.shiny[data-category="shapes"] { --panel-node-shiny-ring-color: var(--node-header-print-shapes); }
  .node-panel-item.shiny.derived[data-category="shapes"] { --panel-node-shiny-ring-color: var(--node-header-print-shapes-derived); }
  .node-panel-item.shiny[data-category="math"] { --panel-node-shiny-ring-color: var(--node-header-print-math); }
  .node-panel-item.shiny.functions[data-category="math"] { --panel-node-shiny-ring-color: var(--node-header-print-math-functions); }
  .node-panel-item.shiny.advanced[data-category="math"] { --panel-node-shiny-ring-color: var(--node-header-print-math-advanced); }
  .node-panel-item.shiny[data-category="utilities"] { --panel-node-shiny-ring-color: var(--node-header-print-utilities); }
  .node-panel-item.shiny[data-category="distort"] { --panel-node-shiny-ring-color: var(--node-header-print-distort); }
  .node-panel-item.shiny.warp[data-category="distort"] { --panel-node-shiny-ring-color: var(--node-header-print-distort-warp); }
  .node-panel-item.shiny[data-category="blend"] { --panel-node-shiny-ring-color: var(--node-header-print-blend); }
  .node-panel-item.shiny[data-category="mask"] { --panel-node-shiny-ring-color: var(--node-header-print-mask); }
  .node-panel-item.shiny[data-category="effects"] { --panel-node-shiny-ring-color: var(--node-header-print-effects); }
  .node-panel-item.shiny.stylize[data-category="effects"] { --panel-node-shiny-ring-color: var(--node-header-print-effects-stylize); }
  .node-panel-item.shiny[data-category="output"] { --panel-node-shiny-ring-color: var(--node-header-print-output); }
  .node-panel-item.shiny[data-category="audio"] { --panel-node-shiny-ring-color: var(--node-header-print-audio); }
  .node-panel-item.shiny[data-category="sdf"] { --panel-node-shiny-ring-color: var(--node-header-print-sdf); }
</style>
