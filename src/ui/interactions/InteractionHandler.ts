/**
 * Interaction Handler Interface
 * 
 * Defines the interface for interaction handlers that process user interactions
 * in the node editor. Handlers are responsible for specific interaction types.
 */

import { InteractionType } from './InteractionTypes';

export interface InteractionEvent {
  type: InteractionType;
  target: any;
  position: { x: number; y: number };
  screenPosition: { x: number; y: number };
  modifiers: {
    shift: boolean;
    ctrl: boolean;
    alt: boolean;
    meta: boolean;
  };
  button?: number; // Mouse button (0 = left, 1 = middle, 2 = right)
  deltaY?: number; // For wheel events
  originalEvent?: MouseEvent | WheelEvent | KeyboardEvent;
}

export interface InteractionHandler {
  /**
   * Check if this handler can handle the given event
   */
  canHandle(event: InteractionEvent): boolean;
  
  /**
   * Handle the interaction event
   */
  handle(event: InteractionEvent): void;
  
  /**
   * Called when interaction starts (e.g., mousedown)
   */
  onStart?(event: InteractionEvent): void;
  
  /**
   * Called when interaction continues (e.g., mousemove during drag)
   */
  onUpdate?(event: InteractionEvent): void;
  
  /**
   * Called when interaction ends (e.g., mouseup)
   */
  onEnd?(event: InteractionEvent): void;
  
  /**
   * Priority for handler selection (higher = checked first)
   * Default: 0
   */
  priority?: number;
}
