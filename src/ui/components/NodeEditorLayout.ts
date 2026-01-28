// Node Editor Layout Component
// Implements split-screen layout with collapsible shader preview

import { createIconElement } from '../../utils/icons';
import { getCSSColor, getCSSVariable } from '../../utils/cssTokens';
import { DropdownMenu, type DropdownMenuItem } from './DropdownMenu';
import { globalErrorHandler } from '../../utils/errorHandling';

export type PreviewState = 'expanded' | 'collapsed';

export interface LayoutState {
  previewState: PreviewState;
  dividerPosition: number; // 0.0 to 1.0 (percentage of viewport width)
  cornerWidgetSize: { width: number; height: number };
  cornerWidgetPosition: { x: number; y: number };
}

export class NodeEditorLayout {
  private container: HTMLElement;
  private nodeEditorContainer!: HTMLElement;
  private previewContainer!: HTMLElement;
  private divider!: HTMLElement;
  private copyButton!: HTMLElement;
  private exportButton!: HTMLElement;
  private presetButton!: HTMLElement;
  private zoomDisplay!: HTMLElement;
  private zoomValueDisplay!: HTMLElement;
  private presetDropdown!: DropdownMenu;
  private currentPresetName: string | null = null;
  private presetList: Array<{ name: string; displayName: string }> = [];
  private state: LayoutState;
  
  private isDraggingDivider: boolean = false;
  private isDraggingCornerWidget: boolean = false;
  private isResizingCornerWidget: boolean = false;
  private dragStartX: number = 0;
  private dragStartY: number = 0;
  private dragStartWidgetX: number = 0;
  private dragStartWidgetY: number = 0;
  private resizeStartWidth: number = 0;
  private resizeStartHeight: number = 0;
  private resizeObserver: ResizeObserver | null = null;
  
  // Track which corner the widget is snapped to (null if not snapped)
  // Format: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | null
  private snappedCorner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | null = null;
  
  // Edge snapping configuration
  private readonly SNAP_DISTANCE = 20; // pixels
  private readonly SAFE_DISTANCE = 16; // pixels from edges
  private readonly BUTTON_HIDE_DELAY = 2000; // milliseconds before hiding button when collapsed
  
  /**
   * Get the top bar height in pixels
   */
  private getTopBarHeight(): number {
    if (!this.buttonContainer) return 0;
    return this.buttonContainer.getBoundingClientRect().height;
  }
  
  private onCopyPreset?: () => Promise<void> | void;
  private onExport?: () => Promise<void> | void;
  private onLoadPreset?: (presetName: string) => Promise<void> | void;
  private onZoomChange?: (zoom: number) => void;
  private getZoom?: () => number;
  private onPanelToggle?: () => void;
  private buttonHideTimeout: number | null = null;
  private panelToggleButton!: HTMLElement;
  private panelToggleIcon!: SVGElement;
  private nodePanelContainer!: HTMLElement;
  private buttonContainer!: HTMLElement;
  private topBarRightSection!: HTMLElement;
  private layoutToggleButton!: HTMLElement;
  private panelWidth: number = 380;
  private isPanelVisible: boolean = true;
  private bottomBar?: { setPanelOffset: (offset: number) => void };
  private panelResizeHandle!: HTMLElement;
  private isResizingPanel: boolean = false;
  private panelResizeStartX: number = 0;
  private panelResizeStartWidth: number = 0;
  private readonly PANEL_MIN_WIDTH = 250;
  private readonly PANEL_MAX_WIDTH = 800;
  
  // FPS counter
  private fpsDisplay!: HTMLElement;
  private frameTimes: number[] = [];
  private lastFpsUpdate: number = 0;
  private readonly FPS_UPDATE_INTERVAL = 500; // Update display every 500ms
  private readonly FPS_SAMPLE_COUNT = 60; // Track last 60 frames
  
  constructor(container: HTMLElement) {
    this.container = container;
    
    // Initialize corner widget position to top-right
    const initialWidth = 320;
    const initialHeight = 240;
    const containerRect = container.getBoundingClientRect();
    const initialX = containerRect.width - initialWidth - this.SAFE_DISTANCE;
    // Top bar height will be calculated after layout is created, use placeholder for now
    const initialY = 60; // Will be updated after layout creation (top bar height is ~60px)
    
    // Initialize as snapped to top-right corner
    this.snappedCorner = 'top-right';
    
    this.state = {
      previewState: 'collapsed',
      dividerPosition: 0.5,
      cornerWidgetSize: { width: initialWidth, height: initialHeight },
      cornerWidgetPosition: { x: initialX, y: initialY }
    };
    
    this.createLayout();
    this.setupEventListeners();
    this.setupPreviewResizeObserver();
    // Update initial position with actual top bar height
    const topBarHeight = this.getTopBarHeight();
    this.state.cornerWidgetPosition.y = topBarHeight;
    this.updateLayout();
  }
  
  private setupPreviewResizeObserver(): void {
    // Watch the preview container and canvas for size changes
    // This ensures the WebGL viewport updates when the preview expands/collapses
    const triggerResize = () => {
      // Use requestAnimationFrame to ensure layout has settled
      requestAnimationFrame(() => {
        // Trigger window resize event so Renderer's setupViewport is called
        // This updates the canvas internal dimensions and WebGL viewport
        window.dispatchEvent(new Event('resize'));
      });
    };
    
    this.resizeObserver = new ResizeObserver(triggerResize);
    this.resizeObserver.observe(this.previewContainer);
    
    // Also observe the canvas directly if it exists
    const canvas = this.previewContainer.querySelector('canvas');
    if (canvas) {
      this.resizeObserver.observe(canvas);
    }
    
    // Watch for canvas being added later (e.g., when preview container is populated)
    const canvasObserver = new MutationObserver(() => {
      const canvas = this.previewContainer.querySelector('canvas');
      if (canvas && this.resizeObserver) {
        this.resizeObserver.observe(canvas);
      }
    });
    canvasObserver.observe(this.previewContainer, { childList: true, subtree: true });
  }
  
