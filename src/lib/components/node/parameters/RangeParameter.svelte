<script lang="ts">
  /**
   * RangeParameter — ParameterCell + RangeSlider for range (low/high) params.
   * Replaces canvas RangeParameterRenderer for simple range params in grid.
   */

  import ParameterCell from './ParameterCell.svelte';
  import { RangeSlider } from '../../ui';
  import type { ParamPortState } from './ParamPort.svelte';

  interface Props {
    label: string;
    lowValue: number;
    highValue: number;
    min?: number;
    max?: number;
    step?: number;
    showPort?: boolean;
    portId?: string;
    portType?: string;
    portState?: ParamPortState;
    signalName?: string;
    liveValue?: number;
    disabled?: boolean;
    class?: string;
    onChange?: (payload: { low: number; high: number }) => void;
    onPortPointerDown?: (e: PointerEvent) => void;
  }

  let {
    label,
    lowValue,
    highValue,
    min = 0,
    max = 1,
    step = 0.01,
    showPort = false,
    portId = '',
    portType = 'float',
    portState = 'default',
    signalName = '',
    liveValue = 0,
    disabled = false,
    class: className = '',
    onChange,
    onPortPointerDown,
  }: Props = $props();
</script>

<ParameterCell
  {label}
  showPort={showPort}
  showModeButton={false}
  {portId}
  {portType}
  {portState}
  {signalName}
  {liveValue}
  {disabled}
  class="range-param {className}"
  onPortPointerDown={onPortPointerDown}
>
  <RangeSlider
    {min}
    {max}
    lowValue={lowValue}
    highValue={highValue}
    {step}
    {disabled}
    onChange={onChange}
    class="slider"
  />
</ParameterCell>

<style>
  :global(.range-param .slider) {
    width: 100%;
    min-width: 100px;
  }
</style>
