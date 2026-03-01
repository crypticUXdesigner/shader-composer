/**
 * Central enum label mappings for int parameters that use the select (dropdown) UI.
 * Used by NodeBody (EnumSelector) and OverlayManager dropdown so the same labels appear.
 */

export function isEnumParameter(specId: string, paramName: string): boolean {
  return getParameterEnumMappings(specId, paramName) !== null;
}

export function getParameterEnumMappings(
  nodeId: string,
  paramName: string
): Record<number, string> | null {
  // compare node - operation
  if (nodeId === 'compare' && paramName === 'operation') {
    return {
      0: 'Equal (==)',
      1: 'Not Equal (!=)',
      2: 'Less Than (<)',
      3: 'Less or Equal (<=)',
      4: 'Greater Than (>)',
      5: 'Greater or Equal (>=)'
    };
  }

  // blend-mode node - mode
  if (nodeId === 'blend-mode' && paramName === 'mode') {
    return {
      0: 'Normal',
      1: 'Multiply',
      2: 'Screen',
      3: 'Overlay',
      4: 'Soft Light',
      5: 'Hard Light',
      6: 'Color Dodge',
      7: 'Color Burn',
      8: 'Linear Dodge',
      9: 'Linear Burn',
      10: 'Difference',
      11: 'Exclusion'
    };
  }

  // gradient-mask node - maskType
  if (nodeId === 'gradient-mask' && paramName === 'maskType') {
    return {
      0: 'Radial',
      1: 'Linear',
      2: 'Elliptical'
    };
  }

  // block-edge-brightness node - direction
  if (nodeId === 'block-edge-brightness' && paramName === 'direction') {
    return { 0: 'Horizontal', 1: 'Vertical' };
  }

  // block-color-glitch node - direction
  if (nodeId === 'block-color-glitch' && paramName === 'direction') {
    return { 0: 'Horizontal', 1: 'Vertical' };
  }

  // plane-grid node - planeType
  if (nodeId === 'plane-grid' && paramName === 'planeType') {
    return {
      0: 'Raymarched',
      1: 'Grid',
      2: 'Checkerboard'
    };
  }

  // box-torus-sdf node - primitiveType
  if (nodeId === 'box-torus-sdf' && paramName === 'primitiveType') {
    return {
      0: 'Box',
      1: 'Torus',
      2: 'Capsule',
      3: 'Cylinder',
      4: 'Cone',
      5: 'Round Cone',
      6: 'Octahedron',
      7: 'Icosahedron'
    };
  }

  // voronoi-noise
  if (nodeId === 'voronoi-noise' && paramName === 'voronoiDistanceMetric') {
    return { 0: 'Euclidean', 1: 'Manhattan', 2: 'Chebyshev' };
  }
  if (nodeId === 'voronoi-noise' && paramName === 'voronoiAnimationMode') {
    return { 0: 'Drift', 1: 'Rotate', 2: 'Still' };
  }
  if (nodeId === 'voronoi-noise' && paramName === 'voronoiOutputMode') {
    return { 0: 'F1', 1: 'F2−F1', 2: 'Edge', 3: 'Cell ID' };
  }

  // gradient
  if (nodeId === 'gradient' && paramName === 'gradientType') {
    return { 0: 'Radial', 1: 'Linear' };
  }

  // shapes-2d
  if (nodeId === 'shapes-2d' && paramName === 'shapeType') {
    return { 0: 'Circle', 1: 'Square' };
  }

  // hex-voxel - shapeType
  if (nodeId === 'hex-voxel' && paramName === 'shapeType') {
    return { 0: 'Boxy', 1: 'Sphere minus box', 2: 'Heightmap' };
  }

  // cylinder-cone
  if (nodeId === 'cylinder-cone' && paramName === 'primitiveType') {
    return { 0: 'Cylinder', 1: 'Cone' };
  }

  // worley-noise
  if (nodeId === 'worley-noise' && paramName === 'worleyDistanceMetric') {
    return { 0: 'Euclidean', 1: 'Manhattan', 2: 'Chebyshev' };
  }
  if (nodeId === 'worley-noise' && paramName === 'worleyOutputMode') {
    return { 0: 'F1', 1: 'F2−F1', 2: 'Edge' };
  }

  // reaction-diffusion
  if (nodeId === 'reaction-diffusion' && paramName === 'steps') {
    return { 1: '1 Step', 2: '2 Steps', 3: '3 Steps', 4: '4 Steps', 5: '5 Steps' };
  }

  // noise
  if (nodeId === 'noise' && paramName === 'noiseMode') {
    return { 0: 'Simplex 2D', 1: 'Simplex 3D', 2: 'Value fBm' };
  }

  // blending-modes
  if (nodeId === 'blending-modes' && paramName === 'blendMode') {
    return {
      0: 'Multiply',
      1: 'Screen',
      2: 'Overlay',
      3: 'Soft Light',
      4: 'Hard Light',
      5: 'Color Dodge',
      6: 'Color Burn',
      7: 'Linear Dodge',
      8: 'Linear Burn',
      9: 'Difference',
      10: 'Exclusion'
    };
  }
  if (nodeId === 'blending-modes' && paramName === 'blendSource') {
    return { 0: 'Parameter', 1: 'Noise', 2: 'Wave' };
  }

  // wave-patterns
  if (nodeId === 'wave-patterns' && paramName === 'waveType') {
    return { 0: 'Sine', 1: 'Cosine', 2: 'Square', 3: 'Triangle' };
  }

  // blur
  if (nodeId === 'blur' && paramName === 'blurType') {
    return { 0: 'Gaussian', 1: 'Directional', 2: 'Radial' };
  }

  // particle-system
  if (nodeId === 'particle-system' && paramName === 'particleCount') {
    return { 1: '1', 2: '2', 3: '3', 4: '4' };
  }

  // lighting-shading
  if (nodeId === 'lighting-shading' && paramName === 'lightType') {
    return { 0: 'Directional', 1: 'Point' };
  }

  // combine-vector (utility) - outputType 2=vec2, 3=vec3, 4=vec4
  if (nodeId === 'combine-vector' && paramName === 'outputType') {
    return { 2: 'vec2', 3: 'vec3', 4: 'vec4' };
  }

  // ripple
  if (nodeId === 'ripple' && paramName === 'rippleMode') {
    return { 0: 'Concentric', 1: 'Directional' };
  }

  return null;
}
