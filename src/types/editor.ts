/**
 * Editor contract: shared types and bridge interfaces used by both lib (Svelte UI)
 * and ui (canvas engine). This module must not import from lib or ui.
 */

/** Canvas tool: cursor, hand, or lasso select. */
export type ToolType = 'cursor' | 'hand' | 'select';

/** Single item in a dropdown/menu used by canvas overlays (enum dropdown, etc.). */
export interface DropdownMenuItem {
  label: string;
  action: () => void;
  disabled?: boolean;
  selected?: boolean;
}

/** OKLCH color triple used by the color picker overlay bridge. */
export interface OKLCHTriple {
  l: number;
  c: number;
  h: number;
}

/** Payload when user selects a signal from the signal picker. */
export interface SignalSelectPayload {
  type: 'graph' | 'audio' | 'disconnect';
  nodeId?: string;
  port?: string;
  signalId?: string;
  virtualNodeId?: string;
  connectionId?: string;
}

/**
 * Bridge for canvas overlays (color picker, enum dropdown, signal picker, parameter/label inputs) to use
 * Svelte components. Implemented in lib; ui imports this interface only.
 */
export interface CanvasOverlayBridge {
  showParameterValueInput(
    screenX: number,
    screenY: number,
    value: number,
    size: { width: number; height: number },
    paramType: 'int' | 'float',
    onCommit: (value: number) => void,
    onCancel: () => void
  ): void;
  hideParameterValueInput(): void;
  isParameterValueInputActive(): boolean;
  showLabelEditInput(
    screenX: number,
    screenY: number,
    label: string | undefined,
    size: { width: number; height: number },
    onCommit: (label: string | undefined) => void,
    onCancel: () => void
  ): void;
  hideLabelEditInput(): void;
  isLabelEditInputActive(): boolean;
  showColorPicker(
    _nodeId: string,
    initial: OKLCHTriple,
    screenX: number,
    screenY: number,
    onApply: (l: number, c: number, h: number) => void
  ): void;
  hideColorPicker(): void;
  isColorPickerVisible(): boolean;
  showEnumDropdown(
    screenX: number,
    screenY: number,
    items: DropdownMenuItem[],
    onSelect: (value: string) => void,
    options?: { align?: 'start' | 'center'; alignY?: 'start' | 'center'; anchorToSelected?: boolean }
  ): void;
  hideEnumDropdown(): void;
  isEnumDropdownVisible(): boolean;
  showSignalPicker(
    screenX: number,
    screenY: number,
    targetNodeId: string,
    targetParameter: string,
    onSelect: (payload: SignalSelectPayload) => void,
    triggerElement?: HTMLElement | null
  ): void;
  hideSignalPicker(): void;
  isSignalPickerVisible(): boolean;
}
