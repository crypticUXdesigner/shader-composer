/**
 * Bounded fullscreen WGSL MVP for `inflated-icosahedron` — ports the fragment GLSL from
 * `src/shaders/nodes/inflated-icosahedron.ts` with fixed iteration caps (ray ≤100 steps,
 * shadow ≤16, AO ≤5) matching the GLSL loop limits; user `raymarchSteps` clamps to [32,150]
 * but the march loop is capped at 100 like GLSL.
 */

export const INFLATED_ICOSAHEDRON_MVP_WGSL = `
const INFL_IC_PI: f32 = 3.14159265359;
const INFL_IC_PHI: f32 = 1.618033988749895;
const INFL_IC_MAX_TRACE: f32 = 30.0;
const INFL_IC_PREC: f32 = 0.001;

struct InflIcModel {
  dist: f32,
  colour: vec3<f32>,
  id: f32,
}

struct InflIcHit {
  len: f32,
  colour: vec3<f32>,
  id: f32,
}

struct InflIcBasis {
  nc: vec3<f32>,
  pbc: vec3<f32>,
  pca: vec3<f32>,
}

fn infl_ic_oklch_to_rgb(oklch: vec3<f32>) -> vec3<f32> {
  let l = oklch.x;
  let c = oklch.y;
  let h = oklch.z * INFL_IC_PI / 180.0;
  let a_ = c * cos(h);
  let b_ = c * sin(h);
  let l_ = l + 0.3963377774 * a_ + 0.2158037573 * b_;
  let m_ = l - 0.1055613458 * a_ - 0.0638541728 * b_;
  let s_ = l - 0.0894841775 * a_ - 1.2914855480 * b_;
  let l3 = l_ * l_ * l_;
  let m3 = m_ * m_ * m_;
  let s3 = s_ * s_ * s_;
  let r = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  let g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  let bl = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3;
  return clamp(vec3<f32>(r, g, bl), vec3<f32>(0.0), vec3<f32>(1.0));
}

fn infl_ic_gdfs() -> array<vec3<f32>, 12> {
  var g: array<vec3<f32>, 12>;
  g[0] = normalize(vec3<f32>(0.0, INFL_IC_PHI, 1.0));
  g[1] = normalize(vec3<f32>(0.0, -INFL_IC_PHI, 1.0));
  g[2] = normalize(vec3<f32>(1.0, 0.0, INFL_IC_PHI));
  g[3] = normalize(vec3<f32>(-1.0, 0.0, INFL_IC_PHI));
  g[4] = normalize(vec3<f32>(INFL_IC_PHI, 1.0, 0.0));
  g[5] = normalize(vec3<f32>(-INFL_IC_PHI, 1.0, 0.0));
  g[6] = normalize(vec3<f32>(0.0, INFL_IC_PHI, -1.0));
  g[7] = normalize(vec3<f32>(0.0, -INFL_IC_PHI, -1.0));
  g[8] = normalize(vec3<f32>(1.0, 0.0, -INFL_IC_PHI));
  g[9] = normalize(vec3<f32>(-1.0, 0.0, -INFL_IC_PHI));
  g[10] = normalize(vec3<f32>(INFL_IC_PHI, -1.0, 0.0));
  g[11] = normalize(vec3<f32>(-INFL_IC_PHI, -1.0, 0.0));
  return g;
}

fn infl_ic_init_basis() -> InflIcBasis {
  let cospin = cos(INFL_IC_PI / 5.0);
  let scospin = sqrt(0.75 - cospin * cospin);
  var b: InflIcBasis;
  b.nc = vec3<f32>(-0.5, -cospin, scospin);
  b.pbc = normalize(vec3<f32>(scospin, 0.0, 0.5));
  b.pca = normalize(vec3<f32>(0.0, scospin, cospin));
  return b;
}

fn infl_ic_rotation_matrix(axis_in: vec3<f32>, angle: f32) -> mat3x3<f32> {
  let axis = normalize(axis_in);
  let s = sin(angle);
  let c = cos(angle);
  let oc = 1.0 - c;
  let x = axis.x;
  let y = axis.y;
  let z = axis.z;
  let c0 = vec3<f32>(oc * x * x + c, oc * x * y - z * s, oc * z * x + y * s);
  let c1 = vec3<f32>(oc * x * y + z * s, oc * y * y + c, oc * y * z - x * s);
  let c2 = vec3<f32>(oc * z * x - y * s, oc * y * z + x * s, oc * z * z + c);
  return mat3x3<f32>(c0, c1, c2);
}

fn infl_ic_mat3_inverse(m: mat3x3<f32>) -> mat3x3<f32> {
  let c0 = m[0];
  let c1 = m[1];
  let c2 = m[2];
  let invDet = 1.0 / dot(c0, cross(c1, c2));
  return mat3x3<f32>(
    cross(c1, c2) * invDet,
    cross(c2, c0) * invDet,
    cross(c0, c1) * invDet
  );
}

fn infl_ic_orient_matrix(A_in: vec3<f32>, B_in: vec3<f32>) -> mat3x3<f32> {
  let A = normalize(A_in);
  let B = B_in;
  let dAB = dot(A, B);
  let col1 = normalize(B - A * dAB);
  let cab = cross(B, A);
  let Fi = mat3x3<f32>(A, col1, cab);
  let lab = length(cross(A, B));
  let G = mat3x3<f32>(
    vec3<f32>(dAB, lab, 0.0),
    vec3<f32>(-lab, dAB, 0.0),
    vec3<f32>(0.0, 0.0, 1.0)
  );
  return Fi * G * infl_ic_mat3_inverse(Fi);
}

fn infl_ic_p_reflect(p: ptr<function, vec3<f32>>, planeNormal: vec3<f32>, offset: f32) -> f32 {
  let pn = normalize(planeNormal);
  let t = dot(*p, pn) + offset;
  if (t < 0.0) {
    *p = *p - 2.0 * t * pn;
  }
  return sign(t);
}

fn infl_ic_p_r(p: ptr<function, vec2<f32>>, a: f32) {
  let c = cos(a);
  let s = sin(a);
  let x = (*p).x;
  let y = (*p).y;
  *p = vec2<f32>(c * x + s * y, c * y - s * x);
}

fn infl_ic_p_mod_polar2(p: ptr<function, vec2<f32>>, reps: f32) -> f32 {
  let angle = 2.0 * INFL_IC_PI / reps;
  var a = atan2((*p).y, (*p).x) + angle * 0.5;
  let r = length(*p);
  var c = floor(a / angle);
  a = a - angle * floor(a / angle) - angle * 0.5;
  *p = vec2<f32>(cos(a), sin(a)) * r;
  let repsHalf = reps * 0.5;
  if (abs(c) >= repsHalf) {
    c = abs(c);
  }
  return c;
}

fn infl_ic_p_mod_polar3(p: ptr<function, vec3<f32>>, axis: vec3<f32>, reps: f32, offset: f32) {
  let zAxis = vec3<f32>(0.0, 0.0, 1.0);
  let m = infl_ic_orient_matrix(axis, zAxis);
  *p = infl_ic_mat3_inverse(m) * (*p);
  var xy = vec2<f32>((*p).x, (*p).y);
  infl_ic_p_r(&xy, offset);
  let _c = infl_ic_p_mod_polar2(&xy, reps);
  infl_ic_p_r(&xy, -offset);
  *p = vec3<f32>(xy.x, xy.y, (*p).z);
  *p = m * (*p);
}

fn infl_ic_p_mod_icosahedron(p: ptr<function, vec3<f32>>, nc: vec3<f32>) {
  *p = abs(*p);
  let _s1 = infl_ic_p_reflect(p, nc, 0.0);
  (*p).x = abs((*p).x);
  (*p).y = abs((*p).y);
  let _s2 = infl_ic_p_reflect(p, nc, 0.0);
  (*p).x = abs((*p).x);
  (*p).y = abs((*p).y);
  let _s3 = infl_ic_p_reflect(p, nc, 0.0);
}

fn infl_ic_index_sgn(s: f32) -> f32 {
  return s * 0.5 + 0.5;
}

fn infl_ic_p_mod_icosahedron_indexed(p: ptr<function, vec3<f32>>, nc: vec3<f32>) -> f32 {
  let x = infl_ic_index_sgn(sign((*p).x));
  let y = infl_ic_index_sgn(sign((*p).y));
  let z = infl_ic_index_sgn(sign((*p).z));
  *p = abs(*p);
  let _r1 = infl_ic_p_reflect(p, nc, 0.0);
  let xai = sign((*p).x);
  let yai = sign((*p).y);
  (*p).x = abs((*p).x);
  (*p).y = abs((*p).y);
  let _sideBB = infl_ic_p_reflect(p, nc, 0.0);
  let ybi = sign((*p).y);
  let xbi = sign((*p).x);
  (*p).x = abs((*p).x);
  (*p).y = abs((*p).y);
  let _r4 = infl_ic_p_reflect(p, nc, 0.0);
  var idx = 0.0;
  let faceGroupAi = infl_ic_index_sgn(ybi * yai * -1.0);
  let faceGroupBi = infl_ic_index_sgn(yai);
  let faceGroupCi = clamp(xai - ybi - 1.0, 0.0, 1.0);
  let faceGroupDi = clamp(1.0 - faceGroupAi - faceGroupBi - faceGroupCi, 0.0, 1.0);
  idx = idx + faceGroupAi * (x + 2.0 * y + 4.0 * z);
  idx = idx + faceGroupBi * (8.0 + y + 2.0 * z);
  idx = idx + faceGroupCi * (12.0 + x + 2.0 * z);
  idx = idx + faceGroupDi * (12.0 + x + 2.0 * y);
  return idx;
}

fn infl_ic_v_min(p: vec3<f32>, a: vec3<f32>, b: vec3<f32>, c: vec3<f32>) -> vec3<f32> {
  let la = length(p - a);
  let lb = length(p - b);
  let lc = length(p - c);
  if (la < lb) {
    return select(c, a, la < lc);
  }
  return select(c, b, lb < lc);
}

fn infl_ic_icosahedron_vertex(p: vec3<f32>, g: array<vec3<f32>, 12>) -> vec3<f32> {
  let GDF13 = g[0];
  let GDF14 = g[1];
  let GDF15 = g[2];
  let GDF16 = g[3];
  let GDF17 = g[4];
  let GDF18 = g[5];
  let GDF13b = g[6];
  let GDF14b = g[7];
  let GDF15b = g[8];
  let GDF16b = g[9];
  let GDF17b = g[10];
  let GDF18b = g[11];
  if (p.z > 0.0) {
    if (p.x > 0.0) {
      if (p.y > 0.0) {
        return infl_ic_v_min(p, GDF13, GDF15, GDF17);
      }
      return infl_ic_v_min(p, GDF14, GDF15, GDF17b);
    }
    if (p.y > 0.0) {
      return infl_ic_v_min(p, GDF13, GDF16, GDF18);
    }
    return infl_ic_v_min(p, GDF14, GDF16, GDF18b);
  }
  if (p.x > 0.0) {
    if (p.y > 0.0) {
      return infl_ic_v_min(p, GDF13b, GDF15b, GDF17);
    }
    return infl_ic_v_min(p, GDF14b, GDF15b, GDF17b);
  }
  if (p.y > 0.0) {
    return infl_ic_v_min(p, GDF13b, GDF16b, GDF18);
  }
  return infl_ic_v_min(p, GDF14b, GDF16b, GDF18b);
}

fn infl_ic_axis_distance(p_in: vec3<f32>, nc: vec3<f32>) -> vec4<f32> {
  let g = infl_ic_gdfs();
  var iv = infl_ic_icosahedron_vertex(p_in, g);
  let originalIv = iv;
  var pn = normalize(p_in);
  infl_ic_p_mod_icosahedron(&pn, nc);
  infl_ic_p_mod_icosahedron(&iv, nc);
  let boundryDist = dot(pn, vec3<f32>(1.0, 0.0, 0.0));
  let boundryMax = dot(iv, vec3<f32>(1.0, 0.0, 0.0));
  var bd = boundryDist / boundryMax;
  var roundDist = length(iv - pn);
  let roundMax = length(iv - vec3<f32>(0.0, 0.0, 1.0));
  roundDist = roundDist / roundMax;
  roundDist = -roundDist + 1.0;
  var blend = 1.0 - bd;
  blend = pow(blend, 6.0);
  let dist = mix(roundDist, bd, blend);
  return vec4<f32>(originalIv.x, originalIv.y, originalIv.z, dist);
}

fn infl_ic_p_twist(p: ptr<function, vec3<f32>>, amount: f32, nc: vec3<f32>) {
  let ax = infl_ic_axis_distance(*p, nc);
  let axis = vec3<f32>(ax.x, ax.y, ax.z);
  let dist = ax.w;
  let m = infl_ic_rotation_matrix(axis, dist * amount);
  *p = m * (*p);
}

fn infl_ic_p_twist_center(p: ptr<function, vec3<f32>>, center: vec3<f32>, amount: f32, nc: vec3<f32>) {
  *p = *p + center;
  infl_ic_p_twist(p, amount, nc);
  *p = *p - center;
}

fn infl_ic_pal(t: f32, a: vec3<f32>, b: vec3<f32>, c: vec3<f32>, d: vec3<f32>) -> vec3<f32> {
  return a + b * cos(6.28318 * (c * t + d));
}

fn infl_ic_spectrum(n: f32, paletteHueDeg: f32) -> vec3<f32> {
  return infl_ic_pal(
    n + paletteHueDeg / 360.0,
    vec3<f32>(0.5),
    vec3<f32>(0.5),
    vec3<f32>(1.0),
    vec3<f32>(0.0, 0.33, 0.67)
  );
}

fn infl_ic_f_shape(
  p: vec3<f32>,
  axis: vec3<f32>,
  t: f32,
  seamless: i32,
  basis: InflIcBasis,
  nc: vec3<f32>,
  shapeSize: f32,
  paletteHueDeg: f32,
) -> InflIcModel {
  var pp = p;
  let r = 0.9 * shapeSize;
  if (seamless != 0) {
    infl_ic_p_mod_polar3(&pp, axis, 3.0, INFL_IC_PI * 0.5);
  }
  var idx = infl_ic_p_mod_icosahedron_indexed(&pp, nc);
  var d = 1000.0;
  d = min(d, dot(pp, basis.pca) - r);
  d = mix(d, length(pp) - r, 0.5);
  if (seamless != 0) {
    if (idx == 3.0) {
      idx = 2.0;
    }
    idx = idx / 10.0;
  } else {
    idx = idx / 20.0;
  }
  let colour = infl_ic_spectrum(idx, paletteHueDeg);
  d = d * 0.6;
  return InflIcModel(d, colour, 1.0);
}

fn infl_ic_model(
  p: vec3<f32>,
  t: f32,
  twistAmt: f32,
  seamless: i32,
  basis: InflIcBasis,
  nc: vec3<f32>,
  shapeSize: f32,
  paletteHueDeg: f32,
) -> InflIcModel {
  let rate = INFL_IC_PI / 6.0;
  let axis = basis.pca;
  let twistCenter =
    vec3<f32>(cos(t * rate * -3.0) * 0.3, sin(t * rate * -3.0) * 0.3, 0.0);
  let m = infl_ic_rotation_matrix(reflect(axis, vec3<f32>(0.0, 1.0, 0.0)), t * -rate);
  var pp = m * p;
  var tc = m * twistCenter;
  infl_ic_p_twist_center(&pp, tc, twistAmt, nc);
  return infl_ic_f_shape(pp, axis, t, seamless, basis, nc, shapeSize, paletteHueDeg);
}

fn infl_ic_map(
  p: vec3<f32>,
  t: f32,
  twistAmt: f32,
  seamless: i32,
  basis: InflIcBasis,
  nc: vec3<f32>,
  shapeSize: f32,
  paletteHueDeg: f32,
) -> InflIcModel {
  return infl_ic_model(p, t, twistAmt, seamless, basis, nc, shapeSize, paletteHueDeg);
}

fn infl_ic_soft_shadow(
  ro: vec3<f32>,
  rd: vec3<f32>,
  mint: f32,
  tmax: f32,
  t: f32,
  twistAmt: f32,
  seamless: i32,
  basis: InflIcBasis,
  nc: vec3<f32>,
  shapeSize: f32,
  paletteHueDeg: f32,
) -> f32 {
  var res = 1.0;
  var dist = mint;
  for (var i: i32 = 0; i < 16; i = i + 1) {
    let h = infl_ic_map(ro + rd * dist, t, twistAmt, seamless, basis, nc, shapeSize, paletteHueDeg).dist;
    res = min(res, 8.0 * h / max(dist, 0.001));
    dist = dist + clamp(h, 0.02, 0.1);
    if (h < 0.001 || dist > tmax) {
      break;
    }
  }
  return clamp(res, 0.0, 1.0);
}

fn infl_ic_calc_ao(
  pos: vec3<f32>,
  nor: vec3<f32>,
  t: f32,
  twistAmt: f32,
  seamless: i32,
  basis: InflIcBasis,
  nc: vec3<f32>,
  shapeSize: f32,
  paletteHueDeg: f32,
) -> f32 {
  var occ = 0.0;
  var sca = 1.0;
  for (var i: i32 = 0; i < 5; i = i + 1) {
    let hr = 0.01 + 0.12 * f32(i) / 4.0;
    let aopos = nor * hr + pos;
    let dd = infl_ic_map(aopos, t, twistAmt, seamless, basis, nc, shapeSize, paletteHueDeg).dist;
    occ = occ + -(dd - hr) * sca;
    sca = sca * 0.95;
  }
  return clamp(1.0 - 3.0 * occ, 0.0, 1.0);
}

fn infl_ic_linear_to_screen(linearRGB: vec3<f32>) -> vec3<f32> {
  return pow(max(linearRGB, vec3<f32>(0.0)), vec3<f32>(1.0 / 2.2));
}

fn infl_ic_do_lighting(
  col: vec3<f32>,
  pos: vec3<f32>,
  nor: vec3<f32>,
  rd: vec3<f32>,
  t: f32,
  twistAmt: f32,
  seamless: i32,
  basis: InflIcBasis,
  nc: vec3<f32>,
  shapeSize: f32,
  paletteHueDeg: f32,
  lightAngleDeg: f32,
  shadingContrast: f32,
) -> vec3<f32> {
  let occ = infl_ic_calc_ao(pos, nor, t, twistAmt, seamless, basis, nc, shapeSize, paletteHueDeg);
  let ligBase = normalize(vec3<f32>(-0.6, 0.7, 0.5));
  let lig = normalize(
    infl_ic_rotation_matrix(vec3<f32>(0.0, 1.0, 0.0), radians(lightAngleDeg)) * ligBase
  );
  let amb = clamp(0.5 + 0.5 * nor.y, 0.0, 1.0);
  var dif = clamp(dot(nor, lig), 0.0, 1.0);
  let bac =
    clamp(dot(nor, normalize(vec3<f32>(-lig.x, 0.0, -lig.z))), 0.0, 1.0) *
    clamp(1.0 - pos.y, 0.0, 1.0);
  let fre = pow(clamp(1.0 + dot(nor, rd), 0.0, 1.0), 2.0);
  dif =
    dif *
    infl_ic_soft_shadow(pos, lig, 0.02, 2.5, t, twistAmt, seamless, basis, nc, shapeSize, paletteHueDeg);
  var lin = vec3<f32>(0.0);
  lin = lin + 1.2 * dif * vec3<f32>(0.95, 0.8, 0.6);
  lin = lin + 0.8 * amb * vec3<f32>(0.5, 0.7, 0.8) * occ;
  lin = lin + 0.3 * bac * vec3<f32>(0.25) * occ;
  lin = lin + 0.2 * fre * vec3<f32>(1.0) * occ;
  var lit = col * lin;
  lit = clamp((lit - vec3<f32>(0.5)) * shadingContrast + vec3<f32>(0.5), vec3<f32>(0.0), vec3<f32>(64.0));
  return lit;
}

fn infl_ic_calc_normal(
  pos: vec3<f32>,
  t: f32,
  twistAmt: f32,
  seamless: i32,
  basis: InflIcBasis,
  nc: vec3<f32>,
  shapeSize: f32,
  paletteHueDeg: f32,
) -> vec3<f32> {
  let eps = vec3<f32>(0.001, 0.0, 0.0);
  let dx =
    infl_ic_map(pos + eps.xyy, t, twistAmt, seamless, basis, nc, shapeSize, paletteHueDeg).dist -
    infl_ic_map(pos - eps.xyy, t, twistAmt, seamless, basis, nc, shapeSize, paletteHueDeg).dist;
  let dy =
    infl_ic_map(pos + eps.yxy, t, twistAmt, seamless, basis, nc, shapeSize, paletteHueDeg).dist -
    infl_ic_map(pos - eps.yxy, t, twistAmt, seamless, basis, nc, shapeSize, paletteHueDeg).dist;
  let dz =
    infl_ic_map(pos + eps.yyx, t, twistAmt, seamless, basis, nc, shapeSize, paletteHueDeg).dist -
    infl_ic_map(pos - eps.yyx, t, twistAmt, seamless, basis, nc, shapeSize, paletteHueDeg).dist;
  return normalize(vec3<f32>(dx, dy, dz));
}

fn infl_ic_calc_intersection(
  ro: vec3<f32>,
  rd: vec3<f32>,
  t: f32,
  twistAmt: f32,
  seamless: i32,
  maxSteps: i32,
  basis: InflIcBasis,
  nc: vec3<f32>,
  shapeSize: f32,
  paletteHueDeg: f32,
) -> InflIcHit {
  let h0 = INFL_IC_PREC * 2.0;
  var h = h0;
  var dist_along = 0.0;
  var res = -1.0;
  var id = -1.0;
  var colour = vec3<f32>(0.0);
  for (var i: i32 = 0; i < 100; i = i + 1) {
    if (i >= maxSteps) {
      break;
    }
    if (abs(h) < INFL_IC_PREC || dist_along > INFL_IC_MAX_TRACE) {
      break;
    }
    let m = infl_ic_map(ro + rd * dist_along, t, twistAmt, seamless, basis, nc, shapeSize, paletteHueDeg);
    h = m.dist;
    dist_along = dist_along + h;
    id = m.id;
    colour = m.colour;
  }
  if (dist_along < INFL_IC_MAX_TRACE) {
    res = dist_along;
  } else {
    id = -1.0;
  }
  return InflIcHit(res, colour, id);
}

fn infl_ic_render(
  hit: InflIcHit,
  ro: vec3<f32>,
  rd: vec3<f32>,
  pp: vec2<f32>,
  t: f32,
  twistAmt: f32,
  seamless: i32,
  bright: f32,
  basis: InflIcBasis,
  nc: vec3<f32>,
  bgInner: vec3<f32>,
  bgOuter: vec3<f32>,
  bgFalloff: f32,
  shapeSize: f32,
  paletteHueDeg: f32,
  lightAngleDeg: f32,
  shadingContrast: f32,
) -> vec3<f32> {
  let fo = max(bgFalloff, 1e-4);
  var color = mix(bgInner, bgOuter, clamp(length(pp) / fo, 0.0, 1.0));
  if (hit.len > 0.0) {
    let pos = ro + rd * hit.len;
    let norm = infl_ic_calc_normal(pos, t, twistAmt, seamless, basis, nc, shapeSize, paletteHueDeg);
    color = infl_ic_do_lighting(
      hit.colour,
      pos,
      norm,
      rd,
      t,
      twistAmt,
      seamless,
      basis,
      nc,
      shapeSize,
      paletteHueDeg,
      lightAngleDeg,
      shadingContrast
    );
  }
  return color * bright;
}

fn infl_ic_default_rd(uv: vec2<f32>, ro: vec3<f32>) -> vec3<f32> {
  let nro = normalize(-ro);
  let cr = cross(nro, vec3<f32>(0.0, 1.0, 0.0));
  let aux = normalize(cr);
  let aux2 = cross(aux, nro);
  let rdRaw = 2.0 * nro + uv.x * aux + uv.y * aux2;
  return normalize(rdRaw);
}

fn inflated_icosahedron_standalone_pixel(
  uv_screen: vec2<f32>,
  ro_in: vec3<f32>,
  rd_in: vec3<f32>,
  time: f32,
  timeScale: f32,
  twistAmount: f32,
  seamlessLoop: i32,
  raymarchSteps: i32,
  brightness: f32,
  bgInner: vec3<f32>,
  bgOuter: vec3<f32>,
  bgFalloff: f32,
  paletteHue: f32,
  shapeSize: f32,
  lightAngle: f32,
  contrast: f32,
) -> vec3<f32> {
  let basis = infl_ic_init_basis();
  let nc = basis.nc;
  let tt = time * timeScale - 0.25;
  let twistAmt = twistAmount;
  let seamless = seamlessLoop;
  let maxSteps = clamp(raymarchSteps, 32, 150);
  let bright = brightness;
  let ro = ro_in;
  let rd = select(infl_ic_default_rd(uv_screen, ro_in), normalize(rd_in), length(rd_in) > 0.001);
  let fo = max(bgFalloff, 1e-4);

  let hit = infl_ic_calc_intersection(ro, rd, tt, twistAmt, seamless, maxSteps, basis, nc, shapeSize, paletteHue);
  let pp = uv_screen;
  var color = infl_ic_render(
    hit,
    ro,
    rd,
    pp,
    tt,
    twistAmt,
    seamless,
    bright,
    basis,
    nc,
    bgInner,
    bgOuter,
    fo,
    shapeSize,
    paletteHue,
    lightAngle,
    contrast
  );
  color = infl_ic_linear_to_screen(color);
  return color;
}
`;
