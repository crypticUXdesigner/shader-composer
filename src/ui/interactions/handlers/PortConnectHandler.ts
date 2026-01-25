/**
 * Port Connect Handler
 * 
 * Handles port connection creation:
 * - Click on port to start connection
 * - Drag to another port to complete connection
 * - Visual feedback during connection creation
 */

import { InteractionType } from '../InteractionTypes';
import type { InteractionEvent, InteractionHandler } from '../InteractionHandler';
import type { HandlerContext } from '../HandlerContext';

export class PortConnectHandler implements InteractionHandler {
  priority = 45; // High priority - port connection is specific interaction
  
  private isConnecting: boolean = false;
  private connectionStartNodeId: string | null = null;
  private connectionStartPort: string | null = null;
  private connectionStartParameter: string | null = null;
  private connectionStartIsOutput: boolean = false;
  private connectionMouseX: number = 0;
  private connectionMouseY: number = 0;
  private hoveredPort: {
    nodeId: string;
    port: string;
    isOutput: boolean;
    parameter?: string;
  } | null = null;
  
  // Edge scrolling state
  private edgeScrollAnimationFrame: number | null = null;
  private edgeScrollVelocityX: number = 0;
  private edgeScrollVelocityY: number = 0;
  private readonly EDGE_SCROLL_ZONE = 0.1; // 10% of width/height
  private readonly MAX_EDGE_SCROLL_SPEED = 800; // pixels per second
  private currentMouseX: number = 0;
  private currentMouseY: number = 0;
  
  constructor(private context: HandlerContext) {}
  
  canHandle(event: InteractionEvent): boolean {
    // If we're currently connecting, we can handle all events (start, update, end)
    if (this.isConnecting) {
      return true;
    }
    
    // For start events, check if clicking on a port
    if (event.type === InteractionType.PortConnect) {
      // Check if clicking on a port
      const portHit = this.context.hitTestPort?.(event.screenPosition.x, event.screenPosition.y);
      if (portHit) {
        return true;
      }
    }
    
    return false;
  }
  
  onStart(event: InteractionEvent): void {
    const portHit = this.context.hitTestPort?.(event.screenPosition.x, event.screenPosition.y);
    if (!portHit) return;
    
    this.isConnecting = true;
    this.connectionStartNodeId = portHit.nodeId;
    this.connectionStartPort = portHit.port;
    this.connectionStartParameter = portHit.parameter || null;
    this.connectionStartIsOutput = portHit.isOutput;
    this.connectionMouseX = event.screenPosition.x;
    this.connectionMouseY = event.screenPosition.y;
    this.hoveredPort = null;
    
    // Update NodeEditorCanvas state for rendering
    this.context.setConnectionState?.({
      isConnecting: true,
      connectionStartNodeId: portHit.nodeId,
      connectionStartPort: portHit.port,
      connectionStartParameter: portHit.parameter || null,
      connectionStartIsOutput: portHit.isOutput,
      connectionMouseX: event.screenPosition.x,
      connectionMouseY: event.screenPosition.y,
      hoveredPort: null
    });
    
    this.context.setCursor('crosshair');
  }
  
  onUpdate(event: InteractionEvent): void {
    if (!this.isConnecting) return;
    
    // Store current mouse position for edge scrolling
    this.currentMouseX = event.screenPosition.x;
    this.currentMouseY = event.screenPosition.y;
    
    this.connectionMouseX = event.screenPosition.x;
    this.connectionMouseY = event.screenPosition.y;
    
    // Check if hovering over a valid input port (only if dragging from output)
    if (this.connectionStartIsOutput) {
      const portHit = this.context.hitTestPort?.(event.screenPosition.x, event.screenPosition.y);
      // Only highlight input ports (not outputs) and not the same node
      if (portHit && !portHit.isOutput && portHit.nodeId !== this.connectionStartNodeId) {
        this.hoveredPort = portHit;
      } else {
        this.hoveredPort = null;
      }
    } else {
      this.hoveredPort = null;
    }
    
    // Update NodeEditorCanvas state for rendering
    this.context.setConnectionState?.({
      isConnecting: true,
      connectionStartNodeId: this.connectionStartNodeId!,
      connectionStartPort: this.connectionStartPort!,
      connectionStartParameter: this.connectionStartParameter,
      connectionStartIsOutput: this.connectionStartIsOutput,
      connectionMouseX: event.screenPosition.x,
      connectionMouseY: event.screenPosition.y,
      hoveredPort: this.hoveredPort
    });
    
    // Check for edge scrolling when connecting
    this.updateEdgeScrollVelocity(event.screenPosition.x, event.screenPosition.y);
    this.startEdgeScrolling();
    
    this.context.requestRender();
  }
  
