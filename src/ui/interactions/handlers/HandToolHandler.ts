/**
 * Hand Tool Handler
 * 
 * Handles canvas panning when the hand tool is active.
 * Always pans the canvas and does not interact with nodes, connections, or other elements.
 */

import type { InteractionEvent, InteractionHandler } from '../InteractionHandler';
import type { HandlerContext } from '../HandlerContext';
import { shouldRequestPanRender } from '../panRenderThrottle';

interface VelocityPoint {
  panX: number;
  panY: number;
  timestamp: number;
}

export class HandToolHandler implements InteractionHandler {
  priority = 15; // Higher than CanvasPanHandler (10) but lower than node interactions
  
  private isPanning: boolean = false;
  private panStartX: number = 0;
  private panStartY: number = 0;
  
  // Momentum physics state
  private velocityHistory: VelocityPoint[] = [];
  private readonly maxVelocityHistory: number = 10;
  private readonly velocitySampleWindow: number = 100; // ms
  private momentumAnimationFrame: number | null = null;
  private momentumVelocityX: number = 0;
  private momentumVelocityY: number = 0;
  private readonly friction: number = 0.65;
  private readonly minVelocityThreshold: number = 0.5;
  
  // Performance optimization: throttle pan updates during dragging
  private panAnimationFrame: number | null = null;
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;
  /** Last time requestRender was called during pan (0 = not yet). Used to throttle render rate. */
  private lastPanRenderRequestTime: number = 0;
  /** Last time requestRender was called during momentum (0 = not yet). Used to throttle render rate. */
  private lastMomentumRenderRequestTime: number = 0;

  constructor(private context: HandlerContext) {}
  
  canHandle(event: InteractionEvent): boolean {
    // Only handle if hand tool is active
    const activeTool = this.context.getActiveTool?.();
    if (activeTool !== 'hand') {
      return false;
    }
    
    // If we're currently panning or momentum is active, continue handling
    if (this.isPanning || this.momentumAnimationFrame !== null) {
      return true;
    }
    
    // Can handle left mouse button clicks
    if (event.button === 0) {
      return true;
    }
    
    return false;
  }
  
  onStart(event: InteractionEvent): void {
    // Cancel any active momentum
    this.stopMomentum();
    
    const state = this.context.getState();
    const mouseX = event.screenPosition.x;
    const mouseY = event.screenPosition.y;
    
    // Clear velocity history
    this.velocityHistory = [];
    
    // Start panning immediately
    this.isPanning = true;
    this.panStartX = mouseX - state.panX;
    this.panStartY = mouseY - state.panY;
    this.lastMouseX = mouseX;
    this.lastMouseY = mouseY;
    this.context.setCursor('all-scroll');
    
    // Record initial position for velocity tracking
    this.recordVelocityPoint(state.panX, state.panY);
    
    // Update NodeEditorCanvas state for rendering
    this.context.setPanState?.({
      isPanning: true,
      potentialBackgroundPan: false,
      panStartX: this.panStartX,
      panStartY: this.panStartY,
      backgroundDragStartX: 0,
      backgroundDragStartY: 0
    });
    
    // Start pan animation loop
    this.startPanAnimation();
  }
  
  onUpdate(event: InteractionEvent): void {
    const mouseX = event.screenPosition.x;
    const mouseY = event.screenPosition.y;
    
    // Update pan position - store latest mouse position for animation loop
    if (this.isPanning) {
      this.lastMouseX = mouseX;
      this.lastMouseY = mouseY;
      
      // Start animation loop if not already running
      if (this.panAnimationFrame === null) {
        this.startPanAnimation();
      }
    }
  }
  
  onEnd(_event: InteractionEvent): void {
    const wasPanning = this.isPanning;
    this.isPanning = false;
    
    // Stop pan animation loop
    if (this.panAnimationFrame !== null) {
      cancelAnimationFrame(this.panAnimationFrame);
      this.panAnimationFrame = null;
    }
    
    // One final render so canvas matches final view state
    this.context.requestRender();
    
    // Update NodeEditorCanvas state for rendering
    this.context.setPanState?.({
      isPanning: false,
      potentialBackgroundPan: false,
      panStartX: 0,
      panStartY: 0,
      backgroundDragStartX: 0,
      backgroundDragStartY: 0
    });
    
    this.context.setCursor('grab');
    
    // Calculate and start momentum if we were panning
    if (wasPanning && this.velocityHistory.length >= 2) {
      const velocity = this.calculateVelocity();
      const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
      
      // Only start momentum if velocity is significant
      if (speed > this.minVelocityThreshold) {
        this.momentumVelocityX = velocity.x;
        this.momentumVelocityY = velocity.y;
        this.startMomentum();
      }
    }
    
    // Clear velocity history
    this.velocityHistory = [];
  }
  
