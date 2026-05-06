<script lang="ts">
  import type { NodeIconIdentifier } from '../../../utils/iconsNodeRegistry';
  import {
    PROJECT_AVATAR_COLOR_TOKENS,
    PROJECT_AVATAR_NODE_ICONS,
    projectAvatarColorVar,
    type ProjectAvatarFields,
    type ProjectAvatarColorToken,
  } from '../../storage/projectAvatar';
  import { Button, ButtonGroup, DropdownMenu, IconSvg, MenuHeader, NodeIconSvg } from '../ui';

  interface Props {
    busy: boolean;
    displayName: string;
    appearance: ProjectAvatarFields;
    onAppearanceChange: (next: ProjectAvatarFields) => void;
  }

  let { busy, displayName, appearance, onAppearanceChange }: Props = $props();

  let appearanceMenuOpen = $state(false);
  let appearanceAnchorEl: HTMLDivElement | null = $state(null);
  let appearanceColorTarget = $state<'bg' | 'icon'>('bg');

  const PROJECT_AVATAR_COLOR_CHOICES: readonly ProjectAvatarColorToken[] = PROJECT_AVATAR_COLOR_TOKENS;

  function pickIcon(id: NodeIconIdentifier): void {
    onAppearanceChange({ ...appearance, avatarNodeIcon: id });
  }

  function pickBg(token: ProjectAvatarColorToken): void {
    onAppearanceChange({ ...appearance, avatarBgToken: token });
  }

  function pickFg(token: ProjectAvatarColorToken): void {
    onAppearanceChange({ ...appearance, avatarIconColorToken: token });
  }

  function pickColor(token: ProjectAvatarColorToken): void {
    if (appearanceColorTarget === 'bg') {
      pickBg(token);
    } else {
      pickFg(token);
    }
  }

  function toggleAppearanceMenu(e: MouseEvent): void {
    e.stopPropagation();
    appearanceMenuOpen = !appearanceMenuOpen;
  }
</script>