  onEnd(event: InteractionEvent): void {
    if (!this.isConnecting) return;
    
    // Stop edge scrolling
    this.stopEdgeScrolling();
    
    // Check if released on a valid port
    const portHit = this.context.hitTestPort?.(event.screenPosition.x, event.screenPosition.y);
    if (portHit && portHit.nodeId !== this.connectionStartNodeId) {
      // Valid connection
      if (this.connectionStartIsOutput && !portHit.isOutput) {
        // Output to input or parameter
        if (portHit.parameter) {
          // Connecting to parameter input
          // connectionStartPort should be set (output ports always have a name)
          if (this.connectionStartNodeId && this.connectionStartPort) {
            this.context.onConnectionCreated?.(
              this.connectionStartNodeId,
              this.connectionStartPort,
              portHit.nodeId,
              undefined,
              portHit.parameter
            );
          } else {
            console.warn('[PortConnectHandler] Missing connection data for parameter connection:', {
              connectionStartNodeId: this.connectionStartNodeId,
              connectionStartPort: this.connectionStartPort
            });
          }
        } else {
          // Output to input port
          // connectionStartPort should be set (output ports always have a name)
          // portHit.port should be set for regular input ports
          if (this.connectionStartNodeId && this.connectionStartPort && portHit.port) {
            this.context.onConnectionCreated?.(
              this.connectionStartNodeId,
              this.connectionStartPort,
              portHit.nodeId,
              portHit.port
            );
          } else {
            console.warn('[PortConnectHandler] Missing connection data for port connection:', {
              connectionStartNodeId: this.connectionStartNodeId,
              connectionStartPort: this.connectionStartPort,
              portHitPort: portHit.port
            });
          }
        }
      } else if (!this.connectionStartIsOutput && portHit.isOutput) {
        // Input to output (reverse) - not applicable for parameter inputs
        // connectionStartPort might be empty for parameter inputs, but we're connecting from input to output
        // so connectionStartPort should be set (regular input ports have names)
        if (this.connectionStartNodeId && this.connectionStartPort && portHit.port) {
          this.context.onConnectionCreated?.(
            portHit.nodeId,
            portHit.port,
            this.connectionStartNodeId,
            this.connectionStartPort
          );
        } else {
          console.warn('[PortConnectHandler] Missing connection data for reverse port connection:', {
            connectionStartNodeId: this.connectionStartNodeId,
            connectionStartPort: this.connectionStartPort,
            portHitPort: portHit.port
          });
        }
      } else {
        console.warn('[PortConnectHandler] Invalid connection direction:', {
          connectionStartIsOutput: this.connectionStartIsOutput,
          portHitIsOutput: portHit.isOutput
        });
      }
    }
    
    // Clean up
    this.isConnecting = false;
    this.connectionStartNodeId = null;
    this.connectionStartPort = null;
    this.connectionStartParameter = null;
    this.hoveredPort = null;
    
    // Update NodeEditorCanvas state for rendering
    this.context.setConnectionState?.({
      isConnecting: false,
      connectionStartNodeId: null,
      connectionStartPort: null,
      connectionStartParameter: null,
      connectionStartIsOutput: false,
      connectionMouseX: 0,
      connectionMouseY: 0,
      hoveredPort: null
    });
    
    const cursor = this.context.isSpacePressed?.() ? 'grab' : 'default';
    this.context.setCursor(cursor);
    this.context.requestRender();
  }
  
  handle(_event: InteractionEvent): void {
    // This method is called for immediate handling
    // For port connection, we use onStart/onUpdate/onEnd lifecycle
    // This is a no-op as connection is handled through lifecycle methods
  }
  
  // Getters for state access (used by rendering code)
  getIsConnecting(): boolean {
    return this.isConnecting;
  }
  
  getConnectionStart(): {
    nodeId: string;
    port: string;
    parameter: string | null;
    isOutput: boolean;
  } | null {
    if (!this.isConnecting || !this.connectionStartNodeId || !this.connectionStartPort) {
      return null;
    }
    
    return {
      nodeId: this.connectionStartNodeId,
      port: this.connectionStartPort,
      parameter: this.connectionStartParameter,
      isOutput: this.connectionStartIsOutput
    };
  }
  
  getConnectionMousePosition(): { x: number; y: number } | null {
    if (!this.isConnecting) {
      return null;
    }
    
    return {
      x: this.connectionMouseX,
      y: this.connectionMouseY
    };
  }
  
  getHoveredPort(): {
    nodeId: string;
    port: string;
    isOutput: boolean;
    parameter?: string;
  } | null {
    return this.hoveredPort;
  }
  
