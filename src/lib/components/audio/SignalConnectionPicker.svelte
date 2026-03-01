<script lang="ts">
  /**
   * SignalConnectionPicker - WP 12
   * Dropdown/list for "connect to signal" flow: graph outputs + named audio signals.
   * User selects one; connection is created (graph → param or virtual node → param).
   */
  import { Popover, Button, Input, IconSvg, MenuItem } from '../ui';
  import type { NodeGraph } from '../../../data-model/types';
  import type { NodeSpec } from '../../../types/nodeSpec';
  import type { NamedSignal } from '../../../utils/virtualNodes';
  import { getNamedSignalsFromAudioSetup } from '../../../utils/virtualNodes';
  import type { AudioSetup } from '../../../data-model/audioSetupTypes';
  import type { SignalSelectPayload } from '../../../types/editor';

  export type { SignalSelectPayload };

  interface Props {
    open: boolean;
    x: number;
    y: number;
    targetNodeId: string;
    targetParameter: string;
    /** Port element that opened this – avoids closing when same click opens */
    triggerElement?: HTMLElement | null;
    graph: NodeGraph;
    audioSetup: AudioSetup;
    nodeSpecs: Map<string, NodeSpec>;
    onSelect: (signal: SignalSelectPayload) => void;
    onClose: () => void;
    class?: string;
  }

  let {
    open,
    x,
    y,
    targetNodeId,
    targetParameter,
    triggerElement = null,
    graph,
    audioSetup,
    nodeSpecs,
    onSelect,
    onClose,
    class: className = ''
  }: Props = $props();

  let searchQuery = $state('');

  const allGraphOutputs = $derived(
    graph.nodes
      .filter((node) => {
        const spec = nodeSpecs.get(node.type);
        return (spec?.outputs?.length ?? 0) > 0;
      })
      .flatMap((node) => {
        const spec = nodeSpecs.get(node.type);
        if (!spec?.outputs) return [];
        const label = node.label || spec.displayName;
        return spec.outputs.map((port) => ({
          nodeId: node.id,
          port: port.name,
          label: `${label}: ${port.label ?? port.name}`,
        }));
      })
  );

  const allAudioSignals = $derived(getNamedSignalsFromAudioSetup(audioSetup));

  const query = $derived(searchQuery.trim().toLowerCase());

  const graphOutputs = $derived(
    query
      ? allGraphOutputs.filter((item) => item.label.toLowerCase().includes(query))
      : allGraphOutputs
  );

  const audioSignals = $derived(
    query
      ? allAudioSignals.filter((s) => s.name.toLowerCase().includes(query))
      : allAudioSignals
  );

  const existingConnection = $derived(
    graph.connections.find(
      (c) => c.targetNodeId === targetNodeId && c.targetParameter === targetParameter
    )
  );

  const flatItems = $derived([
    ...audioSignals.map((s) => ({ type: 'audio' as const, signal: s })),
    ...graphOutputs.map((item) => ({
      type: 'graph' as const,
      nodeId: item.nodeId,
      port: item.port,
      label: item.label
    }))
  ]);

  let selectedIndex = $state(-1);
  let searchRowRef = $state<HTMLDivElement | null>(null);
  let resultListRef = $state<HTMLDivElement | null>(null);

  function getSearchInput(): HTMLInputElement | null {
    return searchRowRef?.querySelector('input') ?? null;
  }

  function focusSearch() {
    getSearchInput()?.focus();
    selectedIndex = -1;
  }

  function focusList() {
    resultListRef?.focus();
  }

  function scrollSelectedIntoView() {
    const el = resultListRef?.querySelector(`[data-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }

  function activateSelectedItem() {
    if (selectedIndex < 0 || selectedIndex >= flatItems.length) return;
    const item = flatItems[selectedIndex];
    if (item.type === 'audio') handleSelectAudio(item.signal);
    else handleSelectGraph(item.nodeId, item.port);
  }

  function handleKeydown(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    const searchInput = getSearchInput();
    const isSearchFocused = searchInput === document.activeElement;
    const isInList = target.closest('.result-list') !== null;

    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }

    if (e.key === 'ArrowDown') {
      if (isSearchFocused) {
        e.preventDefault();
        if (flatItems.length > 0) {
          selectedIndex = 0;
          focusList();
          scrollSelectedIntoView();
        }
      } else if (isInList) {
        e.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, flatItems.length - 1);
        scrollSelectedIntoView();
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      if (isInList) {
        e.preventDefault();
        if (selectedIndex <= 0) {
          focusSearch();
        } else {
          selectedIndex -= 1;
          scrollSelectedIntoView();
        }
      }
      return;
    }

    if (e.key === 'Enter') {
      if (isInList && selectedIndex >= 0 && selectedIndex < flatItems.length) {
        e.preventDefault();
        activateSelectedItem();
      }
      return;
    }
  }

  function handleSelectGraph(nodeId: string, port: string) {
    onSelect({ type: 'graph', nodeId, port });
    onClose();
  }

  function handleSelectAudio(signal: NamedSignal) {
    onSelect({ type: 'audio', signalId: signal.id, virtualNodeId: signal.virtualNodeId });
    onClose();
  }

  function handleDisconnect() {
    if (existingConnection) {
      onSelect({ type: 'disconnect', connectionId: existingConnection.id });
      onClose();
    }
  }

  function clearSearch() {
    searchQuery = '';
    getSearchInput()?.focus();
  }

  $effect(() => {
    if (open) {
      searchQuery = '';
      selectedIndex = -1;
      // Focus search after render
      queueMicrotask(() => getSearchInput()?.focus());
    }
  });
</script>

{#snippet searchIcon()}
  <IconSvg name="search" variant="line" />
{/snippet}

{#snippet clearButton()}
  <Button
    variant="ghost"
    size="sm"
    mode="icon-only"
    title="Clear search"
    class="input-clear {searchQuery.trim() === '' ? 'is-hidden' : ''}"
    onclick={clearSearch}
    type="button"
  >
    <IconSvg name="circle-x" variant="filled" />
  </Button>
{/snippet}

<Popover
  open={open}
  x={x}
  y={y}
  triggerElement={triggerElement}
  align="start"
  onClose={onClose}
  class="signal-connection-picker {className}"
>
  <div class="content" role="menu" tabindex="-1" onkeydown={handleKeydown}>
    <div class="pinned-top">
      <div class="search-row" bind:this={searchRowRef}>
        <Input
          variant="primary"
          size="md"
          type="text"
          value={searchQuery}
          placeholder="Search..."
          oninput={(e) => { searchQuery = (e.currentTarget as HTMLInputElement).value; }}
          class="menu-input"
          leading={searchIcon}
          trailing={clearButton}
        />
      </div>
    </div>

    <div
      class="result-list"
      bind:this={resultListRef}
      tabindex="-1"
      role="listbox"
      aria-activedescendant={selectedIndex >= 0 && selectedIndex < flatItems.length
        ? `option-${selectedIndex}`
        : undefined}
    >
      {#if audioSignals.length > 0}
        <div class="section">
          <div class="section-header">Audio</div>
          {#each audioSignals as signal, i (signal.id)}
            <div data-index={i} id="option-{i}" role="option" aria-selected={selectedIndex === i}>
              <MenuItem
                label={signal.name}
                selected={selectedIndex === i}
                onclick={() => handleSelectAudio(signal)}
              />
            </div>
          {/each}
        </div>
      {/if}

      {#if graphOutputs.length > 0}
        <div class="section">
          <div class="section-header">Nodes</div>
          {#each graphOutputs as item, i (item.nodeId + item.port)}
            {@const idx = audioSignals.length + i}
            <div data-index={idx} id="option-{idx}" role="option" aria-selected={selectedIndex === idx}>
              <MenuItem
                label={item.label}
                selected={selectedIndex === idx}
                onclick={() => handleSelectGraph(item.nodeId, item.port)}
              />
            </div>
          {/each}
        </div>
      {/if}

      {#if graphOutputs.length === 0 && audioSignals.length === 0 && !existingConnection}
        <div class="empty">
          {query ? 'No matches' : 'No sources available'}
        </div>
      {/if}
    </div>

    {#if existingConnection}
      <div class="pinned-bottom">
        <div class="section disconnect-section">
          <Button
            variant="warning"
            size="sm"
            mode="label-only"
            class="disconnect-btn"
            onclick={handleDisconnect}
          >
            Disconnect
          </Button>
        </div>
      </div>
    {/if}
  </div>
</Popover>

<style>
  /* Portal content - :global required for Popover teleport */
  :global(.signal-connection-picker) {
    padding: 0 !important;

    .content {
      /* Layout */
      display: flex;
      flex-direction: column;

      /* Box model */
      min-width: 200px;
      max-width: 280px;
      max-height: 320px;

      .section {
        display: flex;
        flex-direction: column;
      }

      .pinned-top {
        flex-shrink: 0;
        padding: 0;

        .search-row {
          flex-shrink: 0;

          :global(input) {
            border-bottom-left-radius: 0;
            border-bottom-right-radius: 0;
          }
        }
      }

      .result-list {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        scrollbar-width: none;
        -ms-overflow-style: none;
        border-top: 1px solid var(--color-gray-70);
        outline: none;

        &:focus {
          outline: none;
        }

        &:focus-visible {
          outline: none;
        }

        &::-webkit-scrollbar {
          display: none;
        }

        :global(.menu-item) {
          width: 100%;
        }

        .section {
          .section-header {
            /* Box model */
            padding: var(--pd-sm) var(--pd-lg);

            /* Typography */
            font-size: var(--text-sm);
            font-weight: 600;
            color: var(--print-subtle);
          }

          &:not(:first-child) .section-header {
            border-top: 1px solid var(--color-gray-70);
          }
        }

        .empty {
          /* Box model */
          padding: var(--pd-lg);

          /* Typography */
          font-size: var(--text-sm);
          color: var(--text-muted, var(--color-gray-100));
          text-align: center;
        }
      }

      .pinned-bottom {
        flex-shrink: 0;
        border-top: 1px solid var(--color-gray-70);
        padding: var(--pd-sm);

        .disconnect-section {
          padding: 0;
          align-items: flex-end;
        }
      }
    }
  }
</style>
