import type { NodeSpec } from '../../types/nodeSpec';

/**
 * Rain drops (windshield): procedural UV offset for rain-on-glass effect.
 * Reference: Shadertoy "The Drive Home" (ltfXzj) GetDrops — tiled cells, N31 hash,
 * sawtooth motion, trail drops. Output offset is subtracted from UV before camera.
 */
export const rainDropsNodeSpec: NodeSpec = {
  id: 'rain-drops',
  category: 'Patterns',
  displayName: 'Rain Drops',
  description:
    'Procedural rain drops on glass: outputs a vec2 UV offset. Subtract from UV and feed to camera for windshield distortion. Uses tiled cells, sawtooth motion, and trails (reference: Shadertoy The Drive Home).',
  icon: 'droplets',
  inputs: [
    { name: 'in', type: 'vec2', label: 'UV' },
    {
      name: 'time',
      type: 'float',
      label: 'Time',
      fallbackExpression: '$time'
    }
  ],
  outputs: [{ name: 'out', type: 'vec2', label: 'UV' }],
  parameters: {
    scale: {
      type: 'float',
      default: 1.0,
      min: 0.2,
      max: 3.0,
      step: 0.1,
      label: 'Scale'
    },
    seed: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 100.0,
      step: 0.5,
      label: 'Seed'
    },
    speed: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 3.0,
      step: 0.05,
      label: 'Speed'
    },
    layers: {
      type: 'int',
      default: 2,
      min: 1,
      max: 3,
      step: 1,
      label: 'Layers'
    },
    sizeVariation: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 2.5,
      step: 0.05,
      label: 'Size var.'
    },
    quantityPerLayer: {
      type: 'float',
      default: 1.0,
      min: 0.25,
      max: 3.0,
      step: 0.1,
      label: 'Amount'
    }
  },
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        parameters: ['scale', 'seed', 'speed', 'layers', 'sizeVariation', 'quantityPerLayer'],
        layout: { columns: 2 }
      }
    ]
  },
  functions: `
// N31 hash (Dave Hoskins style) — reference: Shadertoy The Drive Home
vec3 rainN31(float p) {
  vec3 p3 = fract(vec3(p) * vec3(0.1031, 0.11369, 0.13787));
  p3 += dot(p3, p3.yzx + 19.19);
  return fract(vec3((p3.x + p3.y) * p3.z, (p3.x + p3.z) * p3.y, (p3.y + p3.z) * p3.x));
}
float rainSawTooth(float t) {
  return cos(t + cos(t)) + sin(2.0 * t) * 0.2 + sin(4.0 * t) * 0.02;
}
float rainDeltaSawTooth(float t) {
  return 0.4 * cos(2.0 * t) + 0.08 * cos(4.0 * t) - (1.0 - sin(t)) * sin(t + cos(t));
}
vec2 rainGetDrops(vec2 uv, float seed, float t, float sizeVariation, float quantityPerLayer) {
  vec2 o = vec2(0.0);
  uv.y += t * 0.05;
  uv *= vec2(10.0, 2.5) * 2.0 * quantityPerLayer;
  vec2 id = floor(uv);
  vec3 n = rainN31(id.x + (id.y + seed) * 546.3524);
  vec2 bd = fract(uv);
  vec2 uv2 = bd;
  bd -= 0.5;
  bd.y *= 4.0;
  bd.x += (n.x - 0.5) * 0.6;
  t += n.z * 6.2831853;
  float slide = rainSawTooth(t);
  float ts = 1.5;
  vec2 trailPos = vec2(bd.x * ts, (fract(bd.y * ts * 2.0 - t * 2.0) - 0.5) * 0.5);
  bd.y += slide * 2.0;
  float dropShape = bd.x * bd.x;
  dropShape *= rainDeltaSawTooth(t);
  bd.y += dropShape;
  float d = length(bd);
  float trailMask = smoothstep(-0.2, 0.2, bd.y);
  trailMask *= bd.y;
  float td = length(trailPos * max(0.5, trailMask));
  float sizeMul = max(0.2, 1.0 + sizeVariation * (n.x - 0.5));
  float rOuter = 0.2 * sizeMul;
  float rInner = 0.1 * sizeMul;
  float mainDrop = smoothstep(rOuter, rInner, d);
  float trailOuter = 0.1 * sizeMul;
  float trailInner = 0.02 * sizeMul;
  float dropTrail = smoothstep(trailOuter, trailInner, td);
  dropTrail *= trailMask;
  o = mix(bd * mainDrop, trailPos, dropTrail);
  return o;
}
`,
  mainCode: `
  float t = $input.time * $param.speed;
  vec2 uv = $input.in * $param.scale;
  vec2 offs = rainGetDrops(uv, $param.seed, t, $param.sizeVariation, $param.quantityPerLayer);
  if ($param.layers >= 2) offs += rainGetDrops(uv * 1.4, $param.seed + 10.0, t, $param.sizeVariation, $param.quantityPerLayer);
  if ($param.layers >= 3) offs += rainGetDrops(uv * 2.4, $param.seed + 25.0, t, $param.sizeVariation, $param.quantityPerLayer);
  $output.out = offs;
`
};