<div bind:this={appearanceAnchorEl} class="appearance-anchor">
  <Button
    variant="ghost"
    size="sm"
    mode="icon-only"
    disabled={busy}
    type="button"
    title="Icon and colors"
    aria-label={`Icon and colors for ${displayName}`}
    aria-expanded={appearanceMenuOpen}
    onclick={toggleAppearanceMenu}
  >
    <IconSvg name="palette" variant="line" />
  </Button>
  <DropdownMenu
    open={appearanceMenuOpen}
    anchor={appearanceAnchorEl}
    openAbove={true}
    alignY="center"
    onClose={() => (appearanceMenuOpen = false)}
    class="project-list-appearance-menu"
  >
    {#snippet children()}
      <MenuHeader text="Make it pretty" />
      <div class="appearance-icon-grid-mask">
        <div class="appearance-icon-grid scrollbar-styled">
          {#each PROJECT_AVATAR_NODE_ICONS as id (id)}
            <button
              type="button"
              class="appearance-tile appearance-tile--icon"
              class:appearance-tile--selected={appearance.avatarNodeIcon === id}
              title={id}
              aria-label={id}
              onclick={() => pickIcon(id)}
            >
              <NodeIconSvg identifier={id} />
            </button>
          {/each}
        </div>
      </div>
      <ButtonGroup class="appearance-color-target" role="tablist" ariaLabel="Color target">
        <button
          type="button"
          class="appearance-target-tab"
          class:appearance-target-tab--active={appearanceColorTarget === 'bg'}
          role="tab"
          aria-selected={appearanceColorTarget === 'bg'}
          onclick={() => (appearanceColorTarget = 'bg')}
        >
          Background
        </button>
        <button
          type="button"
          class="appearance-target-tab"
          class:appearance-target-tab--active={appearanceColorTarget === 'icon'}
          role="tab"
          aria-selected={appearanceColorTarget === 'icon'}
          onclick={() => (appearanceColorTarget = 'icon')}
        >
          Symbol
        </button>
      </ButtonGroup>
      <div class="appearance-swatch-grid scrollbar-styled" role="tabpanel">
        {#each PROJECT_AVATAR_COLOR_CHOICES as token (token)}
          <button
            type="button"
            class="appearance-tile appearance-tile--swatch"
            class:appearance-tile--selected={
              appearanceColorTarget === 'bg'
                ? appearance.avatarBgToken === token
                : appearance.avatarIconColorToken === token
            }
            style:background={`color-mix(in srgb, ${projectAvatarColorVar(token)} 94%, transparent)`}
            aria-label={`${appearanceColorTarget === 'bg' ? 'Background' : 'Icon'} ${token}`}
            title={token}
            onclick={() => pickColor(token)}
          ></button>
        {/each}
      </div>
    {/snippet}
  </DropdownMenu>
</div>

<style>
  .appearance-anchor {
    position: relative;
    display: inline-flex;
    align-items: center;
  }

  :global(.dropdown-menu.project-list-appearance-menu) {
    min-width: min(17.5rem, calc(100vw - 2rem));
    max-width: min(22rem, calc(100vw - 2rem));
    z-index: var(--message-z-index);
    max-height: none !important;
    overflow-y: visible !important;
  }

  /* Modal content uses z-index 9999; lift this specific popover above it. */
  :global(.popover-base.dropdown-menu.project-list-appearance-menu) {
    z-index: 10001;
  }

  :global(.dropdown-menu.project-list-appearance-menu .menu-wrapper-inner) {
    overflow-x: hidden;
    overflow-y: visible;
  }

  .appearance-icon-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: var(--pd-2xs);
    max-height: 11rem;
    overflow-y: auto;
    padding: var(--pd-md) var(--pd-sm);
    flex-shrink: 0;
  }

  .appearance-icon-grid-mask {
    --appearance-icon-fade: 16px;
    --appearance-icon-fade-bg: var(--frame-bg);

    position: relative;
    flex-shrink: 0;
  }

  /* Prefer a real mask when available (Chromium/Firefox). */
  @supports (mask-image: linear-gradient(#000, #000)) {
    .appearance-icon-grid {
      -webkit-mask-image: linear-gradient(
        to bottom,
        transparent,
        #000 var(--appearance-icon-fade),
        #000 calc(100% - var(--appearance-icon-fade)),
        transparent
      );
      mask-image: linear-gradient(
        to bottom,
        transparent,
        #000 var(--appearance-icon-fade),
        #000 calc(100% - var(--appearance-icon-fade)),
        transparent
      );
      -webkit-mask-repeat: no-repeat;
      mask-repeat: no-repeat;
      -webkit-mask-size: 100% 100%;
      mask-size: 100% 100%;
    }
  }

  /* Fallback: overlay gradients that hint scroll without blocking interactions. */
  @supports not (mask-image: linear-gradient(#000, #000)) {
    .appearance-icon-grid-mask::before,
    .appearance-icon-grid-mask::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      height: var(--appearance-icon-fade);
      pointer-events: none;
      z-index: 1;
    }

    .appearance-icon-grid-mask::before {
      top: 0;
      background: linear-gradient(to bottom, var(--appearance-icon-fade-bg), transparent);
    }

    .appearance-icon-grid-mask::after {
      bottom: 0;
      background: linear-gradient(to top, var(--appearance-icon-fade-bg), transparent);
    }
  }

  :global(.appearance-color-target) {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--pd-2xs);
    padding: var(--pd-xs) var(--pd-sm) var(--pd-sm);
  }

  .appearance-target-tab {
    margin: 0;
    padding: var(--pd-2xs) var(--pd-sm);
    border: 1px solid color-mix(in srgb, var(--color-gray-90) 22%, transparent);
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--ghost-bg) 85%, transparent);
    color: var(--print-subtle);
    font: inherit;
    font-size: var(--text-xs);
    cursor: pointer;
    user-select: none;

    &:focus {
      outline: none;
    }

    &:focus-visible {
      outline: 2px solid var(--color-blue-90);
      outline-offset: 2px;
    }
  }

  .appearance-target-tab--active {
    background: color-mix(in srgb, var(--ghost-bg-active) 90%, transparent);
    color: var(--print-highlight);
    border-color: color-mix(in srgb, var(--color-blue-90) 35%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-blue-90) 25%, transparent);
  }

  .appearance-swatch-grid {
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    gap: var(--pd-3xs, var(--pd-2xs));
    padding: var(--pd-sm);
    flex-shrink: 0;
    max-height: none;
    overflow: visible;
  }

  .appearance-tile {
    margin: 0;
    padding: 0;
    border: 2px solid transparent;
    border-radius: var(--radius-sm);
    cursor: pointer;
    background: var(--color-gray-40);
    box-sizing: border-box;
    appearance: none;
    font: inherit;
  }

  .appearance-tile--icon {
    display: flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 1;
    padding: var(--pd-2xs);
    color: var(--color-gray-120);
  }

  .appearance-tile--icon :global(.node-icon-svg svg) {
    width: 1.25rem;
    height: 1.25rem;
  }

  .appearance-tile--swatch {
    aspect-ratio: 1;
    min-height: 0.95rem;
    border-radius: var(--radius-xs, var(--radius-sm));
  }

  .appearance-tile--selected {
    border-color: var(--print-light);
  }

</style>
