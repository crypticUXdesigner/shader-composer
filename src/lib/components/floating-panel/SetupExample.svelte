<script lang="ts">
  /**
   * Setup Example – help callout section: static headline and mini graph only.
   */
  import { MiniGraph } from '../ui';
  import type { SetupExampleGraph } from '../../../utils/ContextualHelpManager';
  import type { NodeSpec } from '../../../types/nodeSpec';

  interface Props {
    graph: SetupExampleGraph;
    nodeSpecs: Map<string, NodeSpec>;
  }

  let { graph, nodeSpecs }: Props = $props();
</script>

<div class="setup-example">
  <div class="label">Setup example</div>
  <div class="quick-graph">
    <MiniGraph {graph} {nodeSpecs} />
  </div>
</div>

<style>
  .setup-example {
    display: flex;
    flex-direction: column;
    gap: var(--pd-sm);
    padding: var(--pd-sm) var(--pd-md) var(--pd-md) var(--pd-md);
    background: var(--color-gray-40);
    border-radius: var(--radius-xs);

    .label {
      font-weight: 600;
      font-size: var(--text-2xs);
      font-family: var(--font-mono);
      color: var(--color-teal-80);
    }

    .quick-graph {
      max-width: 100%;
      overflow-x: auto;
      min-height: 0;
    }
  }
</style>
