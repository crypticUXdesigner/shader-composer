<script lang="ts">
  /**
   * CoordPadWithPorts - CoordPad with dual ports.
   * Layout: top row = ports + label; bottom row = mode + signal names (when connected).
   * Uses ParamCell wrapper for layout and scoped param-cell styles.
   */
  import ParamCell from './ParamCell.svelte';
  import CoordPad from './CoordPad.svelte';
  import ParamPort from './ParamPort.svelte';
  import { ModeButton, Button, IconSvg } from '../../ui';
  import type { ParamPortState } from './ParamPort.svelte';
  import type { IconName } from '../../../../utils/icons';
  interface PortGroupProps {
    label: string;
    portId: string;
    portState: ParamPortState;
    signalName: string;
    liveValue: number;
    showModeButton: boolean;
    modeButtonIcon: IconName;
    onModeClick?: () => void;
    onPortPointerDown?: (e: PointerEvent) => void;
    onPortDoubleClick?: (e: PointerEvent) => void;
    disabled: boolean;
  }

  interface Props {
    label?: string;
    x: number;
    y: number;
    valueForEditX?: number;
    valueForEditY?: number;
    minX?: number;
    maxX?: number;
    minY?: number;
    maxY?: number;
    /** 'center' (0,0 at center) or 'bottom-left' (0,0 at corner). Default center. */
    origin?: 'center' | 'bottom-left';
    step?: number;
    labelX?: string;
    labelY?: string;
    portGroupX: PortGroupProps;
    portGroupY: PortGroupProps;
    /** For DOM-based connection endpoint lookup (getParamPortPositionsFromDOM). Required so connection lines hit the port. */
    nodeId?: string;
    paramNameX?: string;
    paramNameY?: string;
    disabled?: boolean;
    class?: string;
    onChange?: (x: number, y: number) => void;
    onCommit?: (x: number, y: number) => void;
  }

  let {
    label = 'Center',
    x,
    y,
    valueForEditX,
    valueForEditY,
    minX = -2,
    maxX = 2,
    minY = -2,
    maxY = 2,
    origin = 'center',
    step = 0.1,
    labelX: _labelX = 'X',
    labelY: _labelY = 'Y',
    portGroupX,
    portGroupY,
    nodeId = '',
    paramNameX = '',
    paramNameY = '',
    disabled = false,
    class: className = '',
    onChange,
    onCommit,
  }: Props = $props();

  const isConnected = $derived(
    portGroupX.portState === 'graph-connected' ||
    portGroupX.portState === 'audio-connected' ||
    portGroupY.portState === 'graph-connected' ||
    portGroupY.portState === 'audio-connected'
  );

  const showLock1to1 = $derived(origin === 'bottom-left');
  let lockAspect1to1 = $state(false);

  function handleModeClickX() {
    if (disabled) return;
    portGroupX.onModeClick?.();
  }

  function handleModeClickY() {
    if (disabled) return;
    portGroupY.onModeClick?.();
  }
</script>

<ParamCell
  connected={isConnected}
  {label}
  class="coord-pad-with-ports {className}"
>
  {#snippet leftBottom()}
    <div class="port-row">
      <ParamPort
        portId={portGroupX.portId}
        nodeId={nodeId}
        paramName={paramNameX}
        portType="float"
        state={portGroupX.portState}
        signalName={portGroupX.signalName}
        showSignalName={false}
        liveValue={portGroupX.liveValue}
        onPointerDown={portGroupX.onPortPointerDown}
        onDoubleClick={portGroupX.onPortDoubleClick}
        {disabled}
      />
      {#if portGroupX.showModeButton}
        <ModeButton
          icon={portGroupX.modeButtonIcon}
          connected={portGroupX.portState !== 'default'}
          {disabled}
          onclick={handleModeClickX}
          ariaLabel="Center X mode"
        />
      {/if}
      {#if portGroupX.portState === 'audio-connected' && portGroupX.signalName}
        <div class="signal">
          <span class="name">{portGroupX.signalName}</span>
          <div class="peak" role="img" aria-label="X input signal level">
            <div class="fill" style="width: {Math.max(0, Math.min(100, portGroupX.liveValue * 100))}%"></div>
          </div>
        </div>
      {/if}
    </div>
    <div class="port-row">
      <ParamPort
        portId={portGroupY.portId}
        nodeId={nodeId}
        paramName={paramNameY}
        portType="float"
        state={portGroupY.portState}
        signalName={portGroupY.signalName}
        showSignalName={false}
        liveValue={portGroupY.liveValue}
        onPointerDown={portGroupY.onPortPointerDown}
        onDoubleClick={portGroupY.onPortDoubleClick}
        {disabled}
      />
      {#if portGroupY.showModeButton}
        <ModeButton
          icon={portGroupY.modeButtonIcon}
          connected={portGroupY.portState !== 'default'}
          {disabled}
          onclick={handleModeClickY}
          ariaLabel="Center Y mode"
        />
      {/if}
      {#if portGroupY.portState === 'audio-connected' && portGroupY.signalName}
        <div class="signal">
          <span class="name">{portGroupY.signalName}</span>
          <div class="peak" role="img" aria-label="Y input signal level">
            <div class="fill" style="width: {Math.max(0, Math.min(100, portGroupY.liveValue * 100))}%"></div>
          </div>
        </div>
      {/if}
    </div>
  {/snippet}
  {#snippet control()}
    {#if showLock1to1}
      <Button
        variant="secondary"
        size="md"
        mode="icon-only"
        class={lockAspect1to1 ? 'is-active' : ''}
        title={lockAspect1to1 ? 'Unlock aspect ratio (allow different X and Y)' : 'Lock aspect ratio to 1:1'}
        aria-pressed={lockAspect1to1}
        disabled={disabled}
        onclick={() => (lockAspect1to1 = !lockAspect1to1)}
      >
        <IconSvg name={lockAspect1to1 ? 'lock-access' : 'lock-access-off'} variant="line" />
      </Button>
    {/if}
    <div class="pad-wrap" class:pad-only={!showLock1to1}>
      <CoordPad
        {x}
        {y}
        valueForEditX={valueForEditX}
        valueForEditY={valueForEditY}
        {minX}
        {maxX}
        {minY}
        {maxY}
        {origin}
        lockAspect1to1={lockAspect1to1}
        {step}
        {disabled}
        {onChange}
        {onCommit}
      />
    </div>
  {/snippet}
</ParamCell>

<style>
  /* XY pad-specific: control-slot and pad-wrap. Param-cell layout from ParamCell.svelte. */
  :global(.coord-pad-with-ports .control-slot) {
    flex-direction: row;
    align-items: flex-start;
    gap: var(--pd-sm, 8px);
  }

  :global(.coord-pad-with-ports .pad-wrap.pad-only) {
    margin-left: auto;
  }
</style>
