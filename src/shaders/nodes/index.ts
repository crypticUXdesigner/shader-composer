// Node specs for the node system (all VisualElements have been migrated to native NodeSpecs)

import type { NodeSpec } from '../../types';
import { colorMapNodeSpec } from './color-map';
import { finalOutputNodeSpec } from './final-output';
import {
  uvCoordinatesNodeSpec,
  timeNodeSpec,
  resolutionNodeSpec,
  fragmentCoordinatesNodeSpec,
  constantFloatNodeSpec,
  constantVec2NodeSpec,
  constantVec3NodeSpec,
  constantVec4NodeSpec
} from './input-nodes';
import {
  translateNodeSpec,
  rotateNodeSpec,
  scaleNodeSpec
} from './transform-nodes';
import { domainRepetitionNodeSpec } from './domain-repetition';
import { polarCoordinatesNodeSpec } from './polar-coordinates';
import { vectorFieldNodeSpec } from './vector-field';
import { turbulenceNodeSpec } from './turbulence';
import { twistDistortionNodeSpec } from './twist-distortion';
import { kaleidoscopeNodeSpec } from './kaleidoscope';
import { bulgePinchNodeSpec } from './bulge-pinch';
import { rippleNodeSpec } from './ripple';
import { fisheyeNodeSpec } from './fisheye';
import { mirrorFlipNodeSpec } from './mirror-flip';
import { displaceNodeSpec } from './displace';
import { vortexNodeSpec } from './vortex';
import { spherizeNodeSpec } from './spherize';
import { quadWarpNodeSpec } from './quad-warp';
import { directionalDisplaceNodeSpec } from './directional-displace';
import { brickTilingNodeSpec } from './brick-tiling';
import { infiniteZoomNodeSpec } from './infinite-zoom';
import { kaleidoscopeSmoothNodeSpec } from './kaleidoscope-smooth';
import { fbmNoiseNodeSpec } from './fbm-noise';
import { simplexNoiseNodeSpec } from './simplex-noise';
import { simplex3dNodeSpec } from './simplex-3d';
import { voronoiNoiseNodeSpec } from './voronoi-noise';
import { cubicCurlNoiseNodeSpec } from './cubic-curl-noise';
import { worleyNoiseNodeSpec } from './worley-noise';
import { ringsNodeSpec } from './rings';
import { spiralNodeSpec } from './spiral';
import { gradientNodeSpec } from './gradient';
import { radialRaysNodeSpec } from './radial-rays';
import { volumeRaysNodeSpec } from './volume-rays';
import { streakNodeSpec } from './streak';
import { sunbeamsNodeSpec } from './sunbeams';
import { crepuscularRaysNodeSpec } from './crepuscular-rays';
import { wavePatternsNodeSpec } from './wave-patterns';
import { hexagonalGridNodeSpec } from './hexagonal-grid';
import { stripesNodeSpec } from './stripes';
import { dotsNodeSpec } from './dots';
import { reactionDiffusionNodeSpec } from './reaction-diffusion';
import { truchetNodeSpec } from './truchet';
import { triangleGridNodeSpec } from './triangle-grid';
import { particleSystemNodeSpec } from './particle-system';
import { sphereRaymarchNodeSpec } from './sphere-raymarch';
import { boxTorusSdfNodeSpec } from './box-torus-sdf';
import { cylinderConeNodeSpec } from './cylinder-cone';
import { box2dNodeSpec } from './box-2d';
import { circleEllipseNodeSpec } from './circle-ellipse';
import { metaballsNodeSpec } from './metaballs';
import { star2dNodeSpec } from './star-2d';
import { superellipseNodeSpec } from './superellipse';
import { flowFieldPatternNodeSpec } from './flow-field-pattern';
import { fractalNodeSpec } from './fractal';
import { planeGridNodeSpec } from './plane-grid';
import { skyDomeNodeSpec } from './sky-dome';
import {
  addNodeSpec,
  subtractNodeSpec,
  multiplyNodeSpec,
  divideNodeSpec,
  powerNodeSpec,
  squareRootNodeSpec,
  absoluteNodeSpec,
  floorNodeSpec,
  ceilNodeSpec,
  fractNodeSpec,
  moduloNodeSpec,
  minNodeSpec,
  maxNodeSpec,
  clampNodeSpec,
  mixNodeSpec,
  stepNodeSpec,
  smoothstepNodeSpec,
  sineNodeSpec,
  cosineNodeSpec,
  tangentNodeSpec,
  arcSineNodeSpec,
  arcCosineNodeSpec,
  arcTangentNodeSpec,
  arcTangent2NodeSpec,
  exponentialNodeSpec,
  naturalLogarithmNodeSpec,
  lengthNodeSpec,
  distanceNodeSpec,
  dotProductNodeSpec,
  crossProductNodeSpec,
  normalizeNodeSpec,
  reflectNodeSpec,
  refractNodeSpec
} from './math-operations';
import { blendModeNodeSpec } from './blending-nodes';
import {
  compareNodeSpec,
  selectNodeSpec,
  maskCompositeFloatNodeSpec,
  maskCompositeVec3NodeSpec
} from './masking-nodes';
import { blurNodeSpec } from './blur';
import { glowBloomNodeSpec } from './glow-bloom';
import { edgeDetectionNodeSpec } from './edge-detection';
import { chromaticAberrationNodeSpec } from './chromatic-aberration';
import { rgbSeparationNodeSpec } from './rgb-separation';
import { scanlinesNodeSpec } from './scanlines';
import { colorGradingNodeSpec } from './color-grading';
import { normalMappingNodeSpec } from './normal-mapping';
import { lightingShadingNodeSpec } from './lighting-shading';
import { blendingModesNodeSpec } from './blending-modes';
// Post-processing nodes are now native NodeSpecs (migrated from VisualElements)
import {
  oneMinusNodeSpec,
  negateNodeSpec,
  reciprocalNodeSpec,
  remapNodeSpec,
  clamp01NodeSpec,
  saturateNodeSpec,
  signNodeSpec,
  roundNodeSpec,
  truncateNodeSpec,
  lerpNodeSpec,
  swizzleNodeSpec,
  splitVectorNodeSpec,
  combineVectorNodeSpec
} from './utility-nodes';
import {
  oklchColorNodeSpec,
  bezierCurveNodeSpec,
  bayerDitherNodeSpec,
  oklchColorMapBezierNodeSpec,
  oklchColorMapThresholdNodeSpec,
  toneMappingNodeSpec
} from './color-system-nodes';
import {
  audioFileInputNodeSpec,
  audioAnalyzerNodeSpec,
  audioRemapNodeSpec
} from './audio-nodes';

