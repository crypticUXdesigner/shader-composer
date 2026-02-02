// Bottom Bar Component
// Global controls bar at the bottom of the application

import { createIconElement } from '../../utils/icons';

export type ToolType = 'cursor' | 'hand' | 'select';

export interface BottomBarCallbacks {
  onPlayToggle?: () => void;
  onTimeChange?: (time: number) => void;
  getState?: () => { isPlaying: boolean; currentTime: number; duration: number } | null;
  onToolChange?: (tool: ToolType) => void;
  onSpacebarStateChange?: (isPressed: boolean) => void;
}

export class BottomBar {
  private container: HTMLElement;
  private bottomBar!: HTMLElement;
  private playButton!: HTMLElement;
  private timeSlider!: HTMLInputElement;
  private timeDisplay!: HTMLElement;
  private toolSelector!: HTMLElement;
  private activeTool: ToolType = 'cursor';
  private isSpacebarPressed: boolean = false;
  
  private callbacks: BottomBarCallbacks = {};
  private audioUpdateInterval: number | null = null;
  private isDraggingTimeSlider: boolean = false;
  private spacebarPressTime: number | null = null;
  private readonly SPACE_PRESS_THRESHOLD = 200; // ms - max duration for a "click" vs "hold"
  
  constructor(container: HTMLElement) {
    this.container = container;
    this.createBottomBar();
    this.setupKeyboardShortcuts();
  }
  
  /**
   * Set callbacks for bottom bar controls
   */
  setCallbacks(callbacks: BottomBarCallbacks): void {
    this.callbacks = callbacks;
    
    // Start updating UI if we have a state getter
    if (this.callbacks.getState) {
      this.startAudioUIUpdates();
    }
  }
  
  /**
   * Set left offset for panel (when panel is open)
   */
  setPanelOffset(offset: number): void {
    this.bottomBar.style.left = `${offset}px`;
  }
  
  /**
   * Get the active tool
   */
  getActiveTool(): ToolType {
    return this.activeTool;
  }
  
  /**
   * Get the bottom bar element
   */
  getElement(): HTMLElement {
    return this.bottomBar;
  }
  
  /**
   * Destroy the bottom bar and clean up
   */
  destroy(): void {
    if (this.audioUpdateInterval) {
      clearInterval(this.audioUpdateInterval);
      this.audioUpdateInterval = null;
    }
    if (this.bottomBar && this.bottomBar.parentNode) {
      this.bottomBar.parentNode.removeChild(this.bottomBar);
    }
  }
  
