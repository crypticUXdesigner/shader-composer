<script lang="ts">
  /**
   * Parameters documentation section for the help callout: name and description per parameter.
   * Description should convey what the parameter does and how it affects the result.
   * Used by HelpCalloutContent when content.parameters is present.
   */
  import type { HelpParameter } from '../../../utils/ContextualHelpManager';

  interface Props {
    parameters: HelpParameter[];
    /** When true, do not render the section headline (e.g. when wrapped in PanelSection). */
    hideHeadline?: boolean;
  }

  let { parameters, hideHeadline = false }: Props = $props();
</script>

{#if parameters.length > 0}
  <div class="parameters-doc">
    {#if !hideHeadline}
      <div class="parameters-doc-label">Parameters</div>
    {/if}
    <div class="list">
      {#each parameters as param}
        <div class="item">
          <div class="left">
            <span class="name">{param.name}</span>
          </div>
          <div class="right">
            <div class="description">
              {param.description}
            </div>
          </div>
        </div>
      {/each}
    </div>
  </div>
{/if}

<style>
  .parameters-doc {
    display: flex;
    flex-direction: column;
    gap: var(--pd-md);

    .parameters-doc-label {
      font-weight: 700;
      color: var(--print-subtle);
    }

    .list {
      display: flex;
      flex-direction: column;
      gap: var(--pd-md);
    }

    .item {
      display: flex;
      flex-direction: row;
      align-items: flex-start;
      gap: var(--pd-md);
    }

    .left {
      flex-shrink: 0;
      width: 120px;
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: var(--pd-md);
    }

    .left .name {
      font-weight: 600;
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--print-highlight);
    }

    .right {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: var(--pd-md);
    }

    .right .description {
      font-size: var(--text-sm);
      line-height: 1.5;
      color: var(--print-highlight);
    }
  }
</style>
