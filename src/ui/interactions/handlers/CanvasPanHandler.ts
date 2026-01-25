/**
 * Canvas Pan Handler with Momentum Physics
 * 
 * Handles canvas panning interactions with physical momentum:
 * - Spacebar + left click drag
 * - Middle mouse button drag
 * - Background drag (after threshold)
 * - Momentum/inertia on release with smooth deceleration
 */

import { InteractionType } from '../InteractionTypes';
import type { InteractionEvent, InteractionHandler } from '../InteractionHandler';
import type { HandlerContext } from '../HandlerContext';

interface VelocityPoint {
  panX: number;
  panY: number;
  timestamp: number;
}

export class CanvasPanHandler implements InteractionHandler {
  priority = 10; // Lower priority - panning is fallback for empty canvas
  
  private isPanning: boolean = false;
  private panStartX: number = 0;
  private panStartY: number = 0;
  private potentialBackgroundPan: boolean = false;
  private backgroundDragStartX: number = 0;
  private backgroundDragStartY: number = 0;
  private readonly backgroundDragThreshold: number = 5; // pixels
  
  // Momentum physics state
  private velocityHistory: VelocityPoint[] = [];
  private readonly maxVelocityHistory: number = 10; // Track last 10 positions
  private readonly velocitySampleWindow: number = 100; // ms - only use recent samples
  private momentumAnimationFrame: number | null = null;
  private momentumVelocityX: number = 0;
  private momentumVelocityY: number = 0;
  private readonly friction: number = 0.65; // Deceleration factor (0.92 = smooth, lower = faster stop)
  private readonly minVelocityThreshold: number = 0.5; // Stop when velocity is below this
  
  // Performance optimization: throttle pan updates during dragging
  private panAnimationFrame: number | null = null;
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;
  
  constructor(private context: HandlerContext) {}
  
  canHandle(event: InteractionEvent): boolean {
    // If we're currently panning, have a potential pan, or momentum is active
    if (this.isPanning || this.potentialBackgroundPan || this.momentumAnimationFrame !== null) {
      return true;
    }
    
    // Can handle if:
    // 1. Event type is explicitly CanvasPan (called from handleMouseDown for empty canvas)
    // 2. Spacebar is pressed and clicking
    // 3. Middle mouse button
    if (event.type === InteractionType.CanvasPan) {
      return true;
    }
    
    // Check for spacebar + left click
    const isSpacePressed = this.context.isSpacePressed?.() ?? false;
    if (isSpacePressed && event.button === 0) {
      return true;
    }
    
    // Check for middle mouse button
    if (event.button === 1) {
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
    
    // Check for spacebar + left click or middle mouse
    const isSpacePressed = this.context.isSpacePressed?.() ?? false;
    const isMiddleMouse = event.button === 1;
    
    if (isSpacePressed || isMiddleMouse) {
      // Start panning immediately
      this.isPanning = true;
      this.panStartX = mouseX - state.panX;
      this.panStartY = mouseY - state.panY;
      this.lastMouseX = mouseX;
      this.lastMouseY = mouseY;
      this.context.setCursor('grabbing');
      
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
    } else if (event.button === 0) {
      // Left click on empty canvas - set up potential background pan
      this.potentialBackgroundPan = true;
      this.backgroundDragStartX = mouseX;
      this.backgroundDragStartY = mouseY;
      
      // Update NodeEditorCanvas state for rendering
      this.context.setPanState?.({
        isPanning: false,
        potentialBackgroundPan: true,
        panStartX: 0,
        panStartY: 0,
        backgroundDragStartX: mouseX,
        backgroundDragStartY: mouseY
      });
    }
  }
  
  onUpdate(event: InteractionEvent): void {
    const mouseX = event.screenPosition.x;
    const mouseY = event.screenPosition.y;
    
    // Check if we should start background panning
    if (this.potentialBackgroundPan && !this.isPanning) {
      const dx = mouseX - this.backgroundDragStartX;
      const dy = mouseY - this.backgroundDragStartY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > this.backgroundDragThreshold) {
        // Start panning
        const state = this.context.getState();
        this.isPanning = true;
        this.potentialBackgroundPan = false;
        this.panStartX = this.backgroundDragStartX - state.panX;
        this.panStartY = this.backgroundDragStartY - state.panY;
        this.context.setCursor('grabbing');
        
        // Record initial position for velocity tracking
        this.recordVelocityPoint(state.panX, state.panY);
        
        // Update NodeEditorCanvas state for rendering
        this.context.setPanState?.({
          isPanning: true,
          potentialBackgroundPan: false,
          panStartX: this.panStartX,
          panStartY: this.panStartY,
          backgroundDragStartX: this.backgroundDragStartX,
          backgroundDragStartY: this.backgroundDragStartY
        });
        
        // Start pan animation loop
        this.startPanAnimation();
      }
    }
    
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
    this.potentialBackgroundPan = false;
    
    // Stop pan animation loop
    if (this.panAnimationFrame !== null) {
      cancelAnimationFrame(this.panAnimationFrame);
      this.panAnimationFrame = null;
    }
    
    // Update NodeEditorCanvas state for rendering
    this.context.setPanState?.({
      isPanning: false,
      potentialBackgroundPan: false,
      panStartX: 0,
      panStartY: 0,
      backgroundDragStartX: 0,
      backgroundDragStartY: 0
    });
    
    this.context.setCursor('default');
    
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
    // This is a no-op as panning is handled through lifecycle methods
  }
  
  /**
   * Start pan animation loop using requestAnimationFrame
   * 
   * Performance optimization: Throttles pan updates to display refresh rate instead of mouse event rate.
   * This prevents FPS drops during rapid panning by:
   * 1. Storing latest mouse position in onUpdate (called at mouse event rate, ~60+ events/sec)
   * 2. Applying pan updates in animation loop (called at display refresh rate, ~60fps)
   * 
   * Same throttling pattern as CanvasZoomHandler for consistency.
   */
  private startPanAnimation(): void {
    if (this.panAnimationFrame !== null) {
      return; // Already running
    }
    
    const animate = () => {
      if (!this.isPanning) {
        this.panAnimationFrame = null;
        return;
      }
      
      // Update pan position using latest mouse position
      const state = this.context.getState();
      const newState = { ...state };
      newState.panX = this.lastMouseX - this.panStartX;
      newState.panY = this.lastMouseY - this.panStartY;
      this.context.setState(() => newState);
      
      // Record velocity for momentum calculation
      this.recordVelocityPoint(newState.panX, newState.panY);
      
      // Panning changes viewport - everything needs to be redrawn
      this.context.requestRender();
      
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
    // This gives us a velocity that works well with requestAnimationFrame
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
        this.stopMomentum();
        return;
      }
      
      // Update pan position
      const state = this.context.getState();
      const newState = { ...state };
      newState.panX += this.momentumVelocityX;
      newState.panY += this.momentumVelocityY;
      this.context.setState(() => newState);
      
      // Request render
      this.context.requestRender();
      
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