  private createBottomBar(): void {
    // Bottom bar container
    this.bottomBar = document.createElement('div');
    this.bottomBar.className = 'bottom-bar';
    this.container.appendChild(this.bottomBar);
    
    // Left section: Play/Pause button and scrubber
    const leftSection = document.createElement('div');
    leftSection.className = 'section';
    
    // Primary play/pause button (component .button; layout overrides size to xl)
    this.playButton = document.createElement('button');
    (this.playButton as HTMLButtonElement).type = 'button';
    this.playButton.className = 'button primary lg icon-only rounded bottom-bar-play-button';
    this.playButton.title = 'Play/Pause all audio (Space)';
    this.updatePlayButtonIcon(false);
    this.playButton.addEventListener('click', () => {
      this.callbacks.onPlayToggle?.();
    });
    leftSection.appendChild(this.playButton);
    
    // Scrubber container
    const scrubberContainer = document.createElement('div');
    scrubberContainer.className = 'scrubber-container';
    
    // Time scrubber slider
    this.timeSlider = document.createElement('input');
    this.timeSlider.type = 'range';
    this.timeSlider.min = '0';
    this.timeSlider.max = '100';
    this.timeSlider.value = '0';
    this.timeSlider.className = 'slider';
    this.updateSliderProgress(); // Set initial value
    
    this.timeSlider.addEventListener('mousedown', () => {
      this.isDraggingTimeSlider = true;
    });
    this.timeSlider.addEventListener('mouseup', () => {
      this.isDraggingTimeSlider = false;
    });
    this.timeSlider.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      const percent = parseFloat(target.value);
      this.updateSliderProgress(); // Update CSS variable
      if (this.callbacks.getState) {
        const state = this.callbacks.getState();
        if (state) {
          const time = (percent / 100) * state.duration;
          this.callbacks.onTimeChange?.(time);
        }
      }
    });
    scrubberContainer.appendChild(this.timeSlider);
    
    // Combined time display (right side) - shows "current / total"
    this.timeDisplay = document.createElement('div');
    this.timeDisplay.className = 'time-display';
    this.timeDisplay.textContent = '0:00 / 0:00';
    scrubberContainer.appendChild(this.timeDisplay);
    leftSection.appendChild(scrubberContainer);
    this.bottomBar.appendChild(leftSection);
    
    // Right section: Tool selector
    const rightSection = document.createElement('div');
    rightSection.className = 'section';
    
    // Tool selector
    this.toolSelector = document.createElement('div');
    this.toolSelector.className = 'tool-selector';
    this.createToolButtons();
    rightSection.appendChild(this.toolSelector);
    this.bottomBar.appendChild(rightSection);
  }
  
  private createToolButtons(): void {
    const tools: Array<{ id: ToolType, icon: 'mouse-pointer' | 'hand' | 'lasso', shortcut: string, label: string }> = [
      { id: 'cursor', icon: 'mouse-pointer', shortcut: 'V', label: 'Cursor' },
      { id: 'hand', icon: 'hand', shortcut: 'H', label: 'Hand' },
      { id: 'select', icon: 'lasso', shortcut: 'S', label: 'Select' }
    ];
    
    tools.forEach(tool => {
      const button = document.createElement('button');
      (button as HTMLButtonElement).type = 'button';
      button.className = 'button ghost sm both';
      button.setAttribute('data-tool', tool.id);
      button.title = `${tool.label} (${tool.shortcut})`;
      
      const isActive = this.activeTool === tool.id;
      if (isActive) {
        button.classList.add('is-active');
      }
      
      // Icon - use currentColor so it inherits from CSS
      // Variant is auto-selected by createIconElement based on icon name
      // Size is controlled via CSS (.tool-selector .button > svg), not via JS parameter
      const icon = createIconElement(tool.icon, 0, 'currentColor', undefined);
      button.appendChild(icon);
      
      // Shortcut label
      const shortcutLabel = document.createElement('span');
      shortcutLabel.textContent = tool.shortcut;
      button.appendChild(shortcutLabel);
      
      button.addEventListener('click', () => {
        this.setActiveTool(tool.id);
      });
      
      this.toolSelector.appendChild(button);
    });
  }
  
  private setActiveTool(tool: ToolType): void {
    this.activeTool = tool;
    this.updateToolButtonStates();
    
    // Notify callback
    this.callbacks.onToolChange?.(tool);
  }
  
  /**
   * Update tool button visual states
   */
  private updateToolButtonStates(): void {
    const buttons = this.toolSelector.querySelectorAll('.button[data-tool]');
    buttons.forEach(btn => {
      const toolId = (btn as HTMLElement).getAttribute('data-tool');
      const button = btn as HTMLElement;
      
      // Tool is active if it's the selected tool OR if spacebar is pressed and it's the hand tool
      const isActive = toolId === this.activeTool || (this.isSpacebarPressed && toolId === 'hand');
      
      if (isActive) {
        button.classList.add('is-active');
      } else {
        button.classList.remove('is-active');
      }
    });
  }
  
  /**
   * Set spacebar pressed state (for visual feedback)
   */
  public setSpacebarPressed(isPressed: boolean): void {
    if (this.isSpacebarPressed !== isPressed) {
      this.isSpacebarPressed = isPressed;
      this.updateToolButtonStates();
    }
  }
  
  private setupKeyboardShortcuts(): void {
    window.addEventListener('keydown', (e) => {
      // Track spacebar press time (for play/pause on keyup)
      if (e.key === ' ' || e.key === 'Space') {
        const target = e.target as HTMLElement;
        const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
        
        if (!isInput && !e.repeat && this.spacebarPressTime === null) {
          // Record when spacebar was pressed
          this.spacebarPressTime = Date.now();
        }
      }
      
      // Tool shortcuts
      if (e.key === 'v' || e.key === 'V') {
        if (!e.ctrlKey && !e.metaKey) {
          const target = e.target as HTMLElement;
          const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
          if (!isInput) {
            e.preventDefault();
            this.setActiveTool('cursor');
          }
        }
      } else if (e.key === 'h' || e.key === 'H') {
        if (!e.ctrlKey && !e.metaKey) {
          const target = e.target as HTMLElement;
          const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
          if (!isInput) {
            e.preventDefault();
            this.setActiveTool('hand');
          }
        }
      } else if (e.key === 's' || e.key === 'S') {
        if (!e.ctrlKey && !e.metaKey) {
          const target = e.target as HTMLElement;
          const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
          if (!isInput) {
            e.preventDefault();
            this.setActiveTool('select');
          }
        }
      }
    });
    
    window.addEventListener('keyup', (e) => {
      // Spacebar handler for play/pause - only trigger if it was a short press
      if (e.key === ' ' || e.key === 'Space') {
        const target = e.target as HTMLElement;
        const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
        
        if (!isInput && this.spacebarPressTime !== null) {
          const pressDuration = Date.now() - this.spacebarPressTime;
          
          // Only trigger playback if the press was short enough (quick click, not a hold)
          if (pressDuration < this.SPACE_PRESS_THRESHOLD) {
            e.preventDefault();
            this.callbacks.onPlayToggle?.();
          }
          
          // Reset press time
          this.spacebarPressTime = null;
        }
      }
    });
  }
  
  /**
   * Start periodic updates for audio UI
   */
  private startAudioUIUpdates(): void {
    if (this.audioUpdateInterval) {
      clearInterval(this.audioUpdateInterval);
    }
    
    this.audioUpdateInterval = window.setInterval(() => {
      if (this.callbacks.getState) {
        const state = this.callbacks.getState();
        if (state) {
          this.updatePlayButtonIcon(state.isPlaying);
          this.updateTimeDisplay(state.currentTime, state.duration);
          this.updateTimeSlider(state.currentTime, state.duration);
        } else {
          // No audio loaded
          this.updatePlayButtonIcon(false);
          this.timeDisplay.textContent = '0:00 / 0:00';
          this.timeSlider.value = '0';
          this.timeSlider.max = '100';
        }
      }
    }, 100); // Update every 100ms
  }
  
  /**
   * Update play button icon
   */
  private updatePlayButtonIcon(isPlaying: boolean): void {
    this.playButton.innerHTML = '';
    const iconName = isPlaying ? 'pause' : 'play';
    // Use currentColor so it inherits from CSS; size via .bottom-bar-play-button > svg
    const icon = createIconElement(iconName, 0, 'currentColor', undefined, 'filled');
    this.playButton.appendChild(icon);
  }
  
  /**
   * Update time display
   */
  private updateTimeDisplay(currentTime: number, duration: number): void {
    const formatTime = (seconds: number): string => {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };
    this.timeDisplay.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
  }
  
  /**
   * Update CSS variable for slider progress (filled portion)
   */
  private updateSliderProgress(): void {
    const min = parseFloat(this.timeSlider.min) || 0;
    const max = parseFloat(this.timeSlider.max) || 100;
    const value = parseFloat(this.timeSlider.value) || 0;
    const percent = max > min ? Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100)) : 0;
    this.timeSlider.style.setProperty('--slider-progress', `${percent}%`);
  }
  
  /**
   * Update time slider
   */
  private updateTimeSlider(currentTime: number, duration: number): void {
    // Don't update slider while user is dragging
    if (this.isDraggingTimeSlider) {
      return;
    }
    
    if (duration > 0) {
      const percent = (currentTime / duration) * 100;
      this.timeSlider.value = percent.toString();
      this.timeSlider.max = '100';
    } else {
      this.timeSlider.value = '0';
      this.timeSlider.max = '100';
    }
    this.updateSliderProgress(); // Update CSS variable after changing value
  }
}
