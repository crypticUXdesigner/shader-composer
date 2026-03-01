<script lang="ts">
  /**
   * ParameterCell — Single reusable cell shell for all parameters.
   * Layout: top row = ports + label; bottom row = mode + signal name (when connected).
   * Mode button shows only when connected (graph or audio).
   * Uses ParamCell wrapper for layout and scoped param-cell styles.
   */

  import ParamCell from './ParamCell.svelte';
  import ParamPort from './ParamPort.svelte';
  import { ModeButton } from '../../ui';
  import type { ParamPortState } from './ParamPort.svelte';
  import type { IconName } from '../../../../utils/icons';

  interface Props {
    label: string;
    showPort?: boolean;
    showModeButton?: boolean;
    modeButtonIcon?: IconName;
    portId?: string;
    portType?: string;
    nodeId?: string;
    paramName?: string;
    portState?: ParamPortState;
    signalName?: string;
    liveValue?: number;
    onModeClick?: () => void;
    onPortPointerDown?: (e: PointerEvent) => void;
    onPortDoubleClick?: (e: PointerEvent) => void;
    disabled?: boolean;
    class?: string;
    children?: import('svelte').Snippet<[]>;
  }

  let {
    label,
    showPort = true,
    showModeButton = false,
    modeButtonIcon = 'equal',
    portId = '',
    portType = 'float',
    nodeId = '',
    paramName = '',
    portState = 'default',
    signalName = '',
    liveValue = 0,
    onModeClick,
    onPortPointerDown,
    onPortDoubleClick,
    disabled = false,
    class: className = '',
    children
  }: Props = $props();

  const isConnected = $derived(
    portState === 'graph-connected' || portState === 'audio-connected'
  );

  function handleModeClick() {
    if (disabled) return;
    onModeClick?.();
  }
</script>

{#snippet portRowContent()}
  <div class="port-row">
    <ParamPort
      {portId}
      {portType}
      {nodeId}
      {paramName}
      state={portState}
      {signalName}
      showSignalName={false}
      {liveValue}
      onPointerDown={onPortPointerDown}
      onDoubleClick={onPortDoubleClick}
      {disabled}
    />
    {#if showModeButton && isConnected}
      <ModeButton
        icon={modeButtonIcon}
        connected={isConnected}
        {disabled}
        onclick={handleModeClick}
        ariaLabel={isConnected
          ? 'Parameter connected. Click to cycle mode.'
          : 'Parameter mode. Click when connected.'}
      />
    {/if}
    {#if portState === 'audio-connected' && signalName}
      <div class="signal">
        <span class="name">{signalName}</span>
        <div class="peak" role="img" aria-label="Input signal level">
          <div class="fill" style="width: {Math.max(0, Math.min(100, liveValue * 100))}%"></div>
        </div>
      </div>
    {/if}
  </div>
{/snippet}

<ParamCell
  connected={isConnected}
  {label}
  class={className}
  leftBottom={showPort ? portRowContent : undefined}
>
  {#snippet control()}
    {@render children?.()}
  {/snippet}
</ParamCell>
