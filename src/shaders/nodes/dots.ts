import type { NodeSpec } from '../../types';

export const dotsNodeSpec: NodeSpec = {
  id: 'dots',
  category: 'Patterns',
  displayName: 'Dots',
  description: 'Polka-dot grid pattern with configurable spacing, dot size, and falloff',
  icon: 'grain',
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
    dotsSpacing: {
      type: 'float',
      default: 0.1,
      min: 0.01,
      max: 1.0,
      step: 0.01,
      label: 'Spacing'
    },
    dotsSize: {
      type: 'float',
      default: 0.3,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Dot Size'
    },
    dotsFalloff: {
      type: 'float',
      default: 0.05,
      min: 0.0,
      max: 0.5,
      step: 0.01,
      label: 'Falloff'
    },
    dotsIntensity: {
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
      id: 'dots-grid',
      label: 'Grid',
      parameters: ['dotsSpacing'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'dots-shape',
      label: 'Dots',
      parameters: ['dotsSize', 'dotsFalloff'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'dots-output',
      label: 'Output',
      parameters: ['dotsIntensity'],
      collapsible: true,
      defaultCollapsed: false
    }
  ],
  functions: `
float dotsPattern(vec2 p, float spacing, float dotRadius, float falloff) {
  vec2 cell = fract(p / spacing);
  vec2 center = vec2(0.5, 0.5);
  float dist = length(cell - center);
  float radius = dotRadius * 0.5;
  return 1.0 - smoothstep(radius, radius + falloff, dist);
}
`,
  mainCode: `
  float dotVal = dotsPattern(
    $input.in,
    $param.dotsSpacing,
    $param.dotsSize,
    $param.dotsFalloff
  );
  $output.out += dotVal * $param.dotsIntensity;
`
};
