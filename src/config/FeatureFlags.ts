/**
 * Feature Flags for Refactoring
 * 
 * @deprecated All refactoring phases are complete. All flags are always enabled.
 * This file is kept for backwards compatibility but flags are no longer checked.
 * The refactored implementations are now the only code paths.
 * 
 * Legacy flags (all always true):
 * - USE_NEW_PARAMETER_RENDERERS: ParameterRenderer classes are always used
 * - USE_NEW_METRICS_CALCULATOR: NodeMetricsCalculator is always used
 * - USE_NEW_HEADER_RENDERER: NodeHeaderRenderer is always used
 * - USE_NEW_PORT_RENDERER: NodePortRenderer is always used
 * - USE_COMPONENT_SYSTEM: NodeComponent system is always used
 * - USE_LAYER_SYSTEM: LayerManager is always used
 * - USE_INCREMENTAL_RENDERING: FrameBuffer incremental rendering is always used
 * - USE_MEMOIZATION: Memoization and throttling are always used
 * - USE_DIRTY_TRACKING: RenderState dirty tracking is always used
 * - USE_VIEWPORT_CULLING: Viewport culling is always used
 * - USE_INTERACTION_HANDLERS: InteractionManager is always used
 */

export const FeatureFlags = {
  /**
   * @deprecated Always true - ParameterRenderer classes are always used
   */
  USE_NEW_PARAMETER_RENDERERS: true,
  
  /**
   * @deprecated Always true - NodeMetricsCalculator is always used
   */
  USE_NEW_METRICS_CALCULATOR: true,
  
  /**
   * @deprecated Always true - NodeHeaderRenderer is always used
   */
  USE_NEW_HEADER_RENDERER: true,
  
  /**
   * @deprecated Always true - NodePortRenderer is always used
   */
  USE_NEW_PORT_RENDERER: true,
  
  /**
   * @deprecated Always true - NodeComponent system is always used
   */
  USE_COMPONENT_SYSTEM: true,
  
  /**
   * @deprecated Always true - LayerManager is always used
   */
  USE_LAYER_SYSTEM: true,
  
  /**
   * @deprecated Always true - FrameBuffer incremental rendering is always used
   */
  USE_INCREMENTAL_RENDERING: true,
  
  /**
   * @deprecated Always true - Memoization and throttling are always used
   */
  USE_MEMOIZATION: true,
  
  /**
   * @deprecated Always true - RenderState dirty tracking is always used
   */
  USE_DIRTY_TRACKING: true,
  
  /**
   * @deprecated Always true - Viewport culling is always used
   */
  USE_VIEWPORT_CULLING: true,
  
  /**
   * @deprecated Always true - InteractionManager is always used
   */
  USE_INTERACTION_HANDLERS: true,
} as const;

/**
 * Check if a feature flag is enabled
 * @deprecated All flags are always enabled. This function always returns true.
 */
export function isFeatureEnabled(flag: keyof typeof FeatureFlags): boolean {
  return FeatureFlags[flag];
}
