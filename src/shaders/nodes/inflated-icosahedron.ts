import type { NodeSpec } from '../../types/nodeSpec';

/**
 * Inflated Icosahedron: raymarched 3D scene with icosahedron domain folding,
 * twist around nearest vertex, optional 3D polar repetition, per-face IQ palette,
 * soft shadows, AO, and full lighting. Reference: Shadertoy ltfXzj (HG_SDF, knighty, tdhooper, IQ).
 */
export const inflatedIcosahedronNodeSpec: NodeSpec = {
  id: 'inflated-icosahedron',
  category: 'Shapes',
  displayName: 'Icosahedron',
  icon: 'sphere',
  description:
    'Raymarched 3D inflated icosahedron with icosahedron domain folding, twist-around-vertex deformation, optional polar repetition, per-face palette coloring, soft shadows, AO, and lighting.',
  inputs: [
    { name: 'in', type: 'vec2', label: 'Screen position' },
    {
      name: 'ro',
      type: 'vec3',
      label: 'Ray origin',
      fallbackExpression:
        'vec3($param.orbitRadius * cos($time * $param.orbitSpeed), 0.0, $param.orbitRadius * sin($time * $param.orbitSpeed))'
    },
    {
      name: 'rd',
      type: 'vec3',
      label: 'Ray direction',
      fallbackExpression:
        'normalize(2.0 * normalize(-$input.ro) + (2.0 * $input.in.x - 1.0) * normalize(cross(normalize(-$input.ro), vec3(0.0, 1.0, 0.0))) + (2.0 * $input.in.y - 1.0) * cross(normalize(cross(normalize(-$input.ro), vec3(0.0, 1.0, 0.0))), normalize(-$input.ro)))'
    }
  ],
  outputs: [{ name: 'out', type: 'vec3', label: 'Color' }],
  parameters: {
    timeScale: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 2.0,
      step: 0.05,
      label: 'Time scale'
    },
    twistAmount: {
      type: 'float',
      default: 5.5,
      min: 0.0,
      max: 15.0,
      step: 0.1,
      label: 'Twist'
    },
    seamlessLoop: {
      type: 'int',
      default: 1,
      min: 0,
      max: 1,
      step: 1,
      label: 'Seamless loop'
    },
    raymarchSteps: {
      type: 'int',
      default: 100,
      min: 32,
      max: 150,
      step: 1,
      label: 'Steps'
    },
    orbitRadius: {
      type: 'float',
      default: 3.3,
      min: 1.0,
      max: 10.0,
      step: 0.1,
      label: 'Orbit radius'
    },
    orbitSpeed: {
      type: 'float',
      default: 0.5,
      min: 0.0,
      max: 2.0,
      step: 0.05,
      label: 'Orbit speed'
    },
    brightness: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 2.0,
      step: 0.05,
      label: 'Brightness'
    }
  },
  parameterGroups: [
    {
      id: 'effect',
      label: 'Effect',
      parameters: ['timeScale', 'twistAmount', 'seamlessLoop'],
      collapsible: false,
      defaultCollapsed: false
    },
    {
      id: 'raymarch',
      label: 'Raymarch',
      parameters: ['raymarchSteps'],
      collapsible: true,
      defaultCollapsed: true
    },
    {
      id: 'camera',
      label: 'Camera (when unconnected)',
      parameters: ['orbitRadius', 'orbitSpeed'],
      collapsible: true,
      defaultCollapsed: true
    },
    {
      id: 'output',
      label: 'Output',
      parameters: ['brightness'],
      collapsible: true,
      defaultCollapsed: true
    }
  ],
  parameterLayout: {
    elements: [
      { type: 'grid', parameters: ['timeScale', 'twistAmount', 'seamlessLoop'], layout: { columns: 3 } },
      { type: 'grid', label: 'Raymarch', parameters: ['raymarchSteps'], layout: { columns: 1 } },
      { type: 'grid', label: 'Camera', parameters: ['orbitRadius', 'orbitSpeed'], layout: { columns: 2 } },
      { type: 'grid', label: 'Output', parameters: ['brightness'], layout: { columns: 1 } }
    ]
  },
  functions: `
struct Model { float dist; vec3 colour; float id; }
struct Hit { float len; vec3 colour; float id; }

#define PI 3.14159265359
#define PHI 1.618033988749895
#define saturate(x) clamp(x, 0.0, 1.0)

mat3 rotationMatrix(vec3 axis, float angle) {
  axis = normalize(axis);
  float s = sin(angle), c = cos(angle), oc = 1.0 - c;
  return mat3(
    oc*axis.x*axis.x + c, oc*axis.x*axis.y - axis.z*s, oc*axis.z*axis.x + axis.y*s,
    oc*axis.x*axis.y + axis.z*s, oc*axis.y*axis.y + c, oc*axis.y*axis.z - axis.x*s,
    oc*axis.z*axis.x - axis.y*s, oc*axis.y*axis.z + axis.x*s, oc*axis.z*axis.z + c
  );
}

mat3 orientMatrix(vec3 A, vec3 B) {
  mat3 Fi = mat3(A, normalize(B - dot(A,B)*A), cross(B, A));
  mat3 G = mat3(dot(A,B), -length(cross(A,B)), 0.0, length(cross(A,B)), dot(A,B), 0.0, 0.0, 0.0, 1.0);
  return Fi * G * inverse(Fi);
}

float pReflect(inout vec3 p, vec3 planeNormal, float offset) {
  float t = dot(p, planeNormal) + offset;
  if (t < 0.0) p = p - 2.0*t*planeNormal;
  return sign(t);
}

void pR(inout vec2 p, float a) {
  p = cos(a)*p + sin(a)*vec2(p.y, -p.x);
}

float pModPolar2(inout vec2 p, float reps) {
  float angle = 2.0*PI/reps;
  float a = atan(p.y, p.x) + angle*0.5;
  float r = length(p);
  float c = floor(a/angle);
  a = mod(a, angle) - angle*0.5;
  p = vec2(cos(a), sin(a))*r;
  if (abs(c) >= reps*0.5) c = abs(c);
  return c;
}

void pModPolar3(inout vec3 p, vec3 axis, float reps, float offset) {
  vec3 z = vec3(0,0,1);
  mat3 m = orientMatrix(axis, z);
  p *= inverse(m);
  pR(p.xy, offset);
  pModPolar2(p.xy, reps);
  pR(p.xy, -offset);
  p *= m;
}

vec3 nc, pbc, pca;
void initIcosahedronInflated() {
  float cospin = cos(PI/5.0), scospin = sqrt(0.75 - cospin*cospin);
  nc = vec3(-0.5, -cospin, scospin);
  pbc = normalize(vec3(scospin, 0.0, 0.5));
  pca = normalize(vec3(0.0, scospin, cospin));
}

void pModIcosahedronInflated(inout vec3 p) {
  p = abs(p);
  pReflect(p, nc, 0.0);
  p.xy = abs(p.xy);
  pReflect(p, nc, 0.0);
  p.xy = abs(p.xy);
  pReflect(p, nc, 0.0);
}

float indexSgnInflated(float s) { return s*0.5 + 0.5; }

float pModIcosahedronIndexedInflated(inout vec3 p) {
  float x = indexSgnInflated(sign(p.x));
  float y = indexSgnInflated(sign(p.y));
  float z = indexSgnInflated(sign(p.z));
  p = abs(p);
  pReflect(p, nc, 0.0);
  float xai = sign(p.x), yai = sign(p.y);
  p.xy = abs(p.xy);
  float sideBB = pReflect(p, nc, 0.0);
  float ybi = sign(p.y), xbi = sign(p.x);
  p.xy = abs(p.xy);
  pReflect(p, nc, 0.0);
  float idx = 0.0;
  float faceGroupAi = indexSgnInflated(ybi * yai * -1.0);
  float faceGroupBi = indexSgnInflated(yai);
  float faceGroupCi = clamp(xai - ybi - 1.0, 0.0, 1.0);
  float faceGroupDi = clamp(1.0 - faceGroupAi - faceGroupBi - faceGroupCi, 0.0, 1.0);
  idx += faceGroupAi * (x + 2.0*y + 4.0*z);
  idx += faceGroupBi * (8.0 + y + 2.0*z);
  idx += faceGroupCi * (12.0 + x + 2.0*z);
  idx += faceGroupDi * (12.0 + x + 2.0*y);
  return idx;
}

vec3 vMinInflated(vec3 p, vec3 a, vec3 b, vec3 c) {
  float la = length(p - a), lb = length(p - b), lc = length(p - c);
  if (la < lb) return (la < lc) ? a : c;
  return (lb < lc) ? b : c;
}

#define GDF13 normalize(vec3(0, PHI, 1))
#define GDF14 normalize(vec3(0, -PHI, 1))
#define GDF15 normalize(vec3(1, 0, PHI))
#define GDF16 normalize(vec3(-1, 0, PHI))
#define GDF17 normalize(vec3(PHI, 1, 0))
#define GDF18 normalize(vec3(-PHI, 1, 0))
#define GDF13b normalize(vec3(0, PHI, -1))
#define GDF14b normalize(vec3(0, -PHI, -1))
#define GDF15b normalize(vec3(1, 0, -PHI))
#define GDF16b normalize(vec3(-1, 0, -PHI))
#define GDF17b normalize(vec3(PHI, -1, 0))
#define GDF18b normalize(vec3(-PHI, -1, 0))

vec3 icosahedronVertexInflated(vec3 p) {
  if (p.z > 0.0) {
    if (p.x > 0.0) return (p.y > 0.0) ? vMinInflated(p, GDF13, GDF15, GDF17) : vMinInflated(p, GDF14, GDF15, GDF17b);
    return (p.y > 0.0) ? vMinInflated(p, GDF13, GDF16, GDF18) : vMinInflated(p, GDF14, GDF16, GDF18b);
  }
  if (p.x > 0.0) return (p.y > 0.0) ? vMinInflated(p, GDF13b, GDF15b, GDF17) : vMinInflated(p, GDF14b, GDF15b, GDF17b);
  return (p.y > 0.0) ? vMinInflated(p, GDF13b, GDF16b, GDF18) : vMinInflated(p, GDF14b, GDF16b, GDF18b);
}

vec4 icosahedronAxisDistanceInflated(vec3 p) {
  vec3 iv = icosahedronVertexInflated(p);
  vec3 originalIv = iv;
  vec3 pn = normalize(p);
  pModIcosahedronInflated(pn);
  pModIcosahedronInflated(iv);
  float boundryDist = dot(pn, vec3(1,0,0));
  float boundryMax = dot(iv, vec3(1,0,0));
  boundryDist /= boundryMax;
  float roundDist = length(iv - pn);
  float roundMax = length(iv - vec3(0,0,1));
  roundDist /= roundMax;
  roundDist = -roundDist + 1.0;
  float blend = 1.0 - boundryDist;
  blend = pow(blend, 6.0);
  float dist = mix(roundDist, boundryDist, blend);
  return vec4(originalIv, dist);
}

void pTwistIcosahedronInflated(inout vec3 p, float amount) {
  vec4 a = icosahedronAxisDistanceInflated(p);
  vec3 axis = a.xyz;
  float dist = a.w;
  mat3 m = rotationMatrix(axis, dist * amount);
  p *= m;
}

void pTwistIcosahedronCenterInflated(inout vec3 p, vec3 center, float amount) {
  p += center;
  pTwistIcosahedronInflated(p, amount);
  p -= center;
}

vec3 palInflated(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
  return a + b*cos(6.28318*(c*t+d));
}

vec3 spectrumInflated(float n) {
  return palInflated(n, vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0, 0.33, 0.67));
}

Model fInflatedIcosahedronInflated(vec3 p, vec3 axis, float t, int seamless) {
  float d = 1000.0;
  if (seamless != 0) pModPolar3(p, axis, 3.0, PI*0.5);
  float idx = pModIcosahedronIndexedInflated(p);
  d = min(d, dot(p, pca) - 0.9);
  d = mix(d, length(p) - 0.9, 0.5);
  if (seamless != 0) {
    if (idx == 3.0) idx = 2.0;
    idx /= 10.0;
  } else idx /= 20.0;
  vec3 colour = spectrumInflated(idx);
  d *= 0.6;
  return Model(d, colour, 1.0);
}

Model modelInflated(vec3 p, float t, float twistAmt, int seamless) {
  float rate = PI/6.0;
  vec3 axis = pca;
  vec3 twistCenter = vec3(cos(t * rate * -3.0) * 0.3, sin(t * rate * -3.0) * 0.3, 0.0);
  mat3 m = rotationMatrix(reflect(axis, vec3(0,1,0)), t * -rate);
  p *= m;
  twistCenter *= m;
  pTwistIcosahedronCenterInflated(p, twistCenter, twistAmt);
  return fInflatedIcosahedronInflated(p, axis, t, seamless);
}

Model mapInflated(vec3 p, float t, float twistAmt, int seamless) {
  return modelInflated(p, t, twistAmt, seamless);
}

float softshadowInflated(vec3 ro, vec3 rd, float mint, float tmax, float t, float twistAmt, int seamless) {
  float res = 1.0;
  float dist = mint;
  for (int i = 0; i < 16; i++) {
    float h = mapInflated(ro + rd*dist, t, twistAmt, seamless).dist;
    res = min(res, 8.0*h/max(dist, 0.001));
    dist += clamp(h, 0.02, 0.1);
    if (h < 0.001 || dist > tmax) break;
  }
  return clamp(res, 0.0, 1.0);
}

float calcAOInflated(vec3 pos, vec3 nor, float t, float twistAmt, int seamless) {
  float occ = 0.0;
  float sca = 1.0;
  for (int i = 0; i < 5; i++) {
    float hr = 0.01 + 0.12*float(i)/4.0;
    vec3 aopos = nor*hr + pos;
    float dd = mapInflated(aopos, t, twistAmt, seamless).dist;
    occ += -(dd - hr)*sca;
    sca *= 0.95;
  }
  return clamp(1.0 - 3.0*occ, 0.0, 1.0);
}

vec3 linearToScreenInflated(vec3 linearRGB) {
  return pow(linearRGB, vec3(1.0/2.2));
}

vec3 doLightingInflated(vec3 col, vec3 pos, vec3 nor, vec3 ref, vec3 rd, float t, float twistAmt, int seamless) {
  float occ = calcAOInflated(pos, nor, t, twistAmt, seamless);
  vec3 lig = normalize(vec3(-0.6, 0.7, 0.5));
  float amb = clamp(0.5 + 0.5*nor.y, 0.0, 1.0);
  float dif = clamp(dot(nor, lig), 0.0, 1.0);
  float bac = clamp(dot(nor, normalize(vec3(-lig.x, 0.0, -lig.z))), 0.0, 1.0) * clamp(1.0 - pos.y, 0.0, 1.0);
  float fre = pow(clamp(1.0 + dot(nor, rd), 0.0, 1.0), 2.0);
  dif *= softshadowInflated(pos, lig, 0.02, 2.5, t, twistAmt, seamless);
  vec3 lin = vec3(0.0);
  lin += 1.2*dif*vec3(0.95, 0.8, 0.6);
  lin += 0.8*amb*vec3(0.5, 0.7, 0.8)*occ;
  lin += 0.3*bac*vec3(0.25)*occ;
  lin += 0.2*fre*vec3(1.0)*occ;
  return col*lin;
}

Hit calcIntersectionInflated(vec3 ro, vec3 rd, float t, float twistAmt, int seamless, int maxSteps) {
  const float INTERSECTION_PRECISION = 0.001;
  const float MAX_TRACE_DISTANCE = 30.0;
  float h = INTERSECTION_PRECISION*2.0;
  float dist = 0.0;
  float res = -1.0;
  float id = -1.0;
  vec3 colour = vec3(0.0);
  for (int i = 0; i < 100; i++) {
    if (i >= maxSteps) break;
    if (abs(h) < INTERSECTION_PRECISION || dist > MAX_TRACE_DISTANCE) break;
    Model m = mapInflated(ro + rd*dist, t, twistAmt, seamless);
    h = m.dist;
    dist += h;
    id = m.id;
    colour = m.colour;
  }
  if (dist < MAX_TRACE_DISTANCE) res = dist;
  else id = -1.0;
  return Hit(res, colour, id);
}

vec3 calcNormalInflated(vec3 pos, float t, float twistAmt, int seamless) {
  vec3 eps = vec3(0.001, 0.0, 0.0);
  return normalize(vec3(
    mapInflated(pos+eps.xyy, t, twistAmt, seamless).dist - mapInflated(pos-eps.xyy, t, twistAmt, seamless).dist,
    mapInflated(pos+eps.yxy, t, twistAmt, seamless).dist - mapInflated(pos-eps.yxy, t, twistAmt, seamless).dist,
    mapInflated(pos+eps.yyx, t, twistAmt, seamless).dist - mapInflated(pos-eps.yyx, t, twistAmt, seamless).dist
  ));
}

vec3 renderInflated(Hit hit, vec3 ro, vec3 rd, vec2 pp, float t, float twistAmt, int seamless, float bright) {
  vec3 color = mix(vec3(0.8, 0.8, 0.9), vec3(0.35, 0.5, 0.65), length(pp)/1.5);
  if (hit.len > 0.0) {
    vec3 pos = ro + rd * hit.len;
    vec3 norm = calcNormalInflated(pos, t, twistAmt, seamless);
    vec3 ref = reflect(rd, norm);
    color = doLightingInflated(hit.colour, pos, norm, ref, rd, t, twistAmt, seamless);
  }
  return color * bright;
}
`,
  mainCode: `
  initIcosahedronInflated();
  float t = $time * $param.timeScale - 0.25;
  float twistAmt = $param.twistAmount;
  int seamless = $param.seamlessLoop;
  int maxSteps = int(clamp(float($param.raymarchSteps), 32.0, 150.0));
  float bright = $param.brightness;

  vec3 ro = $input.ro;
  vec3 rd = normalize($input.rd);

  Hit hit = calcIntersectionInflated(ro, rd, t, twistAmt, seamless, maxSteps);
  vec2 pp = 2.0 * $input.in - 1.0;
  vec3 color = renderInflated(hit, ro, rd, pp, t, twistAmt, seamless, bright);
  color = linearToScreenInflated(color);
  $output.out += color;
`
};
