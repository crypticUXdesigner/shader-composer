<script lang="ts">
  /**
   * Scrollable body of the help callout: headline (icon + title + tagline), description, ports, parameters, examples, related.
   * Used by HelpCallout; receives content and nodeSpecs from ContextualHelpManager.
   */
  import { NodeIconSvg, PanelSection } from '../ui';
  import SetupExample from './SetupExample.svelte';
  import {
    resolveRelatedItems,
    findNodesUsingType,
    type HelpContent,
  } from '../../../utils/ContextualHelpManager';
  import type { NodeSpec } from '../../../types/nodeSpec';
  import { getNodeIcon, isRedundantOutputLabel } from '../../../utils/nodeSpecUtils';
  import { getCategorySlug, getSubGroupSlug } from '../../../utils/cssTokens';
  import HelpCalloutHeadline from './HelpCalloutHeadline.svelte';
  import HelpCalloutPortsSection from './HelpCalloutPortsSection.svelte';
  import HelpCalloutParametersSection from './HelpCalloutParametersSection.svelte';

  interface Props {
    content: HelpContent;
    /** Node type id when help is for a node (e.g. "noise"); used to resolve spec for port labels. */
    helpNodeType?: string;
    nodeSpecs: Map<string, NodeSpec>;
  }

  let { content, helpNodeType, nodeSpecs }: Props = $props();

  const usedByNodes = $derived.by(() => {
    if (content.titleType !== 'type' || nodeSpecs.size === 0) return [];
    return findNodesUsingType(content.title, nodeSpecs);
  });

  const relatedResolved = $derived.by(() => {
    if (!content.relatedItems?.length || nodeSpecs.size === 0) return { nodes: [] as NodeSpec[] };
    return resolveRelatedItems(content.relatedItems, nodeSpecs);
  });

  /** Enrich port lists with label from node spec when showing node help, so help panel matches node header. */
  const spec = $derived.by(() =>
    helpNodeType ? nodeSpecs.get(helpNodeType) : undefined
  );
  const categorySlug = $derived(spec ? getCategorySlug(spec.category) : '');
  const subgroupSlug = $derived(spec ? getSubGroupSlug(spec.id, spec.category) : '');
  const enrichedInputs = $derived.by(() => {
    if (!content.inputs?.length) return [];
    const nodeInputs = spec?.inputs;
    return content.inputs.map((port) => ({
      ...port,
      label: port.label ?? nodeInputs?.find((p) => p.name === port.name)?.label,
    }));
  });
  const enrichedOutputs = $derived.by(() => {
    if (!content.outputs?.length) return [];
    const nodeOutputs = spec?.outputs;
    return content.outputs.map((port) => {
      const specPort = nodeOutputs?.find((p) => p.name === port.name);
      const label = port.label ?? specPort?.label;
      const hideLabel =
        spec && specPort ? isRedundantOutputLabel(spec, specPort) : false;
      return { ...port, label, hideLabel };
    });
  });

  let inputsExpanded = $state(true);
  let outputsExpanded = $state(true);
  let parametersExpanded = $state(true);

  /** Show mini graph only when setupExampleGraph has nodes and we have specs for every node type. */
  const canShowSetupExample = $derived.by(() => {
    const graph = content.setupExampleGraph;
    if (!graph?.nodes?.length || nodeSpecs.size === 0) return false;
    return graph.nodes.every((n) => nodeSpecs.has(n.type));
  });
</script>

