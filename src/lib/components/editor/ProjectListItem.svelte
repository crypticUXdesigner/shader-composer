<script lang="ts">
  import {
    projectAvatarColorVar,
    type ProjectAvatarFields,
  } from '../../storage/projectAvatar';
  import { Button, EditableLabel, IconSvg, NodeIconSvg } from '../ui';
  import ProjectAppearancePicker from './ProjectAppearancePicker.svelte';

  interface Props {
    displayName: string;
    lastModifiedFormatted: string;
    appearance: ProjectAvatarFields;
    highlighted: boolean;
    busy: boolean;
    /** When false, hides rename (e.g. compact hub rows). Default true. */
    renameable?: boolean;
    onOpen: () => void;
    onDuplicate: () => void;
    onDelete: () => void;
    onRename: (nextDisplayName: string) => void;
    onAppearanceChange: (next: ProjectAvatarFields) => void;
  }

  let {
    displayName,
    lastModifiedFormatted,
    appearance,
    highlighted,
    busy,
    renameable = true,
    onOpen,
    onDuplicate,
    onDelete,
    onRename,
    onAppearanceChange,
  }: Props = $props();

  let deleteConfirm = $state(false);
  let renamingActive = $state(false);

  const appearanceBgStyle = $derived(
    `color-mix(in srgb, ${projectAvatarColorVar(appearance.avatarBgToken)} 85%, transparent)`
  );
  const appearanceIconFg = $derived(projectAvatarColorVar(appearance.avatarIconColorToken));

  function handleOpen(): void {
    deleteConfirm = false;
    renamingActive = false;
    onOpen();
  }

  function handleDuplicate(): void {
    deleteConfirm = false;
    renamingActive = false;
    onDuplicate();
  }

  function handleDeletePrompt(): void {
    if (busy) return;
    deleteConfirm = true;
  }

  function handleConfirmDelete(): void {
    if (busy) return;
    deleteConfirm = false;
    onDelete();
  }

  function handleCancelDelete(): void {
    deleteConfirm = false;
  }

  function handleStartRename(): void {
    if (busy) return;
    deleteConfirm = false;
    renamingActive = true;
  }

  function handleRenameCommit(value: string): void {
    onRename(value.trim().slice(0, 256) || displayName.trim() || 'Untitled');
  }

  function handleEditingChange(active: boolean): void {
    if (!active) renamingActive = false;
  }

  let renameLabelRef: { commitEditing: () => void } | undefined = $state();

  function handleSaveRenameClick(e: MouseEvent): void {
    e.preventDefault();
    renameLabelRef?.commitEditing();
  }

  function handleSaveRenameMouseDown(e: MouseEvent): void {
    e.preventDefault();
  }

</script>