  /**
   * Calculate edge scroll velocity based on mouse position
   */
  private updateEdgeScrollVelocity(mouseX: number, mouseY: number): void {
    const rect = this.context.getCanvasRect?.();
    if (!rect) return;
    
    const canvasWidth = rect.width;
    const canvasHeight = rect.height;
    const scrollZoneWidth = canvasWidth * this.EDGE_SCROLL_ZONE;
    const scrollZoneHeight = canvasHeight * this.EDGE_SCROLL_ZONE;
    
    // Calculate distance from edges
    const distFromLeft = mouseX - rect.left;
    const distFromRight = rect.right - mouseX;
    const distFromTop = mouseY - rect.top;
    const distFromBottom = rect.bottom - mouseY;
    
    // Calculate velocity for X axis
    let velocityX = 0;
    if (distFromLeft < scrollZoneWidth) {
      // Near left edge - scroll right to reveal more content (positive velocity)
      const proximity = 1 - (distFromLeft / scrollZoneWidth);
      velocityX = this.MAX_EDGE_SCROLL_SPEED * proximity * proximity; // Quadratic for smoother acceleration
    } else if (distFromRight < scrollZoneWidth) {
      // Near right edge - scroll left to reveal more content (negative velocity)
      const proximity = 1 - (distFromRight / scrollZoneWidth);
      velocityX = -this.MAX_EDGE_SCROLL_SPEED * proximity * proximity;
    }
    
    // Calculate velocity for Y axis
    let velocityY = 0;
    if (distFromTop < scrollZoneHeight) {
      // Near top edge - scroll down to reveal more content (positive velocity)
      const proximity = 1 - (distFromTop / scrollZoneHeight);
      velocityY = this.MAX_EDGE_SCROLL_SPEED * proximity * proximity;
    } else if (distFromBottom < scrollZoneHeight) {
      // Near bottom edge - scroll up to reveal more content (negative velocity)
      const proximity = 1 - (distFromBottom / scrollZoneHeight);
      velocityY = -this.MAX_EDGE_SCROLL_SPEED * proximity * proximity;
    }
    
    this.edgeScrollVelocityX = velocityX;
    this.edgeScrollVelocityY = velocityY;
  }
  
  /**
   * Start edge scrolling animation loop
   */
  private startEdgeScrolling(): void {
    if (this.edgeScrollAnimationFrame !== null) {
      return; // Already running
    }
    
    let lastTime = performance.now();
    
    const animate = (currentTime: number) => {
      const deltaTime = (currentTime - lastTime) / 1000; // Convert to seconds
      lastTime = currentTime;
      
      // Update velocity based on current mouse position
      this.updateEdgeScrollVelocity(this.currentMouseX, this.currentMouseY);
      
      // Only scroll if there's velocity
      if (this.edgeScrollVelocityX !== 0 || this.edgeScrollVelocityY !== 0) {
        // Update pan based on velocity and delta time
        const state = this.context.getState();
        const newState = { ...state };
        newState.panX += this.edgeScrollVelocityX * deltaTime;
        newState.panY += this.edgeScrollVelocityY * deltaTime;
        this.context.setState(() => newState);
        
        // Update connection mouse position to account for pan change
        this.connectionMouseX = this.currentMouseX;
        this.connectionMouseY = this.currentMouseY;
        
        // Update NodeEditorCanvas state for rendering
        this.context.setConnectionState?.({
          isConnecting: true,
          connectionStartNodeId: this.connectionStartNodeId!,
          connectionStartPort: this.connectionStartPort!,
          connectionStartParameter: this.connectionStartParameter,
          connectionStartIsOutput: this.connectionStartIsOutput,
          connectionMouseX: this.connectionMouseX,
          connectionMouseY: this.connectionMouseY,
          hoveredPort: this.hoveredPort
        });
        
        this.context.requestRender();
      }
      
      // Continue animation if still connecting
      if (this.isConnecting) {
        this.edgeScrollAnimationFrame = requestAnimationFrame(animate);
      } else {
        this.edgeScrollAnimationFrame = null;
      }
    };
    
    this.edgeScrollAnimationFrame = requestAnimationFrame(animate);
  }
  
  /**
   * Stop edge scrolling animation
   */
  private stopEdgeScrolling(): void {
    if (this.edgeScrollAnimationFrame !== null) {
      cancelAnimationFrame(this.edgeScrollAnimationFrame);
      this.edgeScrollAnimationFrame = null;
    }
    this.edgeScrollVelocityX = 0;
    this.edgeScrollVelocityY = 0;
  }
}
