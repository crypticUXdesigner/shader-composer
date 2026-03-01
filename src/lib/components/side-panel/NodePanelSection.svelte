<script lang="ts">
  /**
   * Collapsible section for Node Panel categories.
   * Wrapper around PanelSection with default variant.
   * When headerIcon snippet is provided, shows it instead of the chevron (e.g. category default icon).
   * When subgroupCounts is provided, shows multiple badges (one per subgroup) instead of a single count.
   */
  import { PanelSection, Badge } from '../ui';
  import { SUBGROUP_DISPLAY_LABELS } from '../../../utils/cssTokens';

  interface Props {
    title: string;
    count?: number;
    subgroupCounts?: { subgroupSlug: string; count: number }[];
    expanded?: boolean;
    onToggle?: () => void;
    headerIcon?: import('svelte').Snippet;
    children?: import('svelte').Snippet;
  }

  let { title, count, subgroupCounts, expanded = true, onToggle, headerIcon, children }: Props = $props();
</script>

{#snippet headerBadges()}
  <span class="header-badges">
    {#each subgroupCounts ?? [] as { subgroupSlug, count: c }}
      <span
        class="badge-wrapper"
        data-subgroup={subgroupSlug || undefined}
        title={subgroupSlug === '' ? title : (SUBGROUP_DISPLAY_LABELS[subgroupSlug] ?? subgroupSlug)}
      >
        <Badge value={c} />
      </span>
    {/each}
  </span>
{/snippet}

<PanelSection
  {title}
  count={subgroupCounts?.length ? undefined : count}
  {expanded}
  {onToggle}
  {headerIcon}
  variant="default"
  headerBadges={subgroupCounts?.length ? headerBadges : undefined}
>
  {#if children}
    {@render children()}
  {/if}
</PanelSection>

<style>
  .header-badges {
    display: inline-flex;
    align-items: center;
    gap: var(--pd-xs);
    flex-shrink: 0;
  }
</style>
