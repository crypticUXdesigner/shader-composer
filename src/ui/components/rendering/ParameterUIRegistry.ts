/**
 * Parameter UI Registry
 * 
 * Manages parameter renderers and selects the appropriate renderer for each parameter.
 * Renderers are checked in priority order (higher priority checked first).
 */

import { ParameterRenderer } from './parameters/ParameterRenderer';
import { KnobParameterRenderer } from './parameters/KnobParameterRenderer';
import { ToggleParameterRenderer } from './parameters/ToggleParameterRenderer';
import { EnumParameterRenderer } from './parameters/EnumParameterRenderer';
import { BezierParameterRenderer } from './parameters/BezierParameterRenderer';
import { RangeParameterRenderer } from './parameters/RangeParameterRenderer';
import { InputParameterRenderer } from './parameters/InputParameterRenderer';
import type { NodeSpec, ParameterUISelection } from '../../../types/nodeSpec';

export class ParameterUIRegistry {
  private renderers: ParameterRenderer[] = [];
  
  /**
   * Register a parameter renderer
   * Renderers are checked in registration order, but priority can override this
   */
  register(renderer: ParameterRenderer): void {
    this.renderers.push(renderer);
    // Sort by priority (higher priority first)
    this.renderers.sort((a, b) => b.getPriority() - a.getPriority());
  }
  
  /**
   * Get the appropriate renderer for a parameter
   * Checks renderers in priority order (first match wins)
   */
  getRenderer(spec: NodeSpec, paramName: string): ParameterRenderer {
    // Check renderers in priority order (first match wins)
    for (const renderer of this.renderers) {
      if (renderer.canHandle(spec, paramName)) {
        return renderer;
      }
    }
    
    // Fallback: should never happen if knob renderer is registered (it handles everything)
    throw new Error(`No renderer found for parameter: ${paramName} in node: ${spec.id}`);
  }
  
  /**
   * Get a renderer by UI type string
   * Used when parameterUI override is specified in layout elements
   */
  getRendererByUIType(uiType: ParameterUISelection): ParameterRenderer | null {
    for (const renderer of this.renderers) {
      if (renderer.getUIType() === uiType) {
        return renderer;
      }
    }
    return null;
  }
  
  /**
   * Get all registered renderers
   */
  getAllRenderers(): ParameterRenderer[] {
    return [...this.renderers];
  }
  
  /**
   * Clear all registered renderers
   */
  clear(): void {
    this.renderers = [];
  }
}

// Singleton instance
let registryInstance: ParameterUIRegistry | null = null;

/**
 * Get the global parameter UI registry instance
 * Registers default renderers on first access
 */
export function getParameterUIRegistry(): ParameterUIRegistry {
  if (!registryInstance) {
    registryInstance = new ParameterUIRegistry();
    
    // Register renderers in priority order (most specific first)
    // Note: We'll add other renderers as we extract them
    // For now, just register the knob renderer as the default
    
    // Register renderers in priority order (most specific first)
    // Register renderers in priority order (most specific first)
    registryInstance.register(new BezierParameterRenderer()); // Priority 100
    registryInstance.register(new RangeParameterRenderer()); // Priority 90
    registryInstance.register(new EnumParameterRenderer()); // Priority 60
    registryInstance.register(new ToggleParameterRenderer()); // Priority 50
    registryInstance.register(new InputParameterRenderer()); // Priority 40
    
    // Knob renderer is the default (registered last, lowest priority)
    registryInstance.register(new KnobParameterRenderer());
  }
  return registryInstance;
}
