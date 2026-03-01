<script lang="ts">
  import { getCategorySlug } from '../../../../utils/cssTokens';

  interface Props {
    size?: 'xs' | 'sm' | 'md';
    interactive?: boolean;
    selected?: boolean;
    category?: string;
    type?: string;
    onclick?: (e: MouseEvent) => void;
    children?: import('svelte').Snippet<[]>;
    class?: string;
    [key: string]: unknown;
  }

  let {
    size = 'sm',
    interactive = false,
    selected = false,
    category,
    type,
    onclick,
    children,
    class: className = '',
    ...restProps
  }: Props = $props();

  const { class: _omitClass, ...safeRest } = restProps as Record<string, unknown>;
  const categorySlug = $derived(category ? getCategorySlug(category) : '');
</script>

{#if interactive}
  <button
    type="button"
    class="tag {size} {categorySlug ? `category-${categorySlug}` : ''} {className || ''} {_omitClass || ''}"
    class:interactive
    class:is-selected={selected}
    data-type={type}
    {onclick}
    {...safeRest}
  >
    {@render children?.()}
  </button>
{:else}
  <span
    class="tag {size} {categorySlug ? `category-${categorySlug}` : ''} {className || ''} {_omitClass || ''}"
    class:is-selected={selected}
    data-type={type}
  >
    {@render children?.()}
  </span>
{/if}

<style>
  /* Tag styles */
  .tag {
    /* Layout */
    display: inline-flex;
    align-items: center;
    justify-content: center;

    /* Box model */
    padding: 0 var(--pd-sm);
    border: 1px solid var(--tag-border);
    border-radius: var(--radius-md);
    box-sizing: border-box;

    /* Visual */
    background: var(--tag-bg);
    color: var(--tag-color);

    /* Typography */
    font-family: inherit;
    font-weight: 400;
    letter-spacing: 0.03em;
    font-size: var(--text-xs);
    line-height: 1;

    /* Other */
    outline: none;
    transition: all 0.15s;
    --tag-color: var(--color-gray-120);
    --tag-color-hover: var(--color-gray-130);
    --tag-color-active: var(--color-gray-130);
    --tag-border: transparent;
    --tag-border-hover: var(--color-gray-90);
    --tag-border-active: var(--color-gray-100);
    --tag-bg: var(--color-gray-60);
    --tag-bg-hover: var(--color-gray-70);
    --tag-bg-active: var(--color-gray-80);

    &.xs {
      padding: 0 var(--pd-sm);
      font-size: var(--text-2xs);
      height: var(--size-xs);
    }

    &.sm {
      padding: 0 calc(var(--pd-sm) + var(--pd-2xs));
      font-size: var(--text-xs);
      height: var(--size-sm);
    }

    &.md {
      padding: var(--pd-xs) var(--pd-md);
      font-size: var(--text-sm);
      height: var(--size-md);
    }

    &.interactive {
      cursor: default;

      &:hover {
        background: var(--tag-bg-hover);
        color: var(--tag-color-hover);
        border-color: var(--tag-border-hover);
      }

      &:active {
        background: var(--tag-bg-active);
        color: var(--tag-color-active);
        border-color: var(--tag-border-active);
      }

      &.is-selected:hover {
        background: var(--tag-bg-active);
        color: var(--tag-color-active);
        border-color: var(--tag-border-active);
      }
    }

    &.is-selected,
    &.is-selected:hover {
      background: var(--tag-bg-active);
      color: var(--tag-color-active);
      border-color: var(--tag-border-active);
    }

    &.category-inputs {
    --tag-color: var(--color-blue-120);
    --tag-color-hover: var(--color-blue-130);
    --tag-color-active: var(--color-blue-130);
    --tag-border: transparent;
    --tag-border-hover: var(--color-blue-90);
    --tag-border-active: var(--color-blue-100);
    --tag-bg: var(--color-blue-60);
    --tag-bg-hover: var(--color-blue-70);
    --tag-bg-active: var(--color-blue-90);
  }

    &.category-patterns {
    --tag-color: var(--color-leaf-120);
    --tag-color-hover: var(--color-leaf-130);
    --tag-color-active: var(--color-leaf-130);
    --tag-border: transparent;
    --tag-border-hover: var(--color-leaf-90);
    --tag-border-active: var(--color-leaf-100);
    --tag-bg: var(--color-leaf-60);
    --tag-bg-hover: var(--color-leaf-70);
    --tag-bg-active: var(--color-leaf-90);
  }

    &.category-shapes {
    --tag-color: var(--color-teal-120);
    --tag-color-hover: var(--color-teal-130);
    --tag-color-active: var(--color-teal-130);
    --tag-border: transparent;
    --tag-border-hover: var(--color-teal-90);
    --tag-border-active: var(--color-teal-100);
    --tag-bg: var(--color-teal-60);
    --tag-bg-hover: var(--color-teal-70);
    --tag-bg-active: var(--color-teal-90);
  }

    &.category-sdf {
    --tag-color: var(--color-cyan-120);
    --tag-color-hover: var(--color-cyan-130);
    --tag-color-active: var(--color-cyan-130);
    --tag-border: transparent;
    --tag-border-hover: var(--color-cyan-90);
    --tag-border-active: var(--color-cyan-100);
    --tag-bg: var(--color-cyan-60);
    --tag-bg-hover: var(--color-cyan-70);
    --tag-bg-active: var(--color-cyan-90);
  }

    &.category-math {
    --tag-color: var(--color-orange-120);
    --tag-color-hover: var(--color-orange-130);
    --tag-color-active: var(--color-orange-130);
    --tag-border: transparent;
    --tag-border-hover: var(--color-orange-90);
    --tag-border-active: var(--color-orange-100);
    --tag-bg: var(--color-orange-60);
    --tag-bg-hover: var(--color-orange-70);
    --tag-bg-active: var(--color-orange-90);
  }

    &.category-utilities {
    --tag-color: var(--color-yellow-120);
    --tag-color-hover: var(--color-yellow-130);
    --tag-color-active: var(--color-yellow-130);
    --tag-border: transparent;
    --tag-border-hover: var(--color-yellow-90);
    --tag-border-active: var(--color-yellow-100);
    --tag-bg: var(--color-yellow-60);
    --tag-bg-hover: var(--color-yellow-70);
    --tag-bg-active: var(--color-yellow-90);
  }

    &.category-distort {
    --tag-color: var(--color-orange-red-120);
    --tag-color-hover: var(--color-orange-red-130);
    --tag-color-active: var(--color-orange-red-130);
    --tag-border: transparent;
    --tag-border-hover: var(--color-orange-red-90);
    --tag-border-active: var(--color-orange-red-100);
    --tag-bg: var(--color-orange-red-60);
    --tag-bg-hover: var(--color-orange-red-70);
    --tag-bg-active: var(--color-orange-red-90);
  }

    &.category-blend {
    --tag-color: var(--color-purple-120);
    --tag-color-hover: var(--color-purple-130);
    --tag-color-active: var(--color-purple-130);
    --tag-border: transparent;
    --tag-border-hover: var(--color-purple-90);
    --tag-border-active: var(--color-purple-100);
    --tag-bg: var(--color-purple-60);
    --tag-bg-hover: var(--color-purple-70);
    --tag-bg-active: var(--color-purple-90);
  }

    &.category-mask {
    --tag-color: var(--color-violet-120);
    --tag-color-hover: var(--color-violet-130);
    --tag-color-active: var(--color-violet-130);
    --tag-border: transparent;
    --tag-border-hover: var(--color-violet-90);
    --tag-border-active: var(--color-violet-100);
    --tag-bg: var(--color-violet-60);
    --tag-bg-hover: var(--color-violet-70);
    --tag-bg-active: var(--color-violet-90);
  }

    &.category-effects {
    --tag-color: var(--color-red-purple-120);
    --tag-color-hover: var(--color-red-purple-130);
    --tag-color-active: var(--color-red-purple-130);
    --tag-border: transparent;
    --tag-border-hover: var(--color-red-purple-90);
    --tag-border-active: var(--color-red-purple-100);
    --tag-bg: var(--color-red-purple-60);
    --tag-bg-hover: var(--color-red-purple-70);
    --tag-bg-active: var(--color-red-purple-90);
  }

    &.category-output {
    --tag-color: var(--color-red-120);
    --tag-color-hover: var(--color-red-130);
    --tag-color-active: var(--color-red-130);
    --tag-border: transparent;
    --tag-border-hover: var(--color-red-90);
    --tag-border-active: var(--color-red-100);
    --tag-bg: var(--color-red-60);
    --tag-bg-hover: var(--color-red-70);
    --tag-bg-active: var(--color-red-90);
  }

    &.category-audio {
    --tag-color: var(--color-cyan-120);
    --tag-color-hover: var(--color-cyan-130);
    --tag-color-active: var(--color-cyan-130);
    --tag-border: transparent;
    --tag-border-hover: var(--color-cyan-90);
    --tag-border-active: var(--color-cyan-100);
    --tag-bg: var(--color-cyan-60);
    --tag-bg-hover: var(--color-cyan-70);
    --tag-bg-active: var(--color-cyan-90);
  }

    &[data-type="float"] {
    --tag-color-active: var(--color-gray-130);
    --tag-border-active: var(--color-gray-100);
    --tag-bg-active: var(--color-gray-90);
  }

    &[data-type="vec2"] {
    --tag-color-active: var(--color-blue-gray-130);
    --tag-border-active: var(--color-blue-gray-100);
    --tag-bg-active: var(--color-blue-gray-90);
  }

    &[data-type="vec3"] {
    --tag-color-active: var(--color-teal-gray-130);
    --tag-border-active: var(--color-teal-gray-100);
    --tag-bg-active: var(--color-teal-gray-90);
  }

    &[data-type="vec4"] {
    --tag-color-active: var(--color-purple-gray-130);
    --tag-border-active: var(--color-purple-gray-100);
    --tag-bg-active: var(--color-purple-gray-90);
  }
  }

  /* Container for multiple tags (e.g. in NodePanelContent); single source of truth */
  :global(.tag-container) {
    display: flex;
    flex-wrap: wrap;
    width: 100%;
    gap: var(--pd-sm);
  }
</style>