  handle(_event: InteractionEvent): void {
    // This method is called for immediate handling
    // For panning, we use onStart/onUpdate/onEnd lifecycle
  }
  
  /**
   * Start pan animation loop using requestAnimationFrame
   */
  private startPanAnimation(): void {
    if (this.panAnimationFrame !== null) {
      return; // Already running
    }
    this.lastPanRenderRequestTime = 0; // First frame always requests a render
    const animate = () => {
      if (!this.isPanning) {
        this.panAnimationFrame = null;
        return;
      }
      
      // Update pan position using latest mouse position (every frame for smooth movement)
      const state = this.context.getState();
      const newState = { ...state };
      newState.panX = this.lastMouseX - this.panStartX;
      newState.panY = this.lastMouseY - this.panStartY;
      this.context.setState(() => newState);
      
      // Record velocity for momentum calculation
      this.recordVelocityPoint(newState.panX, newState.panY);
      
      // Throttle full redraws during pan (~30 fps) while state updates every frame
      if (shouldRequestPanRender(this.lastPanRenderRequestTime)) {
        this.lastPanRenderRequestTime = performance.now();
        this.context.requestRender();
      }
      
      // Continue animation
      this.panAnimationFrame = requestAnimationFrame(animate);
    };
    
    this.panAnimationFrame = requestAnimationFrame(animate);
  }
  
  /**
   * Record a velocity point for tracking pan speed
   */
  private recordVelocityPoint(panX: number, panY: number): void {
    const now = performance.now();
    
    // Add new point
    this.velocityHistory.push({
      panX,
      panY,
      timestamp: now
    });
    
    // Remove old points outside the time window
    const cutoffTime = now - this.velocitySampleWindow;
    this.velocityHistory = this.velocityHistory.filter(
      point => point.timestamp > cutoffTime
    );
    
    // Limit history size
    if (this.velocityHistory.length > this.maxVelocityHistory) {
      this.velocityHistory.shift();
    }
  }
  
  /**
   * Calculate velocity from recent position history
   */
  private calculateVelocity(): { x: number; y: number } {
    if (this.velocityHistory.length < 2) {
      return { x: 0, y: 0 };
    }
    
    // Get the oldest and newest points
    const oldest = this.velocityHistory[0];
    const newest = this.velocityHistory[this.velocityHistory.length - 1];
    
    const timeDelta = newest.timestamp - oldest.timestamp;
    if (timeDelta <= 0) {
      return { x: 0, y: 0 };
    }
    
    // Calculate velocity in pixels per millisecond
    const velocityX = (newest.panX - oldest.panX) / timeDelta;
    const velocityY = (newest.panY - oldest.panY) / timeDelta;
    
    // Convert to pixels per frame (assuming ~60fps = 16.67ms per frame)
    return {
      x: velocityX * 16.67,
      y: velocityY * 16.67
    };
  }
  
  /**
   * Start momentum animation
   */
  private startMomentum(): void {
    if (this.momentumAnimationFrame !== null) {
      return; // Already running
    }
    this.lastMomentumRenderRequestTime = 0; // First frame always requests a render
    const animate = () => {
      // Apply friction (exponential decay)
      this.momentumVelocityX *= this.friction;
      this.momentumVelocityY *= this.friction;
      
      // Check if velocity is too low to continue
      const speed = Math.sqrt(
        this.momentumVelocityX * this.momentumVelocityX +
        this.momentumVelocityY * this.momentumVelocityY
      );
      
      if (speed < this.minVelocityThreshold) {
        this.context.requestRender(); // Final render so canvas matches final view state
        this.stopMomentum();
        return;
      }
      
      // Update pan position (every frame for smooth movement)
      const state = this.context.getState();
      const newState = { ...state };
      newState.panX += this.momentumVelocityX;
      newState.panY += this.momentumVelocityY;
      this.context.setState(() => newState);
      
      // Throttle full redraws during momentum (~30 fps)
      if (shouldRequestPanRender(this.lastMomentumRenderRequestTime)) {
        this.lastMomentumRenderRequestTime = performance.now();
        this.context.requestRender();
      }
      
      // Continue animation
      this.momentumAnimationFrame = requestAnimationFrame(animate);
    };
    
    this.momentumAnimationFrame = requestAnimationFrame(animate);
  }
  
  /**
   * Stop momentum animation
   */
  private stopMomentum(): void {
    if (this.momentumAnimationFrame !== null) {
      cancelAnimationFrame(this.momentumAnimationFrame);
      this.momentumAnimationFrame = null;
    }
    this.momentumVelocityX = 0;
    this.momentumVelocityY = 0;
  }
}
