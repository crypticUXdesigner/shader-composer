import type { NodeSpec } from '../../types';

export const truchetNodeSpec: NodeSpec = {
  id: 'truchet',
  category: 'Patterns',
  displayName: 'Truchet',
  description: 'Truchet tiling with quarter-circles or diagonal lines and optional random flip per cell',
  icon: 'shapes',
  inputs: [
    {
      name: 'in',
      type: 'vec2'
    }
  ],
  outputs: [
    {
      name: 'out',
      type: 'float'
    }
  ],
  parameters: {
    truchetScale: {
      type: 'float',
      default: 4.0,
      min: 0.5,
      max: 20.0,
      step: 0.1,
      label: 'Cell Size'
    },
    truchetTileType: {
      type: 'int',
      default: 0,
      min: 0,
      max: 1,
      step: 1,
      label: 'Tile Type'
    },
    truchetRandomFlip: {
      type: 'int',
      default: 1,
      min: 0,
      max: 1,
      step: 1,
      label: 'Random Flip'
    },
    truchetArcWidth: {
      type: 'float',
      default: 0.08,
      min: 0.001,
      max: 0.5,
      step: 0.005,
      label: 'Arc Width'
    },
    truchetLineWidth: {
      type: 'float',
      default: 0.06,
      min: 0.001,
      max: 0.5,
      step: 0.005,
      label: 'Line Width'
    },
    truchetIntensity: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 2.0,
      step: 0.01,
      label: 'Intensity'
    }
  },
  parameterGroups: [
    {
      id: 'truchet-main',
      label: 'Truchet',
      parameters: ['truchetScale', 'truchetTileType', 'truchetRandomFlip'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'truchet-appearance',
      label: 'Appearance',
      parameters: ['truchetArcWidth', 'truchetLineWidth', 'truchetIntensity'],
      collapsible: true,
      defaultCollapsed: false
    }
  ],
  functions: `
float hash21(vec2 p) {
  return fract(sin(dot(floor(p), vec2(127.1, 311.7))) * 43758.5453123);
}

// SDF for quarter circle at origin, radius 1, first quadrant (0,0)-(1,1) arc
float sdQuarterCircle(vec2 p) {
  float d = length(p) - 1.0;
  float quarter = step(0.0, p.x) * step(0.0, p.y);
  return max(d, -quarter);
}

// SDF for segment from (0,0) to (1,1)
float sdSegment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

float truchetQuarterCircles(vec2 uv, float arcWidth) {
  // Two quarter-circles: at (0,0) and (1,1) in cell
  float d1 = sdQuarterCircle(uv);
  float d2 = sdQuarterCircle(vec2(1.0, 1.0) - uv);
  float d = min(d1, d2);
  return 1.0 - smoothstep(0.0, arcWidth, d);
}

float truchetLines(vec2 uv, float lineWidth) {
  // Diagonal from (0,0) to (1,1)
  float d = sdSegment(uv, vec2(0.0, 0.0), vec2(1.0, 1.0));
  return 1.0 - smoothstep(0.0, lineWidth, d);
}
`,
  mainCode: `
  vec2 p = $input.in;
  float scale = max(0.001, $param.truchetScale);
  vec2 cellId = floor(p / scale);
  vec2 uv = fract(p / scale);

  if ($param.truchetRandomFlip == 1 && hash21(cellId) > 0.5) {
    uv = vec2(uv.x, 1.0 - uv.y);
  }

  float pattern = 0.0;
  if ($param.truchetTileType == 0) {
    pattern = truchetQuarterCircles(uv, $param.truchetArcWidth);
  } else {
    pattern = truchetLines(uv, $param.truchetLineWidth);
  }

  $output.out += pattern * $param.truchetIntensity;
`
};
