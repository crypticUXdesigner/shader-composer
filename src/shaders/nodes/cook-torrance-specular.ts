/**
 * Cook-Torrance (GGX + Smith + Schlick) specular term for raymarched surfaces.
 * Shared GLSL string to be included in node functions (e.g. box-torus-sdf).
 * Call ctSpecular(N, V, L, roughness, F0) from raymarch hit shading.
 */

export const COOK_TORRANCE_SPECULAR_GLSL = `
// Cook-Torrance specular: GGX NDF, Smith geometry, Schlick Fresnel.
// N = surface normal, V = view dir (hit to camera), L = light dir (hit to light).
// roughness and F0 clamped to avoid NaNs; returns specular contribution (0..1 scale).

float ctSpecular(vec3 N, vec3 V, vec3 L, float roughness, float F0) {
  float r = clamp(roughness, 0.001, 1.0);
  float f0 = clamp(F0, 0.0, 1.0);
  vec3 n = normalize(N);
  vec3 v = normalize(V);
  vec3 l = normalize(L);
  float NdotV = max(dot(n, v), 1e-6);
  float NdotL = max(dot(n, l), 1e-6);
  if (NdotL <= 0.0) return 0.0;
  vec3 H = normalize(v + l);
  float NdotH = max(dot(n, H), 0.0);
  float VdotH = max(dot(v, H), 0.0);

  float a = r * r;
  float a2 = a * a;
  float NdotH2 = NdotH * NdotH;
  float denom = NdotH2 * (a2 - 1.0) + 1.0;
  denom = max(denom * denom * 3.14159265, 1e-7);
  float D = a2 / denom;

  float k = (r + 1.0) * (r + 1.0) * 0.125;
  float g1V = NdotV / (NdotV * (1.0 - k) + k);
  float g1L = NdotL / (NdotL * (1.0 - k) + k);
  float G = g1V * g1L;

  float F = f0 + (1.0 - f0) * pow(1.0 - VdotH, 5.0);

  float spec = (D * G * F) / (4.0 * NdotV * NdotL);
  return clamp(spec, 0.0, 10.0);
}
`;