  /**
   * Set callback for copy preset button
   */
  setCopyPresetCallback(callback: () => Promise<void> | void): void {
    if (!callback) {
      globalErrorHandler.report('validation', 'error', 'setCopyPresetCallback called with null/undefined callback');
      return;
    }
    this.onCopyPreset = async () => {
      try {
        await callback();
        this.showToast('Graph copied to clipboard!', 'success');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to copy graph';
        this.showToast(errorMessage, 'error');
        globalErrorHandler.report(
          'runtime',
          'error',
          'Failed to copy graph',
          { originalError: error instanceof Error ? error : new Error(errorMessage) }
        );
      }
    };
  }
  
  /**
   * Set callback for export button
   */
  setExportCallback(callback: () => Promise<void> | void): void {
    this.onExport = async () => {
      try {
        await callback();
        this.showToast('Image exported successfully!', 'success');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to export image';
        this.showToast(errorMessage, 'error');
        globalErrorHandler.report(
          'runtime',
          'error',
          'Failed to export image',
          { originalError: error instanceof Error ? error : new Error(errorMessage) }
        );
      }
    };
  }
  

  /**
   * Set callback for preset selection
   */
  setLoadPresetCallback(callback: (presetName: string) => Promise<void> | void): void {
    this.onLoadPreset = async (presetName: string) => {
      try {
        await callback(presetName);
        this.showToast(`Loaded preset: ${presetName}`, 'success');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to load preset';
        this.showToast(errorMessage, 'error');
        globalErrorHandler.report(
          'runtime',
          'error',
          'Failed to load preset',
          { originalError: error instanceof Error ? error : new Error(errorMessage) }
        );
      }
    };
  }
  
  /**
   * Set callbacks for zoom control
   */
  setZoomCallbacks(callbacks: {
    onZoomChange?: (zoom: number) => void;
    getZoom?: () => number;
  }): void {
    this.onZoomChange = callbacks.onZoomChange;
    this.getZoom = callbacks.getZoom;
  }
  
  /**
   * Set callback for panel toggle
   */
  setPanelToggleCallback(callback: () => void): void {
    this.onPanelToggle = callback;
  }
  
  /**
   * Set panel toggle button active state
   */
  setPanelToggleActive(isActive: boolean): void {
    if (this.panelToggleButton) {
      if (isActive) {
        this.panelToggleButton.classList.add('is-active');
      } else {
        this.panelToggleButton.classList.remove('is-active');
      }
    }
    this.isPanelVisible = isActive;
    this.updatePanelToggleIcon();
    this.updateLayout();
  }
  
  /**
   * Update panel toggle icon based on panel state
   */
  private updatePanelToggleIcon(): void {
    if (!this.panelToggleButton) return;
    
    // Remove old icon if it exists
    if (this.panelToggleIcon) {
      this.panelToggleButton.removeChild(this.panelToggleIcon);
    }
    
    // Create new icon based on panel state (active = panel visible)
    const iconName = this.isPanelVisible ? 'x' : 'layout-grid';
    const variant = iconName === 'x' ? 'line' : 'filled';
    this.panelToggleIcon = createIconElement(iconName, 16, 'currentColor', undefined, variant);
    this.panelToggleButton.appendChild(this.panelToggleIcon);
  }
  
  /**
   * Get the panel container element
   */
  getPanelContainer(): HTMLElement {
    return this.nodePanelContainer;
  }
  
  /**
   * Set bottom bar reference for adjusting position
   */
  setBottomBar(bottomBar: { setPanelOffset: (offset: number) => void }): void {
    this.bottomBar = bottomBar;
  }
  
  /**
   * Update zoom display value
   */
  updateZoomDisplay(zoom: number): void {
    if (this.zoomValueDisplay) {
      const zoomPercent = Math.round(zoom * 100);
      this.zoomValueDisplay.textContent = `${zoomPercent}%`;
    }
  }
  
  /**
   * Update the preset list with available presets
   */
  async updatePresetList(presets: Array<{ name: string; displayName: string }>): Promise<void> {
    this.presetList = presets;
    // Update preset button label if a preset is currently selected
    this.updatePresetButtonLabel();
  }
  
  /**
   * Set the selected preset and update the button label
   * @param presetName - Name of the preset to select (filename without .json extension)
   */
  setSelectedPreset(presetName: string | null): void {
    this.currentPresetName = presetName;
    this.updatePresetButtonLabel();
  }
  
  /**
   * Update the preset button label to show current preset
   */
  private updatePresetButtonLabel(): void {
    if (!this.presetButton) return;
    
    const label = this.presetButton.querySelector('.top-bar-preset-button-label') as HTMLElement;
    if (label) {
      if (this.currentPresetName) {
        const preset = this.presetList.find(p => p.name === this.currentPresetName);
        const displayName = preset ? preset.displayName : this.currentPresetName;
        label.textContent = `Preset: ${displayName}`;
      } else {
        label.textContent = 'Preset: None';
      }
    }
  }
  
