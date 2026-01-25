/**
 * Interaction Manager
 * 
 * Routes interaction events to appropriate handlers based on type and priority.
 * Handlers are registered for specific interaction types and checked in priority order.
 */

import { InteractionHandler, type InteractionEvent } from './InteractionHandler';
import { InteractionType } from './InteractionTypes';

export class InteractionManager {
  private handlers: Map<InteractionType, InteractionHandler[]> = new Map();
  
  /**
   * Register a handler for a specific interaction type
   */
  register(type: InteractionType, handler: InteractionHandler): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }
    const handlers = this.handlers.get(type)!;
    handlers.push(handler);
    
    // Sort by priority (higher priority first)
    handlers.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }
  
  /**
   * Unregister a handler
   */
  unregister(type: InteractionType, handler: InteractionHandler): void {
    const handlers = this.handlers.get(type);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index >= 0) {
        handlers.splice(index, 1);
      }
    }
  }
  
  /**
   * Handle an interaction event
   * Routes to the first handler that can handle the event
   */
  handle(event: InteractionEvent): boolean {
    const handlers = this.handlers.get(event.type) || [];
    
    for (const handler of handlers) {
      if (handler.canHandle(event)) {
        handler.handle(event);
        return true; // Event handled
      }
    }
    
    return false; // No handler found
  }
  
  /**
   * Start an interaction (e.g., mousedown)
   */
  start(event: InteractionEvent): boolean {
    const handlers = this.handlers.get(event.type) || [];
    
    for (const handler of handlers) {
      if (handler.canHandle(event)) {
        handler.onStart?.(event);
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Update an interaction (e.g., mousemove during drag)
   */
  update(event: InteractionEvent): boolean {
    const handlers = this.handlers.get(event.type) || [];
    
    for (const handler of handlers) {
      if (handler.canHandle(event)) {
        handler.onUpdate?.(event);
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * End an interaction (e.g., mouseup)
   */
  end(event: InteractionEvent): boolean {
    const handlers = this.handlers.get(event.type) || [];
    
    for (const handler of handlers) {
      if (handler.canHandle(event)) {
        handler.onEnd?.(event);
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Get all handlers for a specific type
   */
  getHandlers(type: InteractionType): InteractionHandler[] {
    return [...(this.handlers.get(type) || [])];
  }
  
  /**
   * Clear all handlers
   */
  clear(): void {
    this.handlers.clear();
  }
}
