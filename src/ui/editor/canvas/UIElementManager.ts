/**
 * UIElementManager
 *
 * Manages UI elements overlaying the canvas (input fields, dropdowns, color picker).
 * Uses Svelte components via overlayBridge when provided; otherwise enum/color picker are no-ops.
 */
import type {
  DropdownMenuItem,
  CanvasOverlayBridge,
  OKLCHTriple,
  SignalSelectPayload,
} from '../../../types/editor';

export interface UIElementContext {
  getCanvas: () => HTMLCanvasElement;
  getZoom: () => number;
  getPanZoom: () => { panX: number; panY: number; zoom: number };
  screenToCanvas: (screenX: number, screenY: number) => { x: number; y: number };
  canvasToScreen: (canvasX: number, canvasY: number) => { x: number; y: number };
}

export class UIElementManager {
  private context?: UIElementContext;
  private overlayBridge?: CanvasOverlayBridge;

  constructor(overlayBridge?: CanvasOverlayBridge) {
    this.overlayBridge = overlayBridge;
  }

  /**
   * Set the context for UI element management
   */
  setContext(context: UIElementContext): void {
    this.context = context;
  }

  /**
   * Create and show parameter input field (via overlay bridge using Svelte Input component).
   * @param paramType - When provided, formats the initial value to match node UI: 'int' = whole number, 'float' = max 3 decimals.
   */
  showParameterInput(
    _nodeId: string,
    _paramName: string,
    value: number,
    position: { x: number; y: number },
    size: { width: number; height: number },
    onCommit: (value: number) => void,
    onCancel: () => void,
    paramType?: 'int' | 'float'
  ): void {
    if (!this.context) return;

    this.hideParameterInput();

    const zoom = this.context.getZoom();
    const screenPos = this.context.canvasToScreen(position.x, position.y);
    const screenWidth = Math.max(size.width * zoom, 140);
    const screenHeight = size.height * zoom;

    if (this.overlayBridge) {
      this.overlayBridge.showParameterValueInput(
        screenPos.x,
        screenPos.y,
        value,
        { width: screenWidth, height: screenHeight },
        paramType === 'int' || paramType === 'float' ? paramType : 'float',
        onCommit,
        onCancel
      );
      return;
    }

    // Fallback when no bridge (e.g. tests): no-op; overlay requires Svelte bridge
  }

  /**
   * Hide parameter input field
   */
  hideParameterInput(): void {
    this.overlayBridge?.hideParameterValueInput();
  }

  /**
   * Check if parameter input is active
   */
  isParameterInputActive(): boolean {
    return this.overlayBridge?.isParameterValueInputActive() ?? false;
  }

  /**
   * Create and show label input field (via overlay bridge using Svelte Input component).
   */
  showLabelInput(
    _nodeId: string,
    label: string | undefined,
    _position: { x: number; y: number },
    size: { width: number; height: number },
    onCommit: (label: string | undefined) => void,
    onCancel: () => void
  ): void {
    if (!this.context) return;

    this.hideLabelInput();

    const zoom = this.context.getZoom();
    const canvas = this.context.getCanvas();
    const rect = canvas.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const screenWidth = Math.max(size.width * zoom, 120);
    const screenHeight = size.height * zoom;

    if (this.overlayBridge) {
      this.overlayBridge.showLabelEditInput(
        centerX,
        centerY,
        label,
        { width: screenWidth, height: screenHeight },
        onCommit,
        onCancel
      );
      return;
    }

    // Fallback when no bridge (e.g. tests): no-op; overlay requires Svelte bridge
  }

  /**
   * Hide label input field
   */
  hideLabelInput(): void {
    this.overlayBridge?.hideLabelEditInput();
  }

  /**
   * Check if label input is active
   */
  isLabelInputActive(): boolean {
    return this.overlayBridge?.isLabelEditInputActive() ?? false;
  }

  /**
   * Show enum dropdown menu (via overlayBridge; no-op if bridge not provided).
   */
  showEnumDropdown(
    screenX: number,
    screenY: number,
    items: DropdownMenuItem[],
    onSelect: (value: string) => void,
    options?: { align?: 'start' | 'center'; alignY?: 'start' | 'center'; anchorToSelected?: boolean }
  ): void {
    if (!this.context) return;
    if (this.overlayBridge) {
      this.overlayBridge.showEnumDropdown(screenX, screenY, items, onSelect, options);
    }
  }

  /**
   * Hide enum dropdown
   */
  hideEnumDropdown(): void {
    this.overlayBridge?.hideEnumDropdown();
  }

  /**
   * Check if enum dropdown is visible
   */
  isEnumDropdownVisible(): boolean {
    return this.overlayBridge?.isEnumDropdownVisible() ?? false;
  }

  /**
   * Show color picker popover (via overlayBridge; no-op if bridge not provided).
   */
  showColorPicker(
    nodeId: string,
    initial: OKLCHTriple,
    screenX: number,
    screenY: number,
    onApply: (l: number, c: number, h: number) => void
  ): void {
    this.overlayBridge?.showColorPicker(nodeId, initial, screenX, screenY, onApply);
  }

  /**
   * Hide color picker popover
   */
  hideColorPicker(): void {
    this.overlayBridge?.hideColorPicker();
  }

  /**
   * Check if color picker is visible
   */
  isColorPickerVisible(): boolean {
    return this.overlayBridge?.isColorPickerVisible() ?? false;
  }

  /**
   * Show signal connection picker (graph outputs + audio signals).
   * Delegates to overlayBridge when provided.
   */
  showSignalPicker(
    screenX: number,
    screenY: number,
    targetNodeId: string,
    targetParameter: string,
    onSelect: (payload: SignalSelectPayload) => void
  ): void {
    if (this.overlayBridge) {
      this.overlayBridge.showSignalPicker(screenX, screenY, targetNodeId, targetParameter, onSelect);
    }
  }

  /**
   * Hide signal picker
   */
  hideSignalPicker(): void {
    if (this.overlayBridge) {
      this.overlayBridge.hideSignalPicker();
    }
  }

  /**
   * Check if signal picker is visible
   */
  isSignalPickerVisible(): boolean {
    if (this.overlayBridge) {
      return this.overlayBridge.isSignalPickerVisible();
    }
    return false;
  }

  /**
   * Check if any UI element is active
   */
  isAnyUIActive(): boolean {
    return (
      this.isParameterInputActive() ||
      this.isLabelInputActive() ||
      this.isEnumDropdownVisible() ||
      this.isColorPickerVisible() ||
      this.isSignalPickerVisible()
    );
  }

  /**
   * Hide all UI elements
   */
  hideAll(): void {
    this.hideParameterInput();
    this.hideLabelInput();
    this.hideEnumDropdown();
    this.hideColorPicker();
    this.hideSignalPicker();
  }

  /**
   * Hide all UI elements except the audio signal picker.
   * Use when user clicks on canvas so that the signal picker stays open (close via Done or Escape only).
   */
  hideAllExceptSignalPicker(): void {
    this.hideParameterInput();
    this.hideLabelInput();
    this.hideEnumDropdown();
    this.hideColorPicker();
    // Intentionally do not hide signal picker
  }

  /**
   * Cleanup all UI elements
   */
  dispose(): void {
    this.hideAll();
    this.context = undefined;
  }
}
