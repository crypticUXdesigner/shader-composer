/**
 * Interaction Handler Interface
 * 
 * Defines the interface for interaction handlers that process user interactions
 * in the node editor. Handlers are responsible for specific interaction types.
 */

import { InteractionType } from './InteractionTypes';

/** Target of an interaction: connection id, node id, or hit-test result. */
export type InteractionEventTarget =
  | string
  | { nodeId: string; port: string; isOutput: boolean; parameter?: string; snapPosition?: { x: number; y: number } }
  | { nodeId: string; paramName: string; isString?: boolean; isModeButton?: boolean; frequencyBand?: { bandIndex: number; field: 'start' | 'end' | 'sliderLow' | 'sliderHigh' }; scale?: 'linear' | 'audio' }
  | { nodeId: string; paramNames: [string, string, string, string]; controlIndex: number }
  | null;

export interface InteractionEvent {
  type: InteractionType;
  target: InteractionEventTarget;
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