const _metaballs = metaballsNodeSpec;
export const nodeSystemSpecs: NodeSpec[] = [
  // Input nodes
  uvCoordinatesNodeSpec,
  timeNodeSpec,
  resolutionNodeSpec,
  fragmentCoordinatesNodeSpec,
  constantFloatNodeSpec,
  constantVec2NodeSpec,
  constantVec3NodeSpec,
  constantVec4NodeSpec,
  oklchColorNodeSpec,
  bezierCurveNodeSpec,
  
  // Transform nodes
  translateNodeSpec,
  rotateNodeSpec,
  scaleNodeSpec,
  domainRepetitionNodeSpec,

  // Distort/Transform nodes
  polarCoordinatesNodeSpec,
  vectorFieldNodeSpec,
  turbulenceNodeSpec,
  twistDistortionNodeSpec,
  kaleidoscopeNodeSpec,
  bulgePinchNodeSpec,
  rippleNodeSpec,
  fisheyeNodeSpec,
  mirrorFlipNodeSpec,
  displaceNodeSpec,
  vortexNodeSpec,
  spherizeNodeSpec,
  quadWarpNodeSpec,
  directionalDisplaceNodeSpec,
  brickTilingNodeSpec,
  infiniteZoomNodeSpec,
  kaleidoscopeSmoothNodeSpec,

  // Pattern/Noise nodes
  fbmNoiseNodeSpec,
  simplexNoiseNodeSpec,
  simplex3dNodeSpec,
  voronoiNoiseNodeSpec,
  cubicCurlNoiseNodeSpec,
  worleyNoiseNodeSpec,
  ringsNodeSpec,
  spiralNodeSpec,
  gradientNodeSpec,
  radialRaysNodeSpec,
  sunbeamsNodeSpec,
  crepuscularRaysNodeSpec,
  volumeRaysNodeSpec,
  streakNodeSpec,
  wavePatternsNodeSpec,
  flowFieldPatternNodeSpec,
  hexagonalGridNodeSpec,
  stripesNodeSpec,
  dotsNodeSpec,
  reactionDiffusionNodeSpec,
  truchetNodeSpec,
  triangleGridNodeSpec,
  particleSystemNodeSpec,

  // Shape/Geometry nodes
  sphereRaymarchNodeSpec,
  boxTorusSdfNodeSpec,
  cylinderConeNodeSpec,
  box2dNodeSpec,
  circleEllipseNodeSpec,
  _metaballs,
  star2dNodeSpec,
  superellipseNodeSpec,
  fractalNodeSpec,
  planeGridNodeSpec,
  skyDomeNodeSpec,

  // Math/Operation nodes
  addNodeSpec,
  subtractNodeSpec,
  multiplyNodeSpec,
  divideNodeSpec,
  powerNodeSpec,
  squareRootNodeSpec,
  absoluteNodeSpec,
  floorNodeSpec,
  ceilNodeSpec,
  fractNodeSpec,
  moduloNodeSpec,
  minNodeSpec,
  maxNodeSpec,
  clampNodeSpec,
  mixNodeSpec,
  stepNodeSpec,
  smoothstepNodeSpec,
  sineNodeSpec,
  cosineNodeSpec,
  tangentNodeSpec,
  arcSineNodeSpec,
  arcCosineNodeSpec,
  arcTangentNodeSpec,
  arcTangent2NodeSpec,
  exponentialNodeSpec,
  naturalLogarithmNodeSpec,
  lengthNodeSpec,
  distanceNodeSpec,
  dotProductNodeSpec,
  crossProductNodeSpec,
  normalizeNodeSpec,
  reflectNodeSpec,
  refractNodeSpec,
  
  // Blending nodes
  blendModeNodeSpec,
  
  // Masking/Control nodes
  compareNodeSpec,
  selectNodeSpec,
  maskCompositeFloatNodeSpec,
  maskCompositeVec3NodeSpec,
  
  // Post-Processing nodes
  blurNodeSpec,
  glowBloomNodeSpec,
  edgeDetectionNodeSpec,
  chromaticAberrationNodeSpec,
  rgbSeparationNodeSpec,
  scanlinesNodeSpec,
  colorGradingNodeSpec,
  normalMappingNodeSpec,
  lightingShadingNodeSpec,
  blendingModesNodeSpec,
  
  // Utility nodes
  oneMinusNodeSpec,
  negateNodeSpec,
  reciprocalNodeSpec,
  remapNodeSpec,
  clamp01NodeSpec,
  saturateNodeSpec,
  signNodeSpec,
  roundNodeSpec,
  truncateNodeSpec,
  lerpNodeSpec,
  swizzleNodeSpec,
  splitVectorNodeSpec,
  combineVectorNodeSpec,
  
  // Color System nodes
  oklchColorMapBezierNodeSpec,
  oklchColorMapThresholdNodeSpec,
  bayerDitherNodeSpec,
  toneMappingNodeSpec,
  
  // Operation nodes
  colorMapNodeSpec,
  
  // Output nodes
  finalOutputNodeSpec,
  
  // Audio nodes
  audioFileInputNodeSpec,
  audioAnalyzerNodeSpec,
  audioRemapNodeSpec
];