<li class="list-item">
  <div class="row-card project-row" class:row-card--accent={highlighted}>
    <div class="open-row">
      <button
        type="button"
        class="open-hit-icon"
        disabled={busy || renamingActive}
        onclick={() => handleOpen()}
        aria-label={`Open ${displayName}`}
      >
        <span class="icon-box" style:background={appearanceBgStyle} aria-hidden="true">
          <span class="icon-box-glyph" style:color={appearanceIconFg}>
            <NodeIconSvg identifier={appearance.avatarNodeIcon} />
          </span>
        </span>
      </button>

      {#if renamingActive}
        <div class="row-text row-text--rename">
          <div class="rename-row">
            <div class="rename-input-wrap">
              <EditableLabel
                bind:this={renameLabelRef}
                value={displayName}
                placeholder="Project name"
                ariaLabel="Project name"
                autoEditOnMount={true}
                inputMaxLength={256}
                onCommit={handleRenameCommit}
                onEditingChange={handleEditingChange}
                class="project-name-edit"
              />
            </div>
            <Button
              variant="primary"
              size="sm"
              mode="label-only"
              type="button"
              disabled={busy}
              title="Save project name"
              aria-label="Save project name"
              onmousedown={handleSaveRenameMouseDown}
              onclick={handleSaveRenameClick}
            >
              Save
            </Button>
          </div>
          <span class="meta">{lastModifiedFormatted}</span>
        </div>
      {:else}
        <button
          type="button"
          class="open-hit-main"
          disabled={busy}
          onclick={() => handleOpen()}
          aria-label={`Open ${displayName}`}
        >
          <span class="name">{displayName}</span>
          <span class="meta">{lastModifiedFormatted}</span>
        </button>
      {/if}
    </div>

    {#if !renamingActive}
      <div class="row-toolbar" role="presentation">
        {#if deleteConfirm}
          <Button
            variant="warning"
            size="sm"
            mode="label-only"
            disabled={busy}
            type="button"
            title="Delete this project permanently"
            aria-label={`Delete ${displayName} permanently`}
            onclick={handleConfirmDelete}
          >
            Delete
          </Button>
          <Button
            variant="ghost"
            size="sm"
            mode="icon-only"
            disabled={busy}
            type="button"
            title="Cancel"
            aria-label={`Cancel deleting ${displayName}`}
            onclick={handleCancelDelete}
          >
            <IconSvg name="x" variant="line" />
          </Button>
        {:else}
          <Button
            variant="ghost"
            size="sm"
            mode="icon-only"
            disabled={busy}
            type="button"
            title="Delete project"
            aria-label={`Delete ${displayName}`}
            onclick={handleDeletePrompt}
          >
            <IconSvg name="trash" variant="line" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            mode="icon-only"
            disabled={busy}
            title="Duplicate project"
            aria-label={`Duplicate ${displayName}`}
            onclick={() => handleDuplicate()}
          >
            <IconSvg name="copy" variant="line" />
          </Button>
          {#if renameable}
            <Button
              variant="ghost"
              size="sm"
              mode="icon-only"
              disabled={busy}
              type="button"
              title="Rename project"
              aria-label={`Rename ${displayName}`}
              onclick={handleStartRename}
            >
              <IconSvg name="cursor-text" variant="line" />
            </Button>
          {/if}
          <ProjectAppearancePicker
            busy={busy}
            displayName={displayName}
            appearance={appearance}
            onAppearanceChange={onAppearanceChange}
          />
        {/if}
      </div>
    {/if}
  </div>
</li>

<style>
  .list-item {
    margin: 0;
    padding: 0;
  }

  .row-card {
    display: flex;
    align-items: stretch;
    gap: var(--pd-xs);
    width: 100%;
    min-width: 0;
    padding: var(--pd-sm) var(--pd-lg) var(--pd-sm) var(--pd-sm);
    border-radius: calc(var(--radius-lg) + var(--pd-sm));
    border: none;
    background: var(--ghost-bg);
    color: var(--print-highlight);
    text-align: left;
    user-select: none;
    transition:
      background var(--motion-effects-fast-duration) var(--motion-effects-fast-easing),
      transform var(--motion-effects-fast-duration) var(--motion-effects-fast-easing),
      color var(--motion-effects-fast-duration) var(--motion-effects-fast-easing),
      box-shadow var(--motion-effects-fast-duration) var(--motion-effects-fast-easing);
  }

  .open-row {
    flex: 1;
    display: flex;
    align-items: center;
    gap: var(--pd-md);
    min-width: 0;
  }

  .open-hit-icon {
    flex-shrink: 0;
    margin: 0;
    padding: 0;
    border: none;
    border-radius: var(--radius-md);
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;

    &:focus {
      outline: none;
    }

    &:focus-visible {
      outline: 2px solid var(--color-blue-90);
      outline-offset: 2px;
    }

    &:disabled {
      opacity: var(--opacity-disabled);
      cursor: not-allowed;
      pointer-events: none;
    }
  }

  .open-hit-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--pd-2xs);
    margin: 0;
    padding: 0;
    border: none;
    border-radius: var(--radius-md);
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;

    &:focus {
      outline: none;
    }

    &:focus-visible {
      outline: 2px solid var(--color-blue-90);
      outline-offset: 2px;
    }

    &:disabled {
      opacity: var(--opacity-disabled);
      cursor: not-allowed;
      pointer-events: none;
    }
  }

  .row-toolbar {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    gap: var(--pd-2xs);
    align-self: center;
  }

  .project-row {
    flex-wrap: wrap;
  }

  .row-card--accent {
    background: var(--ghost-bg-active);
    color: var(--color-blue-110);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-blue-90) 35%, transparent);
  }

  @media (hover: hover) {
    .project-row:hover {
      transform: translateX(0.1875rem);
    }

    .project-row:not(.row-card--accent):hover {
      background: var(--ghost-bg-hover);
      color: var(--print-light);
    }

    .project-row.row-card--accent:hover {
      background: var(--ghost-bg-active);
      color: var(--color-blue-110);
    }
  }

  .project-row:focus-within {
    transform: translateX(0.1875rem);
  }

  .project-row:not(.row-card--accent):focus-within {
    background: var(--ghost-bg-hover);
    color: var(--print-light);
  }

  .project-row.row-card--accent:focus-within {
    background: var(--ghost-bg-active);
    color: var(--color-blue-110);
  }

  .row-text {
    display: flex;
    flex-direction: column;
    gap: var(--pd-2xs);
    flex: 1;
    min-width: 0;
    align-items: flex-start;
  }

  .row-text :global(.project-name-edit) {
    font-size: var(--text-sm);
    font-weight: 500;
  }

  .row-text--rename {
    justify-content: center;
    min-height: calc(var(--text-sm) * 1.4 + var(--pd-2xs) * 2);
  }

  .rename-row {
    display: flex;
    align-items: center;
    gap: var(--pd-sm);
    width: 100%;
    min-width: 0;
  }

  .rename-input-wrap {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
  }

  .rename-input-wrap :global(.editable-label-input),
  .rename-input-wrap :global(.editable-label) {
    width: 100%;
  }

  .name {
    font-size: var(--text-sm);
    font-weight: 500;
  }

  .meta {
    font-size: var(--text-xs);
    color: var(--print-default)
  }

  .icon-box {
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
    box-shadow: 0 0 0 1px var(--color-gray-20);
  }

  .icon-box-glyph {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
  }

  .icon-box-glyph :global(.node-icon-svg svg),
  .icon-box-glyph :global(svg) {
    width: 100%;
    height: 100%;
  }
</style>
