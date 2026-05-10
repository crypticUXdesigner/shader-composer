<script lang="ts">
  /**
   * EditableLabel - Label that switches to an input on double-click.
   * Confirm: Enter or click outside (blur). Cancel: Esc.
   */
  import { onMount } from 'svelte';
  import { createStrictDoubleClickHandler } from '../../../utils/strictDoubleClick';
  interface Props {
    value: string;
    placeholder?: string;
    /** Shown before value in view mode only; not shown in the edit input. */
    prefix?: string;
    class?: string;
    /** Called with the new value when the user confirms (Enter or blur). */
    onCommit: (value: string) => void;
    /** Optional: called when the user cancels (Esc). */
    onCancel?: () => void;
    disabled?: boolean;
    ariaLabel?: string;
    /** When true, enters edit mode once after mount (e.g. toolbar “rename” beside the label). */
    autoEditOnMount?: boolean;
    /** Reports when switching between viewing and editing (for parent chrome such as sibling toolbars). */
    onEditingChange?: (active: boolean) => void;
    /** Forwarded to the edit `<input>` when set (omit for no limit). */
    inputMaxLength?: number;
  }

  let {
    value,
    placeholder = '',
    prefix = '',
    class: className = '',
    onCommit,
    onCancel,
    disabled = false,
    ariaLabel = 'Editable label. Double-click to edit.',
    autoEditOnMount = false,
    onEditingChange,
    inputMaxLength,
  }: Props = $props();

  let editing = $state(false);
  let editText = $state('');
  let inputEl: HTMLInputElement | undefined = $state();
  let rootEl: HTMLElement | undefined = $state();

  onMount(() => {
    if (!autoEditOnMount || disabled) return;
    queueMicrotask(() => {
      startEdit();
    });
  });

  $effect(() => {
    if (!editing) return;

    // Some clicks (notably right-click/contextmenu or clicks on non-focusable areas)
    // don't reliably cause the input to blur. Capture-phase listeners ensure we stop editing
    // as soon as the user interacts outside this component.
    function isOutsideTarget(target: EventTarget | null): boolean {
      if (!rootEl) return false;
      return !(target instanceof Node) || !rootEl.contains(target);
    }

    function onWindowPointerDown(e: PointerEvent) {
      if (isOutsideTarget(e.target)) commit();
    }

    function onWindowContextMenu(e: MouseEvent) {
      if (isOutsideTarget(e.target)) commit();
    }

    window.addEventListener('pointerdown', onWindowPointerDown, true);
    window.addEventListener('contextmenu', onWindowContextMenu, true);

    return () => {
      window.removeEventListener('pointerdown', onWindowPointerDown, true);
      window.removeEventListener('contextmenu', onWindowContextMenu, true);
    };
  });

  function startEdit() {
    if (disabled) return;
    editing = true;
    onEditingChange?.(true);
    editText = value;
    requestAnimationFrame(() => {
      inputEl?.focus();
      inputEl?.select();
    });
  }

  const strictStartEdit = createStrictDoubleClickHandler((_e: MouseEvent) => {
    startEdit();
  });

  function commit() {
    if (!editing) return;
    const trimmed = editText.trim();
    if (trimmed !== value) {
      onCommit(trimmed || value);
    }
    editing = false;
    onEditingChange?.(false);
  }

  /** Programmatic confirm (e.g. adjacent Save button). No-op if not editing. */
  export function commitEditing(): void {
    commit();
  }

  function cancel() {
    editText = value;
    editing = false;
    onEditingChange?.(false);
    onCancel?.();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      cancel();
    }
  }
</script>

<span bind:this={rootEl} class="editable-label-root">
{#if editing}
  <input
    bind:this={inputEl}
    type="text"
    class="editable-label-input {className}"
    bind:value={editText}
    onkeydown={handleKeydown}
    onblur={commit}
    aria-label={ariaLabel}
    disabled={disabled}
    maxlength={inputMaxLength ?? undefined}
  />
{:else}
  <span
    class="editable-label {className}"
    role="textbox"
    tabindex={disabled ? -1 : 0}
    onclick={strictStartEdit}
    onkeydown={(e) => !disabled && e.key === 'Enter' && startEdit()}
    aria-label="{ariaLabel}. Double-click to edit."
  >
    {prefix}{value || placeholder || '—'}
  </span>
{/if}
</span>

<style>
  .editable-label-root {
    display: inline-block;
    width: 100%;
    min-width: 0;
  }

  .editable-label,
  .editable-label-input {
    display: inline-block;
    box-sizing: border-box;
    min-width: 0;
    width: 100%;
    font-family: inherit;
    font-size: inherit;
    color: inherit;
    /* Same padding and border so view/edit switch doesn’t change layout */
    padding: var(--pd-2xs) var(--pd-xs);
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
  }

  .editable-label {
    outline: none;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: 1;
    vertical-align: middle;
    font-size: var(--text-sm);
  }

  .editable-label:focus-visible {
    outline: 2px solid var(--color-blue-90);
    outline-offset: 1px;
  }

  .editable-label-input {
    border-color: var(--color-gray-70);
    background: var(--color-gray-30);
    color: var(--color-gray-130);
    font-size: var(--text-sm);
  }

  .editable-label-input:focus {
    outline: none;
    border-color: var(--color-blue-90);
  }
</style>