  /**
   * Show a toast notification
   */
  private showToast(message: string, type: 'success' | 'error'): void {
    // Remove existing toast if any
    const existingToast = document.body.querySelector('.message');
    if (existingToast) {
      existingToast.remove();
    }
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `message is-${type}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // Animate in
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        toast.classList.add('is-visible');
      });
    });
    
    // Auto-dismiss after 3 seconds
    setTimeout(() => {
      toast.classList.remove('is-visible');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.remove();
        }
      }, 300);
    }, 3000);
  }
  
  private createLayout(): void {
    // Get divider styling values (used for both divider and panel resize handle)
    const dividerBg = getCSSColor('layout-divider-bg', getCSSColor('color-gray-70', '#282b31'));
    const dividerWidth = getCSSVariable('layout-divider-width', '4px');
    
    // Create button container for top bar
    this.buttonContainer = document.createElement('div');
    this.buttonContainer.className = 'top-bar';
    this.container.appendChild(this.buttonContainer);
    
    // Create left section container
    const leftSection = document.createElement('div');
    leftSection.className = 'top-bar-left';
    this.buttonContainer.appendChild(leftSection);
    
    // Create right section container
    this.topBarRightSection = document.createElement('div');
    this.topBarRightSection.className = 'top-bar-right';
    this.buttonContainer.appendChild(this.topBarRightSection);
    
    // Initialize dropdown menus
    this.presetDropdown = new DropdownMenu();
    
    // Panel toggle button (left side - first)
    this.panelToggleButton = document.createElement('button');
    (this.panelToggleButton as HTMLButtonElement).type = 'button';
    this.panelToggleButton.className = 'button secondary md icon-only';
    this.panelToggleButton.title = 'Toggle node panel';
    // Initialize icon based on default panel state (visible by default)
    this.updatePanelToggleIcon();
    this.panelToggleButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.onPanelToggle) {
        this.onPanelToggle();
      }
    });
    leftSection.appendChild(this.panelToggleButton);
    
    // Preset button (left side - second)
    this.presetButton = document.createElement('button');
    (this.presetButton as HTMLButtonElement).type = 'button';
    this.presetButton.className = 'button secondary sm both';
    this.presetButton.title = 'Select preset';
    
    // Create button content with icon and label
    const presetIcon = createIconElement('preset', 16, 'currentColor', undefined, 'line');
    this.presetButton.appendChild(presetIcon);
    
    const presetLabel = document.createElement('span');
    presetLabel.className = 'top-bar-preset-button-label';
    presetLabel.textContent = 'Preset: None';
    this.presetButton.appendChild(presetLabel);
    
    this.presetButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = this.presetButton.getBoundingClientRect();
      const menuItems: DropdownMenuItem[] = this.presetList.map(preset => ({
        label: preset.displayName,
        action: async () => {
          if (this.onLoadPreset) {
            await this.onLoadPreset(preset.name);
          }
        }
      }));
      
      if (menuItems.length === 0) {
        menuItems.push({
          label: 'No presets available',
          action: () => {},
          disabled: true
        });
      }
      
      this.presetDropdown.show(rect.left, rect.bottom + 4, menuItems);
    });
    leftSection.appendChild(this.presetButton);
    
    // Copy button (left side - third)
    this.copyButton = document.createElement('button');
    (this.copyButton as HTMLButtonElement).type = 'button';
    this.copyButton.className = 'button secondary sm both';
    this.copyButton.title = 'Copy Preset';
    const copyIcon = createIconElement('copy', 16, 'currentColor', undefined, 'line');
    this.copyButton.appendChild(copyIcon);
    const copyLabel = document.createElement('span');
    copyLabel.textContent = 'Copy';
    this.copyButton.appendChild(copyLabel);
    this.copyButton.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.onCopyPreset) {
        await this.onCopyPreset();
      } else {
        globalErrorHandler.report('validation', 'warning', 'Copy preset callback not set yet');
        this.showToast('Copy preset not ready yet. Please try again.', 'error');
      }
    });
    leftSection.appendChild(this.copyButton);
    
    // Export button (left side - fourth)
    this.exportButton = document.createElement('button');
    (this.exportButton as HTMLButtonElement).type = 'button';
    this.exportButton.className = 'button secondary sm both';
    this.exportButton.title = 'Export Image';
    const exportIcon = createIconElement('photo', 16, 'currentColor', undefined, 'line');
    this.exportButton.appendChild(exportIcon);
    const exportLabel = document.createElement('span');
    exportLabel.textContent = 'Export';
    this.exportButton.appendChild(exportLabel);
    this.exportButton.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.onExport) {
        await this.onExport();
      } else {
        globalErrorHandler.report('validation', 'warning', 'Export callback not set yet');
        this.showToast('Export not ready yet. Please try again.', 'error');
      }
    });
    leftSection.appendChild(this.exportButton);
    
    // FPS counter (right side - first)
    this.fpsDisplay = document.createElement('div');
    this.fpsDisplay.className = 'layout-fps-display';
    this.fpsDisplay.style.cssText = `
      font-family: "JetBrains Mono", "Courier New", Courier, monospace;
      font-size: 12px;
      color: ${getCSSColor('layout-button-color', '#e0e0e0')};
      min-width: 50px;
      text-align: right;
      opacity: 0.7;
    `;
    this.fpsDisplay.textContent = '-- FPS';
    this.topBarRightSection.appendChild(this.fpsDisplay);
    
    // Zoom display button (right side - second)
    this.zoomDisplay = document.createElement('button');
    (this.zoomDisplay as HTMLButtonElement).type = 'button';
    this.zoomDisplay.className = 'button secondary sm both';
    this.zoomDisplay.title = 'Zoom';
    
    // Create button content with icon and value
    const zoomIcon = createIconElement('zoom-in', 16, 'currentColor', undefined, 'filled');
    this.zoomDisplay.appendChild(zoomIcon);
    
    this.zoomValueDisplay = document.createElement('span');
    this.zoomValueDisplay.className = 'top-bar-zoom-value-display';
    this.zoomValueDisplay.textContent = '100%';
    this.zoomDisplay.appendChild(this.zoomValueDisplay);
    
    // Single click: go to 100%
    let clickTimeout: number | null = null;
    this.zoomDisplay.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Clear any pending timeout
      if (clickTimeout !== null) {
        clearTimeout(clickTimeout);
        clickTimeout = null;
      }
      
      // Set timeout to detect if this is a single click (not double click)
      clickTimeout = window.setTimeout(() => {
        clickTimeout = null;
        // Single click: reset to 100%
        if (this.onZoomChange) {
          this.onZoomChange(1.0);
        }
      }, 250); // Wait 250ms to see if double click occurs
    });
    
    // Double click: enter custom value
    this.zoomDisplay.addEventListener('dblclick', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Clear single click timeout
      if (clickTimeout !== null) {
        clearTimeout(clickTimeout);
        clickTimeout = null;
      }
      
      // Get current zoom value
      const currentZoom = this.getZoom ? this.getZoom() : 1.0;
      const currentZoomPercent = Math.round(currentZoom * 100);
      
      // Create input element
      const input = document.createElement('input');
      input.type = 'text';
      input.value = String(currentZoomPercent);
      input.className = 'input secondary sm';
      input.style.cssText = `
        position: absolute;
        left: ${this.zoomDisplay.getBoundingClientRect().left}px;
        top: ${this.zoomDisplay.getBoundingClientRect().top}px;
        width: ${this.zoomDisplay.getBoundingClientRect().width}px;
        height: ${this.zoomDisplay.getBoundingClientRect().height}px;
        z-index: 1000;
        text-align: center;
      `;
      
      // Select all text
      input.select();
      
      // Handle input
      const handleInput = () => {
        const value = parseFloat(input.value);
        if (!isNaN(value) && value > 0) {
          const zoomValue = Math.max(0.10, Math.min(1.0, value / 100));
          if (this.onZoomChange) {
            this.onZoomChange(zoomValue);
          }
        }
        document.body.removeChild(input);
      };
      
      input.addEventListener('blur', handleInput);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleInput();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          document.body.removeChild(input);
        }
      });
      
      document.body.appendChild(input);
      input.focus();
    });
    
    this.topBarRightSection.appendChild(this.zoomDisplay);
    
    // Node panel container (left side, hidden by default)
    this.nodePanelContainer = document.createElement('div');
    this.nodePanelContainer.className = 'node-panel-container';
    // Set CSS variable for dynamic width
    this.nodePanelContainer.style.setProperty('--panel-width-dynamic', `${this.panelWidth}px`);
    this.container.appendChild(this.nodePanelContainer);
    
    // Panel resize handle (right edge of panel)
    this.panelResizeHandle = document.createElement('div');
    this.panelResizeHandle.className = 'node-panel-resize-handle';
    this.panelResizeHandle.style.cssText = `
      position: absolute;
      top: 0;
      right: 0;
      bottom: 0;
      width: ${dividerWidth};
      background: ${dividerBg};
      cursor: col-resize;
      z-index: 11;
      user-select: none;
    `;
    this.nodePanelContainer.appendChild(this.panelResizeHandle);
    
    // Node editor container (left)
    this.nodeEditorContainer = document.createElement('div');
    this.nodeEditorContainer.style.cssText = `
      position: absolute;
      left: 0;
      top: 0;
      bottom: 80px;
      overflow: hidden;
    `;
    this.container.appendChild(this.nodeEditorContainer);
    
    // Divider
    this.divider = document.createElement('div');
    this.divider.style.cssText = `
      position: absolute;
      top: 0;
      height: 100%;
      width: ${dividerWidth};
      background: ${dividerBg};
      cursor: col-resize;
      z-index: 10;
      user-select: none;
    `;
    this.container.appendChild(this.divider);
    
    // Preview container (right)
    this.previewContainer = document.createElement('div');
    const previewBg = getCSSColor('layout-preview-bg', getCSSColor('color-gray-20', '#020203'));
    this.previewContainer.style.cssText = `
      position: absolute;
      top: 0;
      height: 100%;
      overflow: hidden;
      background: ${previewBg};
    `;
    this.container.appendChild(this.previewContainer);
    
    // Expand/Collapse button – same size as panel toggle (.button.secondary.md.icon-only)
    this.layoutToggleButton = document.createElement('button');
    this.layoutToggleButton.className = 'button secondary md icon-only layout-toggle-button';
    this.layoutToggleButton.title = this.state.previewState === 'expanded' ? 'Collapse preview' : 'Expand preview';
    this.layoutToggleButton.addEventListener('click', () => this.togglePreview());
    this.previewContainer.appendChild(this.layoutToggleButton);
    this.updateToggleButtonIcon();
    
    // Setup hover listeners for auto-hide/show when collapsed
    this.setupButtonAutoHide();
  }
  
  private setupEventListeners(): void {
    // Divider drag
    this.divider.addEventListener('mousedown', (e) => {
      this.isDraggingDivider = true;
      this.dragStartX = e.clientX;
      document.addEventListener('mousemove', this.handleDividerDrag);
      document.addEventListener('mouseup', this.handleDividerDragEnd);
      e.preventDefault();
    });
    
    // Panel resize handle drag
    this.panelResizeHandle.addEventListener('mousedown', (e) => {
      this.isResizingPanel = true;
      this.panelResizeStartX = e.clientX;
      this.panelResizeStartWidth = this.panelWidth;
      document.addEventListener('mousemove', this.handlePanelResize);
      document.addEventListener('mouseup', this.handlePanelResizeEnd);
      e.preventDefault();
    });
    
    // Window resize
    window.addEventListener('resize', () => {
      this.updateLayout();
    });
    
  }
  
  private setupButtonAutoHide(): void {
    // Show button on hover when collapsed
    this.previewContainer.addEventListener('mouseenter', () => {
      if (this.state.previewState === 'collapsed') {
        this.showToggleButton();
      }
    });
    
    // Start hide timer when mouse leaves (only when collapsed)
    this.previewContainer.addEventListener('mouseleave', () => {
      if (this.state.previewState === 'collapsed') {
        this.scheduleButtonHide();
      }
    });
  }
  
  private showToggleButton(): void {
    if (!this.layoutToggleButton) return;
    this.clearButtonHideTimeout();
    this.layoutToggleButton.classList.remove('is-hidden');
  }
  
  private hideToggleButton(): void {
    if (!this.layoutToggleButton) return;
    this.layoutToggleButton.classList.add('is-hidden');
  }
  
  private scheduleButtonHide(): void {
    this.clearButtonHideTimeout();
    
    this.buttonHideTimeout = window.setTimeout(() => {
      if (this.state.previewState === 'collapsed') {
        this.hideToggleButton();
      }
      this.buttonHideTimeout = null;
    }, this.BUTTON_HIDE_DELAY);
  }
  
  private clearButtonHideTimeout(): void {
    if (this.buttonHideTimeout !== null) {
      clearTimeout(this.buttonHideTimeout);
      this.buttonHideTimeout = null;
    }
  }
  
  private handleDividerDrag = (e: MouseEvent): void => {
    if (!this.isDraggingDivider) return;
    
    const containerRect = this.container.getBoundingClientRect();
    const panelOffset = this.isPanelVisible ? this.panelWidth : 0;
    const availableWidth = containerRect.width - panelOffset;
    // Calculate position relative to available width (after panel offset)
    const newPosition = (e.clientX - containerRect.left - panelOffset) / availableWidth;
    this.state.dividerPosition = Math.max(0.2, Math.min(0.8, newPosition));
    this.updateLayout();
  };
  
  private handleDividerDragEnd = (): void => {
    this.isDraggingDivider = false;
    document.removeEventListener('mousemove', this.handleDividerDrag);
    document.removeEventListener('mouseup', this.handleDividerDragEnd);
  };
  
  private handlePanelResize = (e: MouseEvent): void => {
    if (!this.isResizingPanel) return;
    
    const deltaX = e.clientX - this.panelResizeStartX;
    const newWidth = Math.max(
      this.PANEL_MIN_WIDTH,
      Math.min(this.PANEL_MAX_WIDTH, this.panelResizeStartWidth + deltaX)
    );
    
    this.panelWidth = newWidth;
    this.nodePanelContainer.style.setProperty('--panel-width-dynamic', `${this.panelWidth}px`);
    this.updateLayout();
  };
  
  private handlePanelResizeEnd = (): void => {
    this.isResizingPanel = false;
    document.removeEventListener('mousemove', this.handlePanelResize);
    document.removeEventListener('mouseup', this.handlePanelResizeEnd);
  };
  
  private togglePreview(): void {
    const wasExpanded = this.state.previewState === 'expanded';
    this.state.previewState = wasExpanded ? 'collapsed' : 'expanded';
    
    // If transitioning to collapsed, initialize position if not set
    if (wasExpanded && this.state.previewState === 'collapsed') {
      const containerRect = this.container.getBoundingClientRect();
      const widgetWidth = this.state.cornerWidgetSize.width;
      const topBarHeight = this.getTopBarHeight();
      
      // Only initialize if position is at origin (0,0) or invalid
      if (this.state.cornerWidgetPosition.x === 0 && this.state.cornerWidgetPosition.y === 0) {
        this.state.cornerWidgetPosition.x = containerRect.width - widgetWidth - this.SAFE_DISTANCE;
        this.state.cornerWidgetPosition.y = topBarHeight; // Top-right corner (below top bar)
        this.snappedCorner = 'top-right';
      } else {
        // Check if the current position is at a corner and update snappedCorner
        const safeDist = this.SAFE_DISTANCE;
        const widgetHeight = this.state.cornerWidgetSize.height;
        const x = this.state.cornerWidgetPosition.x;
        const y = this.state.cornerWidgetPosition.y;
        const maxX = containerRect.width - widgetWidth - safeDist;
        const maxY = containerRect.height - widgetHeight - safeDist;
        
        // Check if at a corner (use topBarHeight for top edge)
        if (Math.abs(x - safeDist) < this.SNAP_DISTANCE && Math.abs(y - topBarHeight) < this.SNAP_DISTANCE) {
          this.snappedCorner = 'top-left';
        } else if (Math.abs(x - maxX) < this.SNAP_DISTANCE && Math.abs(y - topBarHeight) < this.SNAP_DISTANCE) {
          this.snappedCorner = 'top-right';
        } else if (Math.abs(x - safeDist) < this.SNAP_DISTANCE && Math.abs(y - maxY) < this.SNAP_DISTANCE) {
          this.snappedCorner = 'bottom-left';
        } else if (Math.abs(x - maxX) < this.SNAP_DISTANCE && Math.abs(y - maxY) < this.SNAP_DISTANCE) {
          this.snappedCorner = 'bottom-right';
        } else {
          this.snappedCorner = null;
        }
      }
    }
    
    this.updateToggleButtonIcon();
    this.updateLayout();
  }
  
  private updateLayout(): void {
    const containerRect = this.container.getBoundingClientRect();
    const width = containerRect.width;
    const height = containerRect.height;
    
    // Expose preview state on container for CSS (e.g. transparent topbar when expanded)
    this.container.dataset.preview = this.state.previewState;
    
    // Calculate panel offset
    const panelOffset = this.isPanelVisible ? this.panelWidth : 0;
    
    // Update panel container visibility using CSS classes
    if (this.isPanelVisible) {
      this.nodePanelContainer.classList.add('is-visible');
      // Update resize handle visibility
      if (this.panelResizeHandle) {
        this.panelResizeHandle.style.display = 'block';
      }
    } else {
      this.nodePanelContainer.classList.remove('is-visible');
      // Hide resize handle when panel is hidden
      if (this.panelResizeHandle) {
        this.panelResizeHandle.style.display = 'none';
      }
    }
    
    // Update bottom bar position
    if (this.bottomBar) {
      this.bottomBar.setPanelOffset(panelOffset);
    }
    
    // Update button container position using CSS variable
    if (this.buttonContainer) {
      this.buttonContainer.style.setProperty('--top-bar-left-offset', `${panelOffset}px`);
    }
    
    // Update toggle button icon
    this.updateToggleButtonIcon();
    
    // Handle button visibility
    if (this.state.previewState === 'expanded') {
      // Always show when expanded
      this.clearButtonHideTimeout();
      this.showToggleButton();
    } else {
      // When collapsed, show initially then schedule hide
      this.showToggleButton();
      this.scheduleButtonHide();
    }
    
    // Get top bar height for safe distance calculations
    const topBarHeight = this.getTopBarHeight();
    
    if (this.state.previewState === 'expanded') {
      // Split-screen mode
      const leftWidth = (width - panelOffset) * this.state.dividerPosition;
      const rightWidth = (width - panelOffset) * (1 - this.state.dividerPosition);
      
      // Node editor container overlays the top bar (starts at top: 0)
      this.nodeEditorContainer.style.left = `${panelOffset}px`;
      this.nodeEditorContainer.style.width = `${leftWidth}px`;
      this.nodeEditorContainer.style.display = 'block';
      this.nodeEditorContainer.style.top = `0px`;
      this.nodeEditorContainer.style.bottom = `0px`;
      
      // Divider also overlays the top bar (starts at top: 0)
      this.divider.style.left = `${panelOffset + leftWidth}px`;
      this.divider.style.top = `0px`;
      this.divider.style.height = `100%`;
      this.divider.style.display = 'block';
      
      // Preview container full height so shader is visually below/behind the topbar
      this.previewContainer.style.left = `${panelOffset + leftWidth + 4}px`;
      this.previewContainer.style.top = `0px`;
      this.previewContainer.style.width = `${rightWidth - 4}px`;
      this.previewContainer.style.height = `100%`;
      this.previewContainer.style.display = 'block';
      this.previewContainer.style.position = 'absolute';
      this.previewContainer.style.border = 'none';
      this.previewContainer.style.borderRadius = '0';
      this.previewContainer.style.cursor = 'default';
      
      // Remove resize handles when expanded
      const existingHandles = this.previewContainer.querySelectorAll('.resize-handle');
      existingHandles.forEach(h => h.remove());
      
      // Move toggle button into topbar right section so it sits with other topbar items
      if (this.layoutToggleButton && this.layoutToggleButton.parentElement !== this.topBarRightSection) {
        this.topBarRightSection.appendChild(this.layoutToggleButton);
      }
    } else {
      // Collapsed mode (corner widget)
      // Move toggle button back into preview container when collapsed
      if (this.layoutToggleButton && this.layoutToggleButton.parentElement !== this.previewContainer) {
        this.previewContainer.appendChild(this.layoutToggleButton);
      }
      // Node editor container overlays the top bar (starts at top: 0)
      this.nodeEditorContainer.style.left = `${panelOffset}px`;
      this.nodeEditorContainer.style.width = `calc(100% - ${panelOffset}px)`;
      this.nodeEditorContainer.style.display = 'block';
      this.nodeEditorContainer.style.top = `0px`;
      this.nodeEditorContainer.style.bottom = `0px`;
      
      this.divider.style.display = 'none';
      
      // Position corner widget - maintain relative position when snapped
      const widgetWidth = this.state.cornerWidgetSize.width;
      const widgetHeight = this.state.cornerWidgetSize.height;
      let widgetX = this.state.cornerWidgetPosition.x;
      let widgetY = this.state.cornerWidgetPosition.y;
      
      // If snapped to a corner, recalculate position based on that corner
      // Use top bar height for top edge, SAFE_DISTANCE for other edges
      if (this.snappedCorner) {
        const maxX = width - widgetWidth - this.SAFE_DISTANCE;
        const maxY = height - widgetHeight - this.SAFE_DISTANCE;
        
        switch (this.snappedCorner) {
          case 'top-left':
            widgetX = this.SAFE_DISTANCE;
            widgetY = topBarHeight;
            break;
          case 'top-right':
            widgetX = maxX;
            widgetY = topBarHeight;
            break;
          case 'bottom-left':
            widgetX = this.SAFE_DISTANCE;
            widgetY = maxY;
            break;
          case 'bottom-right':
            widgetX = maxX;
            widgetY = maxY;
            break;
        }
      } else {
        // Not snapped - constrain position to viewport with safe distance
        // Use top bar height for top edge, SAFE_DISTANCE for other edges
        const maxX = width - widgetWidth - this.SAFE_DISTANCE;
        const maxY = height - widgetHeight - this.SAFE_DISTANCE;
        widgetX = Math.max(this.SAFE_DISTANCE, Math.min(maxX, widgetX));
        widgetY = Math.max(topBarHeight, Math.min(maxY, widgetY));
      }
      
      // Update state with constrained position
      this.state.cornerWidgetPosition.x = widgetX;
      this.state.cornerWidgetPosition.y = widgetY;
      
      this.previewContainer.style.left = `${widgetX}px`;
      this.previewContainer.style.top = `${widgetY}px`;
      this.previewContainer.style.width = `${widgetWidth}px`;
      this.previewContainer.style.height = `${widgetHeight}px`;
      this.previewContainer.style.display = 'block';
      this.previewContainer.style.position = 'fixed';
      const previewBorder = getCSSVariable('layout-preview-border', `1px solid ${getCSSColor('color-gray-70', '#282b31')}`);
      const buttonRadius = getCSSVariable('button-radius', '4px');
      this.previewContainer.style.border = previewBorder;
      this.previewContainer.style.borderRadius = buttonRadius;
      this.previewContainer.style.zIndex = '50';
      this.previewContainer.style.cursor = 'move';
      
      // Add resize handles and drag functionality
      this.addResizeHandles();
      this.setupCornerWidgetDrag();
    }
  }
  
  private updateToggleButtonIcon(): void {
    if (!this.layoutToggleButton) return;
    this.layoutToggleButton.innerHTML = '';
    const iconName = this.state.previewState === 'expanded' ? 'arrows-minimize' : 'arrows-maximize';
    const icon = createIconElement(iconName, 0, 'currentColor', undefined, 'line');
    this.layoutToggleButton.appendChild(icon);
    this.layoutToggleButton.title = this.state.previewState === 'expanded' ? 'Collapse preview' : 'Expand preview';
    // Same active state as panel toggle: .button.is-active when maximized/expanded
    if (this.state.previewState === 'expanded') {
      this.layoutToggleButton.classList.add('is-active');
    } else {
      this.layoutToggleButton.classList.remove('is-active');
    }
  }
  
  private addResizeHandles(): void {
    // Remove existing handles
    const existingHandles = this.previewContainer.querySelectorAll('.resize-handle');
    existingHandles.forEach(h => h.remove());
    
    // Only corner handles: [position, cursor, resize direction]
    const handleConfigs: Array<{
      position: { top?: string; bottom?: string; left?: string; right?: string };
      cursor: string;
      resizeX: number; // -1: left, 0: none, 1: right
      resizeY: number; // -1: top, 0: none, 1: bottom
    }> = [
      // Top-left
      { position: { top: '0', left: '0' }, cursor: 'nwse-resize', resizeX: -1, resizeY: -1 },
      // Top-right
      { position: { top: '0', right: '0' }, cursor: 'nesw-resize', resizeX: 1, resizeY: -1 },
      // Bottom-left
      { position: { bottom: '0', left: '0' }, cursor: 'nesw-resize', resizeX: -1, resizeY: 1 },
      // Bottom-right
      { position: { bottom: '0', right: '0' }, cursor: 'nwse-resize', resizeX: 1, resizeY: 1 },
    ];
    
    handleConfigs.forEach((config) => {
      const handle = document.createElement('div');
      handle.className = 'resize-handle';
      
      const size = '16px';
      
      let style = `
        position: absolute;
        cursor: ${config.cursor};
        z-index: 10;
        width: ${size};
        height: ${size};
        background: transparent;
      `;
      
      // Position styles
      Object.entries(config.position).forEach(([key, value]) => {
        style += `${key}: ${value}; `;
      });
      
      handle.style.cssText = style;
      
      handle.addEventListener('mousedown', (e) => {
        this.isResizingCornerWidget = true;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        this.resizeStartWidth = this.state.cornerWidgetSize.width;
        this.resizeStartHeight = this.state.cornerWidgetSize.height;
        
        // Store resize direction
        (this as any)._resizeX = config.resizeX;
        (this as any)._resizeY = config.resizeY;
        (this as any)._resizeStartX = this.state.cornerWidgetPosition.x;
        (this as any)._resizeStartY = this.state.cornerWidgetPosition.y;
        
        document.addEventListener('mousemove', this.handleCornerWidgetResize);
        document.addEventListener('mouseup', this.handleCornerWidgetResizeEnd);
        e.preventDefault();
        e.stopPropagation();
      });
      
      this.previewContainer.appendChild(handle);
    });
  }
  
  private setupCornerWidgetDrag(): void {
    // Remove existing drag listeners by cloning the node (removes all event listeners)
    // But we need to preserve children, so we'll use a different approach
    // Instead, we'll check if listener already exists and use a flag
    
    // Add drag functionality to preview container
    // Use a single listener that checks the target
    const handleMouseDown = (e: MouseEvent) => {
      // Don't start drag if clicking on resize handle or close button
      const target = e.target as HTMLElement;
      if (target.closest('.resize-handle') || target.closest('button')) {
        return;
      }
      
      this.isDraggingCornerWidget = true;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      this.dragStartWidgetX = this.state.cornerWidgetPosition.x;
      this.dragStartWidgetY = this.state.cornerWidgetPosition.y;
      document.addEventListener('mousemove', this.handleCornerWidgetDrag);
      document.addEventListener('mouseup', this.handleCornerWidgetDragEnd);
      e.preventDefault();
    };
    
    // Remove old listener if it exists (we'll track it)
    if ((this.previewContainer as any)._dragHandler) {
      this.previewContainer.removeEventListener('mousedown', (this.previewContainer as any)._dragHandler);
    }
    (this.previewContainer as any)._dragHandler = handleMouseDown;
    this.previewContainer.addEventListener('mousedown', handleMouseDown);
  }
  
  private handleCornerWidgetDrag = (e: MouseEvent): void => {
    if (!this.isDraggingCornerWidget) return;
    
    const containerRect = this.container.getBoundingClientRect();
    const deltaX = e.clientX - this.dragStartX;
    const deltaY = e.clientY - this.dragStartY;
    
    let newX = this.dragStartWidgetX + deltaX;
    let newY = this.dragStartWidgetY + deltaY;
    
    // Check if we're moving away from a snapped corner
    // If moved more than snap distance, clear the snap
    const topBarHeight = this.getTopBarHeight();
    if (this.snappedCorner) {
      const safeDist = this.SAFE_DISTANCE;
      const snapDist = this.SNAP_DISTANCE;
      const widgetWidth = this.state.cornerWidgetSize.width;
      const widgetHeight = this.state.cornerWidgetSize.height;
      
      let expectedX = 0;
      let expectedY = 0;
      
      switch (this.snappedCorner) {
        case 'top-left':
          expectedX = safeDist;
          expectedY = topBarHeight;
          break;
        case 'top-right':
          expectedX = containerRect.width - widgetWidth - safeDist;
          expectedY = topBarHeight;
          break;
        case 'bottom-left':
          expectedX = safeDist;
          expectedY = containerRect.height - widgetHeight - safeDist;
          break;
        case 'bottom-right':
          expectedX = containerRect.width - widgetWidth - safeDist;
          expectedY = containerRect.height - widgetHeight - safeDist;
          break;
      }
      
      // If moved away from snapped position, clear the snap
      if (Math.abs(newX - expectedX) > snapDist || Math.abs(newY - expectedY) > snapDist) {
        this.snappedCorner = null;
      }
    }
    
    // Apply edge snapping with safe distance (using top bar height for top edge)
    const snapped = this.snapToEdges(
      newX,
      newY,
      this.state.cornerWidgetSize.width,
      this.state.cornerWidgetSize.height,
      containerRect.width,
      containerRect.height
    );
    
    this.state.cornerWidgetPosition.x = snapped.x;
    this.state.cornerWidgetPosition.y = snapped.y;
    
    this.updateLayout();
  };
  
  private handleCornerWidgetDragEnd = (): void => {
    this.isDraggingCornerWidget = false;
    document.removeEventListener('mousemove', this.handleCornerWidgetDrag);
    document.removeEventListener('mouseup', this.handleCornerWidgetDragEnd);
  };
  
  private handleCornerWidgetResize = (e: MouseEvent): void => {
    if (!this.isResizingCornerWidget) return;
    
    const containerRect = this.container.getBoundingClientRect();
    const deltaX = e.clientX - this.dragStartX;
    const deltaY = e.clientY - this.dragStartY;
    
    const resizeX = (this as any)._resizeX as number;
    const resizeY = (this as any)._resizeY as number;
    const resizeStartX = (this as any)._resizeStartX as number;
    const resizeStartY = (this as any)._resizeStartY as number;
    
    const minWidth = 160;
    const minHeight = 120;
    const maxWidth = containerRect.width * 0.5;
    const maxHeight = containerRect.height * 0.5;
    
    // Calculate new dimensions based on resize direction
    let newWidth = this.resizeStartWidth;
    let newHeight = this.resizeStartHeight;
    let newX = resizeStartX;
    let newY = resizeStartY;
    
    if (resizeX === 1) {
      // Resizing from right
      newWidth = Math.max(minWidth, Math.min(maxWidth, this.resizeStartWidth + deltaX));
    } else if (resizeX === -1) {
      // Resizing from left
      const widthDelta = -deltaX;
      const proposedWidth = this.resizeStartWidth + widthDelta;
      if (proposedWidth >= minWidth) {
        newWidth = Math.min(maxWidth, proposedWidth);
        newX = resizeStartX + deltaX;
      }
    }
    
    if (resizeY === 1) {
      // Resizing from bottom
      newHeight = Math.max(minHeight, Math.min(maxHeight, this.resizeStartHeight + deltaY));
    } else if (resizeY === -1) {
      // Resizing from top
      const heightDelta = -deltaY;
      const proposedHeight = this.resizeStartHeight + heightDelta;
      if (proposedHeight >= minHeight) {
        newHeight = Math.min(maxHeight, proposedHeight);
        newY = resizeStartY + deltaY;
      }
    }
    
    // Constrain position and size to viewport bounds (use top bar height for top edge)
    const topBarHeight = this.getTopBarHeight();
    const minX = this.SAFE_DISTANCE;
    const maxX = containerRect.width - newWidth - this.SAFE_DISTANCE;
    const minY = topBarHeight;
    const maxY = containerRect.height - newHeight - this.SAFE_DISTANCE;
    
    newX = Math.max(minX, Math.min(maxX, newX));
    newY = Math.max(minY, Math.min(maxY, newY));
    
    // Adjust width/height if position was constrained
    if (resizeX === -1 && newX === minX) {
      newWidth = containerRect.width - newX - this.SAFE_DISTANCE;
    } else if (resizeX === -1 && newX === maxX) {
      newWidth = this.resizeStartWidth;
      newX = resizeStartX;
    }
    
    if (resizeY === -1 && newY === minY) {
      newHeight = containerRect.height - newY - this.SAFE_DISTANCE;
    } else if (resizeY === -1 && newY === maxY) {
      newHeight = this.resizeStartHeight;
      newY = resizeStartY;
    }
    
    // Final size constraints
    newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
    newHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));
    
    this.state.cornerWidgetSize.width = newWidth;
    this.state.cornerWidgetSize.height = newHeight;
    this.state.cornerWidgetPosition.x = newX;
    this.state.cornerWidgetPosition.y = newY;
    
    // After resize, snap position to edges if needed
    // Note: During resize, we want to maintain the corner snap if it exists
    // So we check if we're still at a corner position
    const snapped = this.snapToEdges(
      newX,
      newY,
      newWidth,
      newHeight,
      containerRect.width,
      containerRect.height
    );
    this.state.cornerWidgetPosition.x = snapped.x;
    this.state.cornerWidgetPosition.y = snapped.y;
    
    this.updateLayout();
  };
  
  private handleCornerWidgetResizeEnd = (): void => {
    this.isResizingCornerWidget = false;
    (this as any)._resizeX = undefined;
    (this as any)._resizeY = undefined;
    (this as any)._resizeStartX = undefined;
    (this as any)._resizeStartY = undefined;
    document.removeEventListener('mousemove', this.handleCornerWidgetResize);
    document.removeEventListener('mouseup', this.handleCornerWidgetResizeEnd);
  };
  
  /**
   * Snap widget position to edges with safe distance
   * Returns the snapped position and updates the snappedCorner tracking
   */
  private snapToEdges(
    x: number,
    y: number,
    width: number,
    height: number,
    viewportWidth: number,
    viewportHeight: number
  ): { x: number; y: number } {
    const safeDist = this.SAFE_DISTANCE;
    const snapDist = this.SNAP_DISTANCE;
    const topBarHeight = this.getTopBarHeight();
    
    // Calculate distances to each edge (use top bar height for top edge)
    const distToLeft = x - safeDist;
    const distToRight = (viewportWidth - safeDist) - (x + width);
    const distToTop = y - topBarHeight;
    const distToBottom = (viewportHeight - safeDist) - (y + height);
    
    let snappedX = x;
    let snappedY = y;
    let snappedToLeft = false;
    let snappedToRight = false;
    let snappedToTop = false;
    let snappedToBottom = false;
    
    // Snap to left edge
    if (Math.abs(distToLeft) < snapDist) {
      snappedX = safeDist;
      snappedToLeft = true;
    }
    // Snap to right edge
    else if (Math.abs(distToRight) < snapDist) {
      snappedX = viewportWidth - width - safeDist;
      snappedToRight = true;
    }
    
    // Snap to top edge (below top bar)
    if (Math.abs(distToTop) < snapDist) {
      snappedY = topBarHeight;
      snappedToTop = true;
    }
    // Snap to bottom edge
    else if (Math.abs(distToBottom) < snapDist) {
      snappedY = viewportHeight - height - safeDist;
      snappedToBottom = true;
    }
    
    // Update snapped corner tracking
    if (snappedToTop && snappedToLeft) {
      this.snappedCorner = 'top-left';
    } else if (snappedToTop && snappedToRight) {
      this.snappedCorner = 'top-right';
    } else if (snappedToBottom && snappedToLeft) {
      this.snappedCorner = 'bottom-left';
    } else if (snappedToBottom && snappedToRight) {
      this.snappedCorner = 'bottom-right';
    } else {
      // Not snapped to a corner (might be snapped to one edge only, or not snapped at all)
      this.snappedCorner = null;
    }
    
    // Constrain to viewport bounds (use top bar height for top edge)
    const minX = safeDist;
    const maxX = viewportWidth - width - safeDist;
    const minY = topBarHeight;
    const maxY = viewportHeight - height - safeDist;
    
    snappedX = Math.max(minX, Math.min(maxX, snappedX));
    snappedY = Math.max(minY, Math.min(maxY, snappedY));
    
    return { x: snappedX, y: snappedY };
  }
  
  // Public API
  getNodeEditorContainer(): HTMLElement {
    return this.nodeEditorContainer;
  }
  
  getPreviewContainer(): HTMLElement {
    return this.previewContainer;
  }
  
  setPreviewState(state: PreviewState): void {
    this.state.previewState = state;
    this.updateLayout();
  }
  
  getState(): LayoutState {
    return { ...this.state };
  }
  
  /**
   * Update FPS counter (called from animation loop)
   */
  updateFPS(frameTime: number): void {
    // Add current frame time
    this.frameTimes.push(frameTime);
    
    // Keep only last N samples
    if (this.frameTimes.length > this.FPS_SAMPLE_COUNT) {
      this.frameTimes.shift();
    }
    
    // Update display at intervals (not every frame)
    const now = performance.now();
    if (now - this.lastFpsUpdate >= this.FPS_UPDATE_INTERVAL) {
      this.lastFpsUpdate = now;
      
      if (this.frameTimes.length < 2) {
        this.fpsDisplay.textContent = '-- FPS';
        return;
      }
      
      // Calculate average frame time
      const avgFrameTime = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
      
      // Calculate FPS (1000ms / frameTime)
      const fps = 1000 / avgFrameTime;
      
      // Display with 1 decimal place
      this.fpsDisplay.textContent = `${fps.toFixed(1)} FPS`;
      
      // Color code based on performance
      const goodColor = getCSSColor('fps-color-good', getCSSColor('color-teal-90', '#2f8a6b'));
      const moderateColor = getCSSColor('fps-color-moderate', getCSSColor('color-yellow-90', '#84791e'));
      const poorColor = getCSSColor('fps-color-poor', getCSSColor('color-red-90', '#c44748'));
      
      if (fps >= 55) {
        this.fpsDisplay.style.color = goodColor;
      } else if (fps >= 30) {
        this.fpsDisplay.style.color = moderateColor;
      } else {
        this.fpsDisplay.style.color = poorColor;
      }
    }
  }
}