<div class="content">
  {#if spec && (content.title || content.tagline)}
    <HelpCalloutHeadline
      spec={spec}
      title={content.title}
      tagline={content.tagline}
      {categorySlug}
      {subgroupSlug}
    />
  {/if}

  {#if canShowSetupExample && content.setupExampleGraph}
    <SetupExample graph={content.setupExampleGraph} {nodeSpecs} />
  {/if}

  <div class="desc">{content.description}</div>

  {#if enrichedInputs.length}
    <PanelSection
      title="Inputs"
      variant="tight"
      expanded={inputsExpanded}
      onToggle={() => (inputsExpanded = !inputsExpanded)}
    >
      <HelpCalloutPortsSection
        ports={enrichedInputs}
        {nodeSpecs}
        getSuggestions={(port) => port.suggestedSources}
      />
    </PanelSection>
  {/if}

  {#if enrichedOutputs.length}
    <PanelSection
      title="Outputs"
      variant="tight"
      expanded={outputsExpanded}
      onToggle={() => (outputsExpanded = !outputsExpanded)}
    >
      <HelpCalloutPortsSection
        ports={enrichedOutputs}
        {nodeSpecs}
        getSuggestions={(port) => port.suggestedTargets}
      />
    </PanelSection>
  {/if}

  {#if (content.parameters ?? []).length > 0}
    <PanelSection
      title="Controls"
      variant="tight"
      expanded={parametersExpanded}
      onToggle={() => (parametersExpanded = !parametersExpanded)}
    >
      <HelpCalloutParametersSection
        parameters={content.parameters ?? []}
        hideHeadline
      />
    </PanelSection>
  {/if}

  {#if content.examples?.length}
    <div class="examples">
      <div class="label">Examples:</div>
      <ul class="list">
        {#each content.examples as example}
          <li>{example}</li>
        {/each}
      </ul>
    </div>
  {/if}

  {#if content.advanced}
    <details class="advanced">
      <summary class="summary">More detail</summary>
      <div class="text">{content.advanced}</div>
    </details>
  {/if}

  {#if usedByNodes.length > 0}
    <div class="related">
      <div class="label">Used by:</div>
      <div class="items">
        {#each usedByNodes.slice(0, 12) as nodeSpec}
          <div class="item" title={nodeSpec.displayName}>
            <NodeIconSvg identifier={getNodeIcon(nodeSpec)} />
            <span class="name">{nodeSpec.displayName}</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  {#if relatedResolved.nodes.length > 0}
    <div class="related">
      <div class="label">Related:</div>
      <div class="items">
        {#each relatedResolved.nodes.slice(0, 8) as nodeSpec}
          <div class="item" title={nodeSpec.displayName}>
            <NodeIconSvg identifier={getNodeIcon(nodeSpec)} />
            <span class="name">{nodeSpec.displayName}</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .content {
    display: flex;
    flex-direction: column;
    gap: var(--pd-lg);
    padding: var(--pd-lg);

    .desc {
      font-size: var(--text-sm);
      line-height: 1.6;
    }

    .advanced {
      margin-top: var(--pd-xs);

      .summary {
        font-weight: 600;
        font-size: var(--text-sm);
        color: var(--print-subtle);
        cursor: default;
      }

      .text {
        font-size: var(--text-sm);
        line-height: 1.5;
        color: var(--print-subtle);
        margin-top: var(--pd-sm);
      }
    }

    .related {
      display: flex;
      flex-direction: column;
      gap: var(--pd-md);
    }

    .related .label {
      font-weight: 700;
      color: var(--print-subtle);
    }

    .related .items {
      display: flex;
      flex-wrap: wrap;
      gap: var(--pd-xs);
    }

    .related .item {
      display: flex;
      align-items: center;
      gap: var(--pd-sm);
      padding: var(--pd-xs) var(--pd-sm);
      border-radius: var(--radius-sm);
      background: var(--ghost-bg);
      color: var(--ghost-print);
      cursor: default;
      transition: background 0.15s, color 0.15s;
    }

    .related .item:hover {
      background: var(--secondary-bg-hover);
      color: var(--secondary-print-hover);
    }

    .related .item .name {
      font-size: var(--text-sm);
      color: currentColor;
      white-space: nowrap;
    }

    .examples {
      display: flex;
      flex-direction: column;
      gap: var(--pd-sm);
    }

    .examples .label {
      font-weight: 700;
      color: var(--print-subtle);
    }

    .examples .list {
      margin: 0;
      padding-left: var(--pd-lg);
      list-style: disc;
    }

    .examples .list li {
      margin-bottom: var(--pd-xs);
    }

    .examples .list li:last-child {
      margin-bottom: 0;
    }
  }
</style>
