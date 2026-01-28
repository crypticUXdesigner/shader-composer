/**
 * KeyboardShortcutHandler
 * 
 * Handles keyboard shortcuts for the canvas (Delete, Backspace, Spacebar panning, etc.)
 */
export interface KeyboardShortcutContext {
  isInputActive: () => boolean;
  isDialogVisible: () => boolean;
  onDeleteSelected: () => void;
  onSpacebarStateChange?: (isPressed: boolean) => void;
  setCursor?: (cursor: string) => void;
  isPanning?: () => boolean;
  isDraggingNode?: () => boolean;
  isConnecting?: () => boolean;
}

export class KeyboardShortcutHandler {
  private isSpacePressed: boolean = false;
  private spacePressTimeout: number | null = null;
  private readonly SPACE_PAN_DELAY = 200; // ms - delay before activating pan mode
  private context?: KeyboardShortcutContext;
  private keyDownHandler?: (e: KeyboardEvent) => void;
  private keyUpHandler?: (e: KeyboardEvent) => void;

  /**
   * Initialize keyboard handlers
   */
  initialize(context: KeyboardShortcutContext): void {
    this.context = context;
    this.keyDownHandler = (e: KeyboardEvent) => this.handleKeyDown(e);
    this.keyUpHandler = (e: KeyboardEvent) => this.handleKeyUp(e);
    // Use capture phase so we run before other handlers (e.g. NodeEditor shortcuts)
    window.addEventListener('keydown', this.keyDownHandler, true);
    window.addEventListener('keyup', this.keyUpHandler, true);
  }

  /**
   * Handle keydown events
   */
  private handleKeyDown(e: KeyboardEvent): void {
    if (!this.context) return;

    // Check if user is typing in an input field
    const target = e.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

    // If dialog is visible, don't handle keyboard shortcuts (except spacebar for panning)
    if (this.context.isDialogVisible()) {
      // Only allow spacebar for panning when dialog is open
      if (e.key === ' ' || e.key === 'Space') {
        if (!this.isSpacePressed && this.spacePressTimeout === null) {
          // Activate panning immediately when dialog is open (no delay needed)
          this.isSpacePressed = true;
          // Update cursor if not already panning/dragging
          if (!this.context.isPanning?.() && !this.context.isDraggingNode?.() && !this.context.isConnecting?.()) {
            this.context.setCursor?.('grab');
          }
          // Notify that spacebar is now active for panning
          this.context.onSpacebarStateChange?.(true);
        }
        e.preventDefault(); // Prevent page scroll
      }
      return;
    }

    // Track spacebar for panning - but only activate after a delay
    // This allows quick presses to trigger playback without activating pan mode
    if (e.key === ' ' || e.key === 'Space') {
      if (!this.isSpacePressed && this.spacePressTimeout === null) {
        // Set a timeout to activate panning mode only if spacebar is held
        this.spacePressTimeout = window.setTimeout(() => {
          this.isSpacePressed = true;
          this.spacePressTimeout = null;
          // Update cursor if not already panning/dragging
          if (!this.context!.isPanning?.() && !this.context!.isDraggingNode?.() && !this.context!.isConnecting?.()) {
            this.context!.setCursor?.('grab');
          }
          // Notify that spacebar is now active for panning
          this.context!.onSpacebarStateChange?.(true);
        }, this.SPACE_PAN_DELAY);
      }
      // Don't prevent default here - let BottomBar handle playback toggle
      // Only prevent default if we're already in pan mode
      if (this.isSpacePressed) {
        e.preventDefault(); // Prevent page scroll
      }
      return;
    }

    // Don't handle Delete/Backspace when user is typing in an input field or overlay UI is active
    if (isInput || this.context.isInputActive()) {
      return;
    }

    // Delete selected nodes/connections
    if ((e.key === 'Delete' || e.key === 'Backspace') && !e.ctrlKey && !e.metaKey) {
      this.context.onDeleteSelected();
      e.preventDefault();
      e.stopPropagation();
    }
  }

  /**
   * Handle keyup events
   */
  private handleKeyUp(e: KeyboardEvent): void {
    if (!this.context) return;

    // Track spacebar release
    if (e.key === ' ' || e.key === 'Space') {
      // Cancel the timeout if spacebar was released before pan mode activated
      if (this.spacePressTimeout !== null) {
        clearTimeout(this.spacePressTimeout);
        this.spacePressTimeout = null;
      }
      const wasSpacePressed = this.isSpacePressed;
      this.isSpacePressed = false;
      // Reset cursor if not panning/dragging
      if (!this.context.isPanning?.() && !this.context.isDraggingNode?.() && !this.context.isConnecting?.()) {
        this.context.setCursor?.('default');
      }
      // Notify that spacebar is no longer active
      if (wasSpacePressed) {
        this.context.onSpacebarStateChange?.(false);
      }
      e.preventDefault();
    }
  }

  /**
   * Check if spacebar is currently pressed (for panning)
   */
  isSpacebarPressed(): boolean {
    return this.isSpacePressed;
  }

  /**
   * Cleanup keyboard handlers
   */
  dispose(): void {
    if (this.keyDownHandler) {
      window.removeEventListener('keydown', this.keyDownHandler, true);
    }
    if (this.keyUpHandler) {
      window.removeEventListener('keyup', this.keyUpHandler, true);
    }
    if (this.spacePressTimeout !== null) {
      clearTimeout(this.spacePressTimeout);
      this.spacePressTimeout = null;
    }
    this.context = undefined;
    this.keyDownHandler = undefined;
    this.keyUpHandler = undefined;
  }
}
