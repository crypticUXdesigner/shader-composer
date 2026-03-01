<script lang="ts">
  /**
   * One section of the help callout: inputs or outputs list with optional suggestions.
   * Used by HelpCalloutContent for both Inputs and Outputs.
   */
  import { Tag, NodeIconSvg } from '../ui';
  import { resolveRelatedItems } from '../../../utils/ContextualHelpManager';
  import type { HelpPort } from '../../../utils/ContextualHelpManager';
  import type { NodeSpec } from '../../../types/nodeSpec';
  import { getNodeIcon } from '../../../utils/nodeSpecUtils';
  import { getPortTypeDisplayLabel } from '../../../ui/editor';

  /** Port may include hideLabel when output label is redundant (e.g. single-output input nodes). */
  interface Props {
    ports: (HelpPort & { hideLabel?: boolean })[];
    nodeSpecs: Map<string, NodeSpec>;
    getSuggestions: (port: HelpPort) => string[] | undefined;
  }

  let { ports, nodeSpecs, getSuggestions }: Props = $props();
</script>

<div class="ports">
  <div class="list">
    {#each ports as port}
      <div class="item">
        <div class="left">
          {#if !port.hideLabel}
            <span class="name">{port.label ?? port.name}</span>
          {/if}
          <Tag size="xs" type={port.type}>{getPortTypeDisplayLabel(port.type)}</Tag>
        </div>
        <div class="right">
          <div class="description">{port.description}</div>
          {#if getSuggestions(port)?.length}
            {@const resolved = resolveRelatedItems(getSuggestions(port) ?? [], nodeSpecs)}
            {#if resolved.nodes.length > 0}
              <div class="suggestions">
                <div class="items">
                  {#each resolved.nodes as nodeSpec}
                    <div class="related" title={nodeSpec.displayName}>
                      <NodeIconSvg identifier={getNodeIcon(nodeSpec)} />
                      <span class="label">{nodeSpec.displayName}</span>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
          {/if}
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .ports {
    display: flex;
    flex-direction: column;
    gap: var(--pd-md);

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

      .name {
        font-weight: 600;
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        color: var(--print-highlight);
      }
    }

    .right {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: var(--pd-md);

      .description {
        font-size: var(--text-sm);
        line-height: 1.5;
        color: var(--print-highlight
        );
      }

      .suggestions {
        display: flex;
        flex-direction: column;
        gap: var(--pd-xs);

        .items {
          display: flex;
          flex-wrap: wrap;
          gap: var(--pd-md);

          .related {
            display: flex;
            align-items: center;
            gap: var(--pd-sm);
            padding: 0;
            color: var(--print-default);
            cursor: default;

            > .label {
              font-size: var(--text-xs);
              color: currentColor;
              white-space: nowrap;
            }
          }

          .related:hover {
            color: var(--print-highlight);
          }
        }
      }
    }
  }
</style>
