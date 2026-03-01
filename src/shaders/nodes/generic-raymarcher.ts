import type { NodeSpec } from '../../types/nodeSpec';

/**
 * Generic SDF Raymarcher
 * Raymarch loop that uses a graph-derived SDF (vec3 → float). No hardcoded scene.
 * Inputs: UV (vec2), SDF (float from graph), optional displacement (vec3), optional ro/rd (vec3) for camera.
 * Optional output color (vec3): hit-position-based RGB with step-count fog when connected.
 * Compiler emits a function that evaluates the connected SDF at vec3 p; this node calls it in the loop.
 * Placeholders $sdf_call and $displacement_at_p are replaced by the compiler.
 */
export const genericRaymarcherNodeSpec: NodeSpec = {
  id: 'generic-raymarcher',
  category: 'SDF',
  displayName: 'Raymarch',
  description:
    'Raymarch a scene using an SDF from the graph. Connect a node with vec3 position in and float out (e.g. Repeated Hex Prism SDF). Optionally connect ro/rd (e.g. Orbit Camera) for custom camera; optionally connect 3D Displacement. Output out (float) is glow; optional output color (vec3) is hit color with depth fog.',
  icon: 'cube-transparent',
  inputs: [
    {
      name: 'in',
      type: 'vec2',
      label: 'UV'
    },
    {
      name: 'sdf',
      type: 'float',
      label: 'SDF'
    },
    {
      name: 'displacement',
      type: 'vec3',
      label: 'Displacement'
    },
    {
      name: 'ro',
      type: 'vec3',
      label: 'Ray origin',
      fallbackParameter: 'cameraRoX,cameraRoY,cameraRoZ'
    },
    {
      name: 'rd',
      type: 'vec3',
      label: 'Ray direction',
      fallbackExpression: 'normalize(vec3($input.in, -1.0))'
    }
  ],
  outputs: [
    {
      name: 'out',
      type: 'float',
      label: 'Glow'
    },
    {
      name: 'color',
      type: 'vec3',
      label: 'Color'
    }
  ],
  parameters: {
    raymarchSteps: {
      type: 'int',
      default: 64,
      min: 16,
      max: 200,
      step: 1,
      label: 'Steps',
      supportsAnimation: false,
      supportsAudio: false
    },
    glowIntensity: {
      type: 'float',
      default: 0.3,
      min: 0.0,
      max: 2.0,
      step: 0.01,
      label: 'Glow',
      supportsAnimation: true,
      supportsAudio: true
    },
    brightness: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 3.0,
      step: 0.1,
      label: 'Brightness',
      supportsAnimation: true,
      supportsAudio: true
    },
    cameraRoX: {
      type: 'float',
      default: 0.0,
      min: -10.0,
      max: 10.0,
      step: 0.1,
      label: 'Ro X',
      inputMode: 'override',
      supportsAnimation: true,
      supportsAudio: true
    },
    cameraRoY: {
      type: 'float',
      default: 0.0,
      min: -10.0,
      max: 10.0,
      step: 0.1,
      label: 'Ro Y',
      inputMode: 'override',
      supportsAnimation: true,
      supportsAudio: true
    },
    cameraRoZ: {
      type: 'float',
      default: 3.0,
      min: -10.0,
      max: 10.0,
      step: 0.1,
      label: 'Ro Z',
      inputMode: 'override',
      supportsAnimation: true,
      supportsAudio: true
    }
  },
  parameterGroups: [
    {
      id: 'raymarch',
      label: 'Raymarch',
      parameters: ['raymarchSteps', 'glowIntensity', 'brightness'],
      collapsible: false,
      defaultCollapsed: false
    },
    {
      id: 'camera',
      label: 'Camera (when ro/rd unconnected)',
      parameters: ['cameraRoX', 'cameraRoY', 'cameraRoZ'],
      collapsible: true,
      defaultCollapsed: true
    }
  ],
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        parameters: ['raymarchSteps', 'glowIntensity', 'brightness'],
        layout: { columns: 3 }
      },
      {
        type: 'grid',
        label: 'Camera',
        parameters: ['cameraRoX', 'cameraRoY', 'cameraRoZ'],
        layout: { columns: 3 }
      }
    ]
  },
  mainCode: `
  vec3 ro = $input.ro;
  vec3 rd = normalize($input.rd);

  float steps = float($param.raymarchSteps);
  steps = clamp(steps, 16.0, 200.0);
  float glowMult = $param.glowIntensity * $param.brightness;

  mediump float t = 0.0;
  mediump vec4 acc = vec4(0.0);

  for (int i = 0; i < 200; i++) {
    if (float(i) >= steps) break;
    mediump vec3 pos = ro + rd * t;
    mediump vec3 posDisplaced = pos + $displacement_at_p;
    mediump float d = $sdf_call;
    if (d < 0.001) {
      mediump vec3 ip = ro + rd * t;
      mediump vec3 hitColor = vec3(
        0.7 + 0.3 * sin(ip.z/8.0 + ip.x/2.0),
        0.6 + 0.3 * cos(ip.z/8.0 + ip.y/2.0),
        0.5 + 0.4 * sin(ip.z/8.0 + ip.x)
      );
      float fog = float(i) / steps;
      $output.color = hitColor - vec3(fog, fog, fog);
      acc += (cos(d / 0.1 + vec4(0.0, 2.0, 4.0, 0.0)) + 1.0) / 0.001 * max(t, 0.01) * glowMult;
      t += 0.001;
      break;
    }
    acc += (cos(d / 0.1 + vec4(0.0, 2.0, 4.0, 0.0)) + 1.0) / d * max(t, 0.01) * glowMult;
    t += d;
    if (t > 100.0) break;
  }

  float norm = length(acc.rgb);
  float div = 200.0 / max(glowMult, 0.1);
  $output.out += clamp(norm / div, 0.0, 1.0);
`
};
