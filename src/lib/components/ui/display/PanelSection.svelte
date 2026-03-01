<script lang="ts">
  /**
   * Shared collapsible section component for panels.
   * Supports Node Panel (with count badge) and scrollable content with header actions.
   */
  import IconSvg from '../icon/IconSvg.svelte';
  import Badge from './Badge.svelte';

  type Variant = 'default' | 'scrollable' | 'tight';

  interface Props {
    title: string;
    count?: number;
    headerIcon?: import('svelte').Snippet;
    headerBadges?: import('svelte').Snippet;
    headerActions?: import('svelte').Snippet;
    expanded?: boolean;
    onToggle?: () => void;
    children?: import('svelte').Snippet;
    variant?: Variant;
    /** When false, header is static (no chevron, no toggle). Use for always-visible sections. */
    collapsible?: boolean;
  }

  let {
    title,
    count,
    headerIcon,
    headerBadges,
    headerActions,
    expanded = true,
    onToggle,
    children,
    variant = 'default',
    collapsible = true,
  }: Props = $props();
</script>

<div class="section panel-section" class:is-expanded={expanded} class:is-scrollable={variant === 'scrollable'} class:is-tight={variant === 'tight'} class:is-collapsible={collapsible}>
  <div class="header">
    {#if collapsible}
      <button
        type="button"
        class="header-btn"
        class:is-expanded={expanded}
        class:has-actions={!!headerActions}
        class:has-header-icon={variant !== 'tight' && !!headerIcon}
        onclick={onToggle}
        aria-expanded={expanded}
      >
        {#if variant !== 'tight'}
          {#if headerIcon}
            <span class="header-icon">
              {@render headerIcon()}
            </span>
          {:else}
            <IconSvg
              name={expanded ? 'chevron-down' : 'chevron-right'}
              variant="line"
              class="chevron"
            />
          {/if}
        {/if}
        <span class="title">{title}</span>
      </button>
    {:else}
      <div class="header-btn header-btn-static" class:has-actions={!!headerActions}>
        <span class="title">{title}</span>
      </div>
    {/if}
    {#if headerBadges}
      {@render headerBadges()}
    {:else if count !== undefined}
      <Badge value={count} />
    {/if}
    {#if headerActions}
      <div class="header-actions">
        {@render headerActions()}
      </div>
    {/if}
  </div>
  {#if expanded || !collapsible}
    <div class="content panel-section-content">
      {#if children}
        {@render children()}
      {/if}
    </div>
  {/if}
</div>

<style>
  /* PanelSection styles — one root .section (element also has .panel-section) */
  .section {
    /* Layout */
    display: flex;
    flex-direction: column;
    flex-shrink: 0;

    /* Box model: structural border between sections; visual from layer .frame-elevated */
    border-bottom: 1px solid var(--divider);

    &:last-child {
      border-bottom: none;
    }

    &.is-expanded.is-scrollable {
      flex: 1;
      min-height: 0;
    }

    .header {
      /* Layout */
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      gap: var(--pd-sm);

      /* Box model */
      width: 100%;
      padding: 0 var(--pd-md);

      /* Other */
      min-height: var(--size-md);
    }

    &.is-tight {
      border: none;
    }

    &.is-tight .header {
      padding-left: 0;
      padding-right: 0;
    }

    &.is-tight .header-btn::after {
      content: '';
      flex: 1;
      min-width: var(--pd-sm);
      margin-left: var(--pd-sm);
      align-self: center;
      border-bottom: 1px solid var(--divider);
    }

    .header-btn {
      /* Layout */
      display: flex;
      align-items: center;
      gap: var(--pd-sm);
      flex: 1;
      min-width: 0;

      /* Box model */
      padding: var(--pd-sm) 0;
      border: none;
      border-radius: 0;

      /* Visual */
      background: transparent;
      color: var(--print-subtle);

      /* Typography */
      font-family: inherit;
      font-size: var(--text-sm);
      font-weight: 600;
      text-align: left;

      /* Other */
      cursor: default;
      transition: color 0.15s;

      &.is-expanded {
        color: var(--print-highlight);
      }

      &:hover {
        color: var(--print-highlight);
      }

      :global(.chevron) {
        flex-shrink: 0;
        width: var(--size-md);
        height: var(--size-md);
      }

      .header-icon {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        width: var(--size-md);
        height: var(--size-md);
        color: inherit;

        :global(.node-icon-svg),
        :global(svg) {
          width: var(--icon-size-md);
          height: var(--icon-size-md);
          color: currentColor;
        }
      }

      &.has-actions .title {
        flex: 1;
        min-width: 0;
      }

      &.header-btn-static {
        cursor: default;
      }
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: var(--pd-xs);
      flex-shrink: 0;
    }

    .content {
      /* Layout */
      display: flex;
      flex-direction: column;
      gap: var(--pd-sm);

      /* Box model */
      padding: var(--pd-md) var(--pd-md);

      /* Visual */
      color: var(--print-subtle);

      /* Typography */
      font-size: var(--text-sm);
    }

    &.is-tight .content {
      padding-left: 0;
      padding-right: 0;
    }

    &.is-scrollable .content {
      flex: 1;
      min-height: 0;
      overflow-y: auto;

      /* Hide scrollbar */
      scrollbar-width: none;
      -ms-overflow-style: none;

      &::-webkit-scrollbar {
        display: none;
      }
    }
  }
</style>
