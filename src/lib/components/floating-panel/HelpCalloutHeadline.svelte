<script lang="ts">
  /**
   * Headline block for node help: icon (in category-colored icon box), title, tagline.
   * Uses node header gradient and icon-box tokens so it matches the node’s look.
   * Renders inside parent padding (no negative margin).
   */
  import { NodeIconSvg } from '../ui';
  import type { NodeSpec } from '../../../types/nodeSpec';
  import { getNodeIcon } from '../../../utils/nodeSpecUtils';

  interface Props {
    spec: NodeSpec;
    title?: string;
    tagline?: string;
    categorySlug: string;
    subgroupSlug: string;
  }

  let { spec, title, tagline, categorySlug, subgroupSlug }: Props = $props();
</script>

<div
  class="help-callout-headline {subgroupSlug}"
  data-category={categorySlug}
  data-subgroup={subgroupSlug || undefined}
>
  <div class="headline-icon-box" data-category={categorySlug}>
    <NodeIconSvg identifier={getNodeIcon(spec)} />
  </div>
  <div class="headline-text">
    {#if title}
      <h2 class="headline-title">{title}</h2>
    {/if}
    {#if tagline}
      <p class="headline-tagline">{tagline}</p>
    {/if}
  </div>
</div>

<style>
  /* Headline: node header colors (gradient + print), icon box uses category/subgroup tokens. No negative margin — respects parent padding. */
  .help-callout-headline {
    display: flex;
    align-items: flex-start;
    gap: var(--pd-md);
    padding: var(--pd-md);
    border-radius: var(--radius-md);
    background: radial-gradient(
      ellipse var(--node-header-bg-gradient-ellipse-width) var(--node-header-bg-gradient-ellipse-height) at var(--node-header-bg-gradient-ellipse-x) var(--node-header-bg-gradient-ellipse-y),
      var(--node-header-bg-default),
      var(--node-header-bg-end-default)
    );
    color: var(--node-header-print-default);
    box-shadow: 0 0 0 3px var(--color-gray-90);
  }

  .help-callout-headline[data-category="inputs"] {
    --headline-bg: var(--node-header-bg-inputs);
    --headline-bg-end: var(--node-header-bg-end-inputs);
    --headline-print: var(--node-header-print-inputs);
    background: radial-gradient(
      ellipse var(--node-header-bg-gradient-ellipse-width) var(--node-header-bg-gradient-ellipse-height) at var(--node-header-bg-gradient-ellipse-x) var(--node-header-bg-gradient-ellipse-y),
      var(--headline-bg),
      var(--node-header-bg-end-inputs)
    );
  }
  .help-callout-headline.system-input[data-category="inputs"] {
    --headline-bg: var(--node-header-bg-inputs-system);
    --headline-print: var(--node-header-print-inputs-system);
    background: radial-gradient(
      ellipse var(--node-header-bg-gradient-ellipse-width) var(--node-header-bg-gradient-ellipse-height) at var(--node-header-bg-gradient-ellipse-x) var(--node-header-bg-gradient-ellipse-y),
      var(--headline-bg),
      var(--node-header-bg-end-inputs-system)
    );
  }
  .help-callout-headline[data-category="patterns"] {
    --headline-bg: var(--node-header-bg-patterns);
    --headline-print: var(--node-header-print-patterns);
    background: radial-gradient(
      ellipse var(--node-header-bg-gradient-ellipse-width) var(--node-header-bg-gradient-ellipse-height) at var(--node-header-bg-gradient-ellipse-x) var(--node-header-bg-gradient-ellipse-y),
      var(--headline-bg),
      var(--node-header-bg-end-patterns)
    );
  }
  .help-callout-headline.structured[data-category="patterns"] {
    --headline-bg: var(--node-header-bg-patterns-structured);
    --headline-print: var(--node-header-print-patterns-structured);
    background: radial-gradient(
      ellipse var(--node-header-bg-gradient-ellipse-width) var(--node-header-bg-gradient-ellipse-height) at var(--node-header-bg-gradient-ellipse-x) var(--node-header-bg-gradient-ellipse-y),
      var(--headline-bg),
      var(--node-header-bg-end-patterns-structured)
    );
  }
  .help-callout-headline[data-category="shapes"] {
    --headline-bg: var(--node-header-bg-shapes);
    --headline-print: var(--node-header-print-shapes);
    background: radial-gradient(
      ellipse var(--node-header-bg-gradient-ellipse-width) var(--node-header-bg-gradient-ellipse-height) at var(--node-header-bg-gradient-ellipse-x) var(--node-header-bg-gradient-ellipse-y),
      var(--headline-bg),
      var(--node-header-bg-end-shapes)
    );
  }
  .help-callout-headline.derived[data-category="shapes"] {
    --headline-bg: var(--node-header-bg-shapes-derived);
    --headline-print: var(--node-header-print-shapes-derived);
    background: radial-gradient(
      ellipse var(--node-header-bg-gradient-ellipse-width) var(--node-header-bg-gradient-ellipse-height) at var(--node-header-bg-gradient-ellipse-x) var(--node-header-bg-gradient-ellipse-y),
      var(--headline-bg),
      var(--node-header-bg-end-shapes-derived)
    );
  }
  .help-callout-headline[data-category="math"] {
    --headline-bg: var(--node-header-bg-math);
    --headline-print: var(--node-header-print-math);
    background: radial-gradient(
      ellipse var(--node-header-bg-gradient-ellipse-width) var(--node-header-bg-gradient-ellipse-height) at var(--node-header-bg-gradient-ellipse-x) var(--node-header-bg-gradient-ellipse-y),
      var(--headline-bg),
      var(--node-header-bg-end-math)
    );
  }
  .help-callout-headline.functions[data-category="math"],
  .help-callout-headline.advanced[data-category="math"] {
    --headline-bg: var(--node-header-bg-math-functions);
    --headline-print: var(--node-header-print-math-functions);
    background: radial-gradient(
      ellipse var(--node-header-bg-gradient-ellipse-width) var(--node-header-bg-gradient-ellipse-height) at var(--node-header-bg-gradient-ellipse-x) var(--node-header-bg-gradient-ellipse-y),
      var(--headline-bg),
      var(--node-header-bg-end-math-functions)
    );
  }
  .help-callout-headline.advanced[data-category="math"] {
    --headline-bg: var(--node-header-bg-math-advanced);
    --headline-print: var(--node-header-print-math-advanced);
    background: radial-gradient(
      ellipse var(--node-header-bg-gradient-ellipse-width) var(--node-header-bg-gradient-ellipse-height) at var(--node-header-bg-gradient-ellipse-x) var(--node-header-bg-gradient-ellipse-y),
      var(--headline-bg),
      var(--node-header-bg-end-math-advanced)
    );
  }
  .help-callout-headline[data-category="utilities"] {
    --headline-bg: var(--node-header-bg-utilities);
    --headline-print: var(--node-header-print-utilities);
    background: radial-gradient(
      ellipse var(--node-header-bg-gradient-ellipse-width) var(--node-header-bg-gradient-ellipse-height) at var(--node-header-bg-gradient-ellipse-x) var(--node-header-bg-gradient-ellipse-y),
      var(--headline-bg),
      var(--node-header-bg-end-utilities)
    );
  }
  .help-callout-headline[data-category="distort"] {
    --headline-bg: var(--node-header-bg-distort);
    --headline-print: var(--node-header-print-distort);
    background: radial-gradient(
      ellipse var(--node-header-bg-gradient-ellipse-width) var(--node-header-bg-gradient-ellipse-height) at var(--node-header-bg-gradient-ellipse-x) var(--node-header-bg-gradient-ellipse-y),
      var(--headline-bg),
      var(--node-header-bg-end-distort)
    );
  }
  .help-callout-headline.warp[data-category="distort"] {
    --headline-bg: var(--node-header-bg-distort-warp);
    --headline-print: var(--node-header-print-distort-warp);
    background: radial-gradient(
      ellipse var(--node-header-bg-gradient-ellipse-width) var(--node-header-bg-gradient-ellipse-height) at var(--node-header-bg-gradient-ellipse-x) var(--node-header-bg-gradient-ellipse-y),
      var(--headline-bg),
      var(--node-header-bg-end-distort-warp)
    );
  }
  .help-callout-headline[data-category="blend"] {
    --headline-bg: var(--node-header-bg-blend);
    --headline-print: var(--node-header-print-blend);
    background: radial-gradient(
      ellipse var(--node-header-bg-gradient-ellipse-width) var(--node-header-bg-gradient-ellipse-height) at var(--node-header-bg-gradient-ellipse-x) var(--node-header-bg-gradient-ellipse-y),
      var(--headline-bg),
      var(--node-header-bg-end-blend)
    );
  }
  .help-callout-headline[data-category="mask"] {
    --headline-bg: var(--node-header-bg-mask);
    --headline-print: var(--node-header-print-mask);
    background: radial-gradient(
      ellipse var(--node-header-bg-gradient-ellipse-width) var(--node-header-bg-gradient-ellipse-height) at var(--node-header-bg-gradient-ellipse-x) var(--node-header-bg-gradient-ellipse-y),
      var(--headline-bg),
      var(--node-header-bg-end-mask)
    );
  }
  .help-callout-headline[data-category="effects"] {
    --headline-bg: var(--node-header-bg-effects);
    --headline-print: var(--node-header-print-effects);
    background: radial-gradient(
      ellipse var(--node-header-bg-gradient-ellipse-width) var(--node-header-bg-gradient-ellipse-height) at var(--node-header-bg-gradient-ellipse-x) var(--node-header-bg-gradient-ellipse-y),
      var(--headline-bg),
      var(--node-header-bg-end-effects)
    );
  }
  .help-callout-headline.stylize[data-category="effects"] {
    --headline-bg: var(--node-header-bg-effects-stylize);
    --headline-print: var(--node-header-print-effects-stylize);
    background: radial-gradient(
      ellipse var(--node-header-bg-gradient-ellipse-width) var(--node-header-bg-gradient-ellipse-height) at var(--node-header-bg-gradient-ellipse-x) var(--node-header-bg-gradient-ellipse-y),
      var(--headline-bg),
      var(--node-header-bg-end-effects-stylize)
    );
  }
  .help-callout-headline[data-category="output"] {
    --headline-bg: var(--node-header-bg-output);
    --headline-print: var(--node-header-print-output);
    background: radial-gradient(
      ellipse var(--node-header-bg-gradient-ellipse-width) var(--node-header-bg-gradient-ellipse-height) at var(--node-header-bg-gradient-ellipse-x) var(--node-header-bg-gradient-ellipse-y),
      var(--headline-bg),
      var(--node-header-bg-end-output)
    );
  }
  .help-callout-headline[data-category="audio"] {
    --headline-bg: var(--node-header-bg-audio);
    --headline-print: var(--node-header-print-audio);
    background: radial-gradient(
      ellipse var(--node-header-bg-gradient-ellipse-width) var(--node-header-bg-gradient-ellipse-height) at var(--node-header-bg-gradient-ellipse-x) var(--node-header-bg-gradient-ellipse-y),
      var(--headline-bg),
      var(--node-header-bg-end-audio)
    );
  }
  .help-callout-headline[data-category="sdf"] {
    --headline-bg: var(--node-header-bg-sdf);
    --headline-print: var(--node-header-print-sdf);
    background: radial-gradient(
      ellipse var(--node-header-bg-gradient-ellipse-width) var(--node-header-bg-gradient-ellipse-height) at var(--node-header-bg-gradient-ellipse-x) var(--node-header-bg-gradient-ellipse-y),
      var(--headline-bg),
      var(--node-header-bg-end-sdf)
    );
  }
  .help-callout-headline.raymarcher[data-category="sdf"] {
    --headline-bg: var(--node-header-bg-sdf-raymarcher);
    --headline-print: var(--node-header-print-sdf-raymarcher);
    background: radial-gradient(
      ellipse var(--node-header-bg-gradient-ellipse-width) var(--node-header-bg-gradient-ellipse-height) at var(--node-header-bg-gradient-ellipse-x) var(--node-header-bg-gradient-ellipse-y),
      var(--headline-bg),
      var(--node-header-bg-end-sdf-raymarcher)
    );
  }
  .help-callout-headline[data-category="default"] {
    background: radial-gradient(
      ellipse var(--node-header-bg-gradient-ellipse-width) var(--node-header-bg-gradient-ellipse-height) at var(--node-header-bg-gradient-ellipse-x) var(--node-header-bg-gradient-ellipse-y),
      var(--node-header-bg-default),
      var(--node-header-bg-end-default)
    );
    color: var(--node-header-print-default);
  }

  .headline-icon-box {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: var(--size-md);
    height: var(--size-md);
    border-radius: var(--radius-md);
    background: var(--node-icon-box-bg-default);
  }
  .headline-icon-box :global(svg) {
    width: var(--icon-size-md);
    height: var(--icon-size-md);
    color: var(--node-icon-box-color-default, var(--color-gray-120));
  }
  .help-callout-headline[data-category="inputs"] .headline-icon-box { background: var(--node-icon-box-bg-inputs); }
  .help-callout-headline.system-input[data-category="inputs"] .headline-icon-box { background: var(--node-icon-box-bg-inputs-system); }
  .help-callout-headline[data-category="patterns"] .headline-icon-box { background: var(--node-icon-box-bg-patterns); }
  .help-callout-headline.structured[data-category="patterns"] .headline-icon-box { background: var(--node-icon-box-bg-patterns-structured); }
  .help-callout-headline[data-category="shapes"] .headline-icon-box { background: var(--node-icon-box-bg-shapes); }
  .help-callout-headline.derived[data-category="shapes"] .headline-icon-box { background: var(--node-icon-box-bg-shapes-derived); }
  .help-callout-headline[data-category="math"] .headline-icon-box { background: var(--node-icon-box-bg-math); }
  .help-callout-headline.functions[data-category="math"] .headline-icon-box { background: var(--node-icon-box-bg-math-functions); }
  .help-callout-headline.advanced[data-category="math"] .headline-icon-box { background: var(--node-icon-box-bg-math-advanced); }
  .help-callout-headline[data-category="utilities"] .headline-icon-box { background: var(--node-icon-box-bg-utilities); }
  .help-callout-headline[data-category="distort"] .headline-icon-box { background: var(--node-icon-box-bg-distort); }
  .help-callout-headline.warp[data-category="distort"] .headline-icon-box { background: var(--node-icon-box-bg-distort-warp); }
  .help-callout-headline[data-category="blend"] .headline-icon-box { background: var(--node-icon-box-bg-blend); }
  .help-callout-headline[data-category="mask"] .headline-icon-box { background: var(--node-icon-box-bg-mask); }
  .help-callout-headline[data-category="effects"] .headline-icon-box { background: var(--node-icon-box-bg-effects); }
  .help-callout-headline.stylize[data-category="effects"] .headline-icon-box { background: var(--node-icon-box-bg-effects-stylize); }
  .help-callout-headline[data-category="output"] .headline-icon-box { background: var(--node-icon-box-bg-output); }
  .help-callout-headline[data-category="audio"] .headline-icon-box { background: var(--node-icon-box-bg-audio); }
  .help-callout-headline[data-category="sdf"] .headline-icon-box { background: var(--node-icon-box-bg-sdf); }
  .help-callout-headline.raymarcher[data-category="sdf"] .headline-icon-box { background: var(--node-icon-box-bg-sdf-raymarcher); }
  .help-callout-headline[data-category="inputs"] .headline-icon-box :global(svg) { color: var(--node-icon-box-color-inputs, var(--node-header-print-inputs)); }
  .help-callout-headline.system-input[data-category="inputs"] .headline-icon-box :global(svg) { color: var(--node-icon-box-color-inputs-system, var(--node-header-print-inputs-system)); }
  .help-callout-headline[data-category="patterns"] .headline-icon-box :global(svg) { color: var(--node-icon-box-color-patterns, var(--node-header-print-patterns)); }
  .help-callout-headline.structured[data-category="patterns"] .headline-icon-box :global(svg) { color: var(--node-icon-box-color-patterns-structured, var(--node-header-print-patterns-structured)); }
  .help-callout-headline[data-category="shapes"] .headline-icon-box :global(svg) { color: var(--node-icon-box-color-shapes, var(--node-header-print-shapes)); }
  .help-callout-headline.derived[data-category="shapes"] .headline-icon-box :global(svg) { color: var(--node-icon-box-color-shapes-derived, var(--node-header-print-shapes-derived)); }
  .help-callout-headline[data-category="math"] .headline-icon-box :global(svg) { color: var(--node-icon-box-color-math, var(--node-header-print-math)); }
  .help-callout-headline.functions[data-category="math"] .headline-icon-box :global(svg) { color: var(--node-icon-box-color-math-functions, var(--node-header-print-math-functions)); }
  .help-callout-headline.advanced[data-category="math"] .headline-icon-box :global(svg) { color: var(--node-icon-box-color-math-advanced, var(--node-header-print-math-advanced)); }
  .help-callout-headline[data-category="utilities"] .headline-icon-box :global(svg) { color: var(--node-icon-box-color-utilities, var(--node-header-print-utilities)); }
  .help-callout-headline[data-category="distort"] .headline-icon-box :global(svg) { color: var(--node-icon-box-color-distort, var(--node-header-print-distort)); }
  .help-callout-headline.warp[data-category="distort"] .headline-icon-box :global(svg) { color: var(--node-icon-box-color-distort-warp, var(--node-header-print-distort-warp)); }
  .help-callout-headline[data-category="blend"] .headline-icon-box :global(svg) { color: var(--node-icon-box-color-blend, var(--node-header-print-blend)); }
  .help-callout-headline[data-category="mask"] .headline-icon-box :global(svg) { color: var(--node-icon-box-color-mask, var(--node-header-print-mask)); }
  .help-callout-headline[data-category="effects"] .headline-icon-box :global(svg) { color: var(--node-icon-box-color-effects, var(--node-header-print-effects)); }
  .help-callout-headline.stylize[data-category="effects"] .headline-icon-box :global(svg) { color: var(--node-icon-box-color-effects-stylize, var(--node-header-print-effects-stylize)); }
  .help-callout-headline[data-category="output"] .headline-icon-box :global(svg) { color: var(--node-icon-box-color-output, var(--node-header-print-output)); }
  .help-callout-headline[data-category="audio"] .headline-icon-box :global(svg) { color: var(--node-icon-box-color-audio, var(--node-header-print-audio)); }
  .help-callout-headline[data-category="sdf"] .headline-icon-box :global(svg) { color: var(--node-icon-box-color-sdf, var(--node-header-print-sdf)); }
  .help-callout-headline.raymarcher[data-category="sdf"] .headline-icon-box :global(svg) { color: var(--node-icon-box-color-sdf-raymarcher, var(--node-header-print-sdf-raymarcher)); }

  .headline-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--pd-2xs);
  }
  .headline-title {
    margin: 0;
    font-size: var(--text-lg);
    font-weight: 700;
    line-height: 1.3;
    color: inherit;
  }
  .headline-tagline {
    margin: 0;
    font-size: var(--text-sm);
    line-height: 1.4;
    opacity: 0.95;
    color: inherit;
  }
</style>
