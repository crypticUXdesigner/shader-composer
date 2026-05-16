import type { NodeSpec } from '../../types/nodeSpec';

/**
 * Ray–plane intersection: map screen position to UV on a oriented rectangle in 3D.
 * Built-in look-at camera or external ro/rd; plane center, normal, spin, width/height in world units.
 */
export const planeProjectNodeSpec: NodeSpec = {
  id: 'plane-project',
  category: 'Distort',
  displayName: 'Plane Project',
  icon: 'perspective',
  description:
    'Project screen rays onto a 3D plane; output planar UV and a hit mask. Built-in or external camera; world-scale plane.',
  inputs: [
    {
      name: 'in',
      type: 'vec2',
      label: 'Screen position',
    },
    {
      name: 'ro',
      type: 'vec3',
      label: 'Ray origin',
      fallbackParameter: 'posX,posY,posZ',
    },
    {
      name: 'rd',
      type: 'vec3',
      label: 'Ray direction',
    },
  ],
  outputs: [
    {
      name: 'uv',
      type: 'vec2',
      label: 'UV',
    },
    {
      name: 'hit',
      type: 'float',
      label: 'Hit',
    },
  ],
  parameters: {
    cameraSource: {
      type: 'int',
      default: 0,
      min: 0,
      max: 1,
      step: 1,
      label: 'Camera',
    },
    posX: {
      type: 'float',
      default: 0.0,
      min: -50.0,
      max: 50.0,
      step: 0.1,
      label: 'Position X',
      knobPolarity: 'two-sided',
    },
    posY: {
      type: 'float',
      default: 0.0,
      min: -50.0,
      max: 50.0,
      step: 0.1,
      label: 'Position Y',
      knobPolarity: 'two-sided',
    },
    posZ: {
      type: 'float',
      default: 3.0,
      min: -50.0,
      max: 50.0,
      step: 0.1,
      label: 'Position Z',
      knobPolarity: 'two-sided',
    },
    lookatX: {
      type: 'float',
      default: 0.0,
      min: -50.0,
      max: 50.0,
      step: 0.1,
      label: 'Look-at X',
      knobPolarity: 'two-sided',
    },
    lookatY: {
      type: 'float',
      default: 0.0,
      min: -50.0,
      max: 50.0,
      step: 0.1,
      label: 'Look-at Y',
      knobPolarity: 'two-sided',
    },
    lookatZ: {
      type: 'float',
      default: 0.0,
      min: -50.0,
      max: 50.0,
      step: 0.1,
      label: 'Look-at Z',
      knobPolarity: 'two-sided',
    },
    zoom: {
      type: 'float',
      default: 2.0,
      min: 0.1,
      max: 50.0,
      step: 0.1,
      label: 'Zoom',
    },
    centerX: {
      type: 'float',
      default: 0.0,
      min: -50.0,
      max: 50.0,
      step: 0.1,
      label: 'Center X',
      knobPolarity: 'two-sided',
    },
    centerY: {
      type: 'float',
      default: 0.0,
      min: -50.0,
      max: 50.0,
      step: 0.1,
      label: 'Center Y',
      knobPolarity: 'two-sided',
    },
    centerZ: {
      type: 'float',
      default: 0.0,
      min: -50.0,
      max: 50.0,
      step: 0.1,
      label: 'Center Z',
      knobPolarity: 'two-sided',
    },
    normalX: {
      type: 'float',
      default: 0.0,
      min: -1.0,
      max: 1.0,
      step: 0.01,
      label: 'Normal X',
      knobPolarity: 'two-sided',
    },
    normalY: {
      type: 'float',
      default: 0.0,
      min: -1.0,
      max: 1.0,
      step: 0.01,
      label: 'Normal Y',
      knobPolarity: 'two-sided',
    },
    normalZ: {
      type: 'float',
      default: 1.0,
      min: -1.0,
      max: 1.0,
      step: 0.01,
      label: 'Normal Z',
      knobPolarity: 'two-sided',
    },
    rotation: {
      type: 'float',
      default: 0.0,
      min: -180.0,
      max: 180.0,
      step: 1.0,
      label: 'Spin',
      knobPolarity: 'two-sided',
    },
    width: {
      type: 'float',
      default: 4.0,
      min: 0.01,
      max: 100.0,
      step: 0.01,
      label: 'Width',
    },
    height: {
      type: 'float',
      default: 4.0,
      min: 0.01,
      max: 100.0,
      step: 0.01,
      label: 'Height',
    },
    uvMode: {
      type: 'int',
      default: 1,
      min: 0,
      max: 2,
      step: 1,
      label: 'UV mode',
    },
    clipRect: {
      type: 'int',
      default: 1,
      min: 0,
      max: 1,
      step: 1,
      label: 'Clip',
    },
  },
  parameterGroups: [
    {
      id: 'camera',
      label: 'Camera',
      parameters: [
        'cameraSource',
        'posX',
        'posY',
        'posZ',
        'lookatX',
        'lookatY',
        'lookatZ',
        'zoom',
      ],
      collapsible: true,
      defaultCollapsed: false,
    },
    {
      id: 'plane',
      label: 'Plane',
      parameters: [
        'centerX',
        'centerY',
        'centerZ',
        'normalX',
        'normalY',
        'normalZ',
        'rotation',
        'width',
        'height',
      ],
      collapsible: true,
      defaultCollapsed: false,
    },
    {
      id: 'uv-out',
      label: 'UV',
      parameters: ['uvMode', 'clipRect'],
      collapsible: true,
      defaultCollapsed: false,
    },
  ],
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        label: 'Camera',
        parameters: ['cameraSource', 'zoom'],
        layout: { columns: 2, parameterSpan: { cameraSource: 2 } },
      },
      {
        type: 'grid',
        parameters: ['posX', 'posY', 'posZ'],
        layout: { columns: 3 },
        visibleWhen: { parameter: 'cameraSource', equals: 0 },
      },
      {
        type: 'grid',
        parameters: ['lookatX', 'lookatY', 'lookatZ'],
        layout: { columns: 3 },
        visibleWhen: { parameter: 'cameraSource', equals: 0 },
      },
      {
        type: 'grid',
        label: 'Plane',
        parameters: ['centerX', 'centerY', 'centerZ'],
        layout: { columns: 3 },
      },
      {
        type: 'grid',
        parameters: ['normalX', 'normalY', 'normalZ', 'rotation'],
        layout: { columns: 2, parameterSpan: { rotation: 2 } },
      },
      {
        type: 'grid',
        parameters: ['width', 'height', 'uvMode', 'clipRect'],
        layout: { columns: 2 },
      },
    ],
  },
  functions: `
const float PLANE_PROJECT_GRAZING_EPS = 1.0e-4;

void planeProjectBasis(vec3 n, out vec3 tangentU, out vec3 tangentV) {
  vec3 helper = abs(n.y) < 0.999 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  tangentU = normalize(cross(helper, n));
  tangentV = cross(n, tangentU);
}

void planeProjectFrame(vec3 n, float angleDeg, out vec3 tangentU, out vec3 tangentV) {
  planeProjectBasis(n, tangentU, tangentV);
  float a = angleDeg * 0.01745329252;
  float c = cos(a);
  float s = sin(a);
  vec3 u0 = tangentU;
  tangentU = normalize(u0 * c + tangentV * s);
  tangentV = cross(n, tangentU);
}

void planeProjectLookAtRays(
  vec2 screenPos,
  vec3 pos,
  vec3 lookat,
  float zoomVal,
  out vec3 ro,
  out vec3 rd
) {
  ro = pos;
  vec3 f = normalize(lookat - ro);
  vec3 r = normalize(cross(vec3(0.0, 1.0, 0.0), f));
  vec3 u = cross(f, r);
  vec3 center = ro + f * zoomVal;
  vec3 i = center + screenPos.x * r + screenPos.y * u;
  rd = normalize(i - ro);
}
`,
  mainCode: `
  vec3 roBuilt;
  vec3 rdBuilt;
  planeProjectLookAtRays(
    $input.in,
    vec3($param.posX, $param.posY, $param.posZ),
    vec3($param.lookatX, $param.lookatY, $param.lookatZ),
    $param.zoom,
    roBuilt,
    rdBuilt
  );

  vec3 ro = roBuilt;
  vec3 rd = rdBuilt;
  if ($param.cameraSource == 1) {
    vec3 roIn = $input.ro;
    vec3 rdIn = $input.rd;
    if (dot(roIn, roIn) > 1.0e-8) {
      ro = roIn;
    }
    if (dot(rdIn, rdIn) > 1.0e-8) {
      rd = normalize(rdIn);
    }
  }

  vec3 planeCenter = vec3($param.centerX, $param.centerY, $param.centerZ);
  vec3 n = normalize(vec3($param.normalX, $param.normalY, $param.normalZ));
  float denom = dot(rd, n);

  float hit = 0.0;
  vec2 uvOut = vec2(0.0);

  if (abs(denom) > PLANE_PROJECT_GRAZING_EPS) {
    float t = dot(planeCenter - ro, n) / denom;
    if (t > 0.0) {
      vec3 hitPoint = ro + rd * t;
      vec3 rel = hitPoint - planeCenter;
      vec3 tangentU;
      vec3 tangentV;
      planeProjectFrame(n, $param.rotation, tangentU, tangentV);
      float u = dot(rel, tangentU);
      float v = dot(rel, tangentV);
      float halfW = max($param.width * 0.5, 1.0e-6);
      float halfH = max($param.height * 0.5, 1.0e-6);

      if ($param.uvMode == 0) {
        uvOut = vec2(u, v);
      } else if ($param.uvMode == 1) {
        uvOut = vec2(u / halfW * 0.5 + 0.5, v / halfH * 0.5 + 0.5);
      } else {
        uvOut = vec2(u / halfW, v / halfH);
      }

      hit = 1.0;

      if ($param.clipRect == 1 && $param.uvMode != 0) {
        if ($param.uvMode == 1) {
          if (uvOut.x < 0.0 || uvOut.x > 1.0 || uvOut.y < 0.0 || uvOut.y > 1.0) {
            hit = 0.0;
          }
        } else if (abs(uvOut.x) > 1.0 || abs(uvOut.y) > 1.0) {
          hit = 0.0;
        }
      }
    }
  }

  $output.uv = uvOut;
  $output.hit = hit;
`,
};
