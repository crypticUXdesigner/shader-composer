import type { NodeSpec } from '../../types/nodeSpec';

export const triangleGridNodeSpec: NodeSpec = {
  id: 'triangle-grid',
  category: 'Patterns',
  displayName: 'Triangle Grid',
  description: 'Regular triangular tiling with configurable edges and optional fill',
  icon: 'triangles',
  inputs: [
    {
      name: 'in',
      type: 'vec2',
      label: 'Position'
    }
  ],
  outputs: [
    {
      name: 'out',
      type: 'float',
      label: 'Value'
    }
  ],
  parameters: {
    triScale: {
      type: 'float',
      default: 5.0,
      min: 0.5,
      max: 30.0,
      step: 0.1,
      label: 'Scale'
    },
    triLineWidth: {
      type: 'float',
      default: 0.02,
      min: 0.001,
      max: 0.3,
      step: 0.002,
      label: 'Line Width'
    },
    triIntensity: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 2.0,
      step: 0.01,
      label: 'Intensity'
    },
    triFill: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 1.0,
      step: 1.0,
      label: 'Fill'
    }
  },
  parameterGroups: [
    {
      id: 'tri-grid',
      label: 'Grid',
      parameters: ['triScale'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'tri-edges',
      label: 'Edges',
      parameters: ['triLineWidth'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'tri-output',
      label: 'Output',
      parameters: ['triIntensity', 'triFill'],
      collapsible: true,
      defaultCollapsed: false
    }
  ],
  functions: `
// Equilateral triangle grid: three families of lines at 0°, 60°, 120°
// Returns distance to nearest edge and optional cell id for fill
void triangleGrid(vec2 p, float spacing, out float distToEdge, out float cellId) {
  const float sqrt3 = 1.7320508;
  float s = max(0.001, spacing);

  // Perpendicular distances to the three line families (in world space)
  float u0 = p.x / s;
  float u1 = (p.x * 0.5 + p.y * (sqrt3 * 0.5)) / s;
  float u2 = (-p.x * 0.5 + p.y * (sqrt3 * 0.5)) / s;

  // Distance to nearest line in each family (fract gives position in 0..1 band)
  float d0 = abs(fract(u0 + 0.5) - 0.5) * s;
  float d1 = abs(fract(u1 + 0.5) - 0.5) * s;
  float d2 = abs(fract(u2 + 0.5) - 0.5) * s;

  distToEdge = min(min(d0, d1), d2);

  // Cell id for fill: combine floor of the three coordinates
  vec3 fl = vec3(floor(u0 + 0.5), floor(u1 + 0.5), floor(u2 + 0.5));
  cellId = mod(fl.x + fl.y + fl.z, 2.0);
}
`,
  mainCode: `
  vec2 p = $input.in;
  float distToEdge = 0.0;
  float cellId = 0.0;
  triangleGrid(p, max(0.001, $param.triScale), distToEdge, cellId);

  float lineWidth = max(0.0001, $param.triLineWidth);
  float edge = 1.0 - smoothstep(0.0, lineWidth, distToEdge);
  float fillVal = cellId;
  float pattern = mix(edge, fillVal, $param.triFill);
  $output.out += pattern * $param.triIntensity;
`
};
