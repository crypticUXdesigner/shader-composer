<script lang="ts">
  /**
   * EditableLabel - Label that switches to an input on double-click.
   * Confirm: Enter or click outside (blur). Cancel: Esc.
   */
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
  }: Props = $props();

  let editing = $state(false);
  let editText = $state('');
  let inputEl: HTMLInputElement | undefined = $state();

  $effect(() => {
    if (!editing) {
      editText = value;
    }
  });

  function startEdit() {
    if (disabled) return;
    editing = true;
    editText = value;
    requestAnimationFrame(() => {
      inputEl?.focus();
      inputEl?.select();
    });
  }

  function commit() {
    const trimmed = editText.trim();
    if (trimmed !== value) {
      onCommit(trimmed || value);
    }
    editing = false;
  }

  function cancel() {
    editText = value;
    editing = false;
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
  />
{:else}
  <span
    class="editable-label {className}"
    role="textbox"
    tabindex={disabled ? -1 : 0}
    ondblclick={startEdit}
    onkeydown={(e) => !disabled && e.key === 'Enter' && startEdit()}
    aria-label="{ariaLabel}. Double-click to edit."
  >
    {prefix}{value || placeholder || '—'}
  </span>
{/if}

<style>
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
  }

  .editable-label:focus-visible {
    outline: 2px solid var(--color-blue-90);
    outline-offset: 1px;
  }

  .editable-label-input {
    border-color: var(--color-gray-70);
    background: var(--color-gray-30);
    color: var(--color-gray-130);
  }

  .editable-label-input:focus {
    outline: none;
    border-color: var(--color-blue-90);
  }
</style>
