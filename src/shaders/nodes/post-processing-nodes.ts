/**
 * Post-Processing Nodes
 * 
 * NOTE: Most post-processing nodes are now provided by VisualElements in src/shaders/elements/
 * which are automatically converted to NodeSpecs via visualElementToNodeSpec().
 * 
 * The following post-processing nodes have duplicate definitions in both systems:
 * - glow-bloom (use glowBloomElement)
 * - blur (use blurElement)
 * - edge-detection (use edgeDetectionElement)
 * - chromatic-aberration (use chromaticAberrationElement)
 * - color-grading (use colorGradingElement)
 * - rgb-separation (use rgbSeparationElement)
 * - scanlines (use scanlinesElement)
 * - block-edge-brightness (use blockEdgeBrightnessElement)
 * - block-color-glitch (use blockColorGlitchElement)
 * - normal-mapping (use normalMappingElement)
 * - lighting-shading (use lightingShadingElement)
 * 
 * The VisualElement versions are more complete (more parameters, parameter groups, better descriptions),
 * so the duplicate NodeSpec definitions have been removed. They will be automatically converted
 * from VisualElements when the node system initializes.
 */
