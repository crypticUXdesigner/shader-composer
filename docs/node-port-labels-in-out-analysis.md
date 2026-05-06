# Node port labels: full human-readable list

All node ports should show **human-readable labels** in the UI, not code-like names. The UI uses `port.label ?? port.name` (`NodeHeader.svelte`), so when `label` is missing, the port name (e.g. `in`, `out`, `ro`, `a`, `b`) is shown.

**Convention:** Keep the port **name** unchanged (used in shader code). Add or set the optional **label** for display only. Prefer normal prose: "Ray origin", "First value", "Result", "Color"—not "ro", "a", "out", "vec3".

---

## Label style guide

- **Avoid code:** No `in`, `out`, `ro`, `rd`, `a`, `b`, `t`, `min`, `max`, `x`, `y`, `z`, `w` as the only label.
- **Use plain language:** "UV", "Position", "Value", "Color", "Ray origin", "Ray direction", "First value", "Second value", "Result", "Mask", "Background", "Foreground".
- **By type/semantics:**
  - **vec2** (domain/screen): **UV** or **Position** (when center-relative).
  - **float** (scalar): **Value**, **Luminance**, **Angle** (trig), **Factor**, or **First value** / **Second value** for binary ops.
  - **vec3/vec4** (color): **Color**; (direction/position): **Direction**, **Position**, **Ray origin**, **Ray direction**.
  - **Outputs:** **Result**, **Value**, **UV**, **Color**, or a short semantic name (**Noise**, **Rays**, **Glow**, **Mask**).

---

## 1. Input nodes

| Node ID | Port | Type | Current label | Suggested label |
|---------|------|------|---------------|-----------------|
| uv-coordinates | out | vec2 | — | **UV** |
| time | out | float | — | **Time** |
| resolution | out | vec2 | — | **Resolution** |
| fragment-coordinates | out | vec2 | — | **Frag coords** |
| constant-float | out | float | — | **Value** |
| constant-vec2 | out | vec2 | — | **UV** |
| constant-vec3 | out | vec3 | — | **Color** |
| constant-vec4 | out | vec4 | — | **Color** |
| orbit-camera | in | vec2 | Screen position | **Screen position** (keep) |
| orbit-camera | ro | vec3 | — | **Ray origin** |
| orbit-camera | rd | vec3 | — | **Ray direction** |
| look-at-camera | in | vec2 | — | **Screen position** |
| look-at-camera | ro | vec3 | — | **Ray origin** |
| look-at-camera | rd | vec3 | — | **Ray direction** |

---

## 2. Transform nodes

| Node ID | Port | Type | Current label | Suggested label |
|---------|------|------|---------------|-----------------|
| translate | in | vec2 | — | **UV** |
| translate | out | vec2 | — | **UV** |
| rotate | in | vec2 | — | **UV** |
| rotate | out | vec2 | — | **UV** |
| scale | in | vec2 | — | **UV** |
| scale | out | vec2 | — | **UV** |

---

## 3. Distort / transform (polar, vector field, warp, etc.)

| Node ID | Port | Type | Current label | Suggested label |
|---------|------|------|---------------|-----------------|
| polar-coordinates | in | vec2 | — | **UV** |
| polar-coordinates | out | vec2 | — | **Polar UV** |
| vector-field | in | vec2 | — | **UV** |
| vector-field | out | vec2 | — | **Displaced UV** |
| turbulence | in | vec2 | — | **UV** |
| turbulence | out | vec2 | — | **Displaced UV** |
| twist-distortion | in | vec2 | — | **UV** |
| twist-distortion | out | vec2 | — | **UV** |
| kaleidoscope | in | vec2 | — | **Position** |
| kaleidoscope | out | vec2 | — | **UV** |
| bulge-pinch | in | vec2 | — | **UV** |
| bulge-pinch | out | vec2 | — | **UV** |
| ripple | in | vec2 | — | **UV** |
| ripple | out | vec2 | — | **UV** |
| fisheye | in | vec2 | — | **UV** |
| fisheye | out | vec2 | — | **UV** |
| mirror-flip | in | vec2 | — | **Position** |
| mirror-flip | out | vec2 | — | **UV** |
| displace | in | vec2 | — | **UV** |
| displace | offset | vec2 | — | **Offset** |
| displace | amount | float | — | **Amount** |
| displace | out | vec2 | — | **UV** |
| vortex | in | vec2 | — | **UV** |
| vortex | out | vec2 | — | **UV** |
| spherize | in | vec2 | — | **UV** |
| spherize | out | vec2 | — | **UV** |
| quad-warp | in | vec2 | — | **UV** |
| quad-warp | out | vec2 | — | **UV** |
| brick-tiling | in | vec2 | — | **UV** |
| brick-tiling | out | vec2 | — | **UV** |
| infinite-zoom | in | vec2 | — | **Position** |
| infinite-zoom | out | vec2 | — | **UV** |
| fractal | in | vec2 | — | **UV** |
| fractal | out | vec2 | — | **UV** |

---

## 4. Pattern / noise nodes

| Node ID | Port | Type | Current label | Suggested label |
|---------|------|------|---------------|-----------------|
| noise | in | vec2 | — | **UV** |
| noise | out | float | — | **Noise** |
| warp-terrain | in | vec2 | — | **UV** |
| warp-terrain | out | float | — | **Value** |
| voronoi-noise | in | vec2 | — | **UV** |
| voronoi-noise | out | float | — | **Noise** |
| cubic-curl-noise | in | vec2 | — | **UV** |
| cubic-curl-noise | out | vec3 | — | **Noise** |
| worley-noise | in | vec2 | — | **UV** |
| worley-noise | out | float | — | **Noise** |
| rings | in | vec2 | — | **Position** |
| rings | out | float | — | **Value** |
| spiral | in | vec2 | — | **Position** |
| spiral | out | float | — | **Value** |
| gradient | in | vec2 | — | **Position** |
| gradient | out | float | — | **Value** |
| radial-rays | in | vec2 | — | **Position** |
| radial-rays | out | float | — | **Rays** |
| sunbeams | in | vec2 | — | **UV** |
| sunbeams | out | float | — | **Beams** |
| crepuscular-rays | in | vec2 | — | **UV** |
| crepuscular-rays | out | float | — | **Rays** |
| volume-rays | in | vec2 | — | **UV** |
| volume-rays | out | vec4 | — | **Color** |
| streak | in | vec2 | — | **UV** |
| streak | out | float | — | **Value** |
| wave-patterns | in | vec2 | — | **UV** |
| wave-patterns | out | float | — | **Value** |
| flow-field-pattern | in | vec2 | — | **UV** |
| flow-field-pattern | out | float | — | **Value** |
| hexagonal-grid | in | vec2 | — | **UV** |
| hexagonal-grid | out | float | — | **Value** |
| stripes | in | vec2 | — | **Position** |
| stripes | out | float | — | **Value** |
| dots | in | vec2 | — | **UV** |
| dots | out | float | — | **Value** |
| disco-pattern | in | vec2 | — | **UV** |
| disco-pattern | out | vec4 | — | **Color** |
| reaction-diffusion | in | vec2 | — | **UV** |
| reaction-diffusion | out | vec3 | — | **Color** |
| triangle-grid | in | vec2 | — | **Position** |
| triangle-grid | out | float | — | **Value** |
| particle-system | in | vec2 | — | **UV** |
| particle-system | out | float | — | **Particles** |
| rain-drops | in | vec2 | UV | **UV** (keep) |
| rain-drops | out | vec2 | — | **UV** |
| hash32 | in | vec2 | — | **Seed** |
| hash32 | out | vec3 | — | **Color** |

---

## 5. Shape / geometry / SDF / raymarch nodes

| Node ID | Port | Type | Current label | Suggested label |
|---------|------|------|---------------|-----------------|
| sphere-raymarch | in | vec2 | — | **UV** |
| sphere-raymarch | out | float | — | **Glow** |
| sphere-raymarch | color | vec3 | Color | **Color** (keep) |
| spherical-fibonacci | (outputs only) | — | — | — |
| spherical-fibonacci | index | float | Index | **Index** (keep) |
| spherical-fibonacci | direction | vec3 | Direction | **Direction** (keep) |
| spherical-fibonacci | nearestPoint | vec3 | Nearest | **Nearest** (keep) |
| bloom-sphere | in | vec2 | — | **UV** |
| bloom-sphere | out | float | — | **Value** |
| bloom-sphere-effect | in | vec2 | — | **UV** |
| bloom-sphere-effect | out | vec4 | Color | **Color** (keep) |
| box-torus-sdf | in | vec2 | — | **UV** |
| box-torus-sdf | out | float | — | **Glow** |
| glass-shell | in | vec2 | — | **UV** |
| glass-shell | out | vec4 | Color | **Color** (keep) |
| hex-prism-sdf | (see node) | — | — | (position, etc. already labeled where used) |
| hex-voxel | in | vec2 | — | **UV** |
| hex-voxel | out | vec4 | — | **Color** |
| radial-repeat-sdf | position | vec3 | Position | **Position** (keep) |
| radial-repeat-sdf | out | float | — | **Distance** |
| repeated-hex-prism-sdf | position | vec3 | Position | **Position** (keep) |
| repeated-hex-prism-sdf | out | float | — | **Distance** |
| kifs-sdf | position | vec3 | Position | **Position** (keep) |
| kifs-sdf | out | float | — | **Distance** |
| ether-sdf | position | vec3 | Position | **Position** (keep) |
| ether-sdf | out | float | — | **Distance** |
| displacement-3d | (see node) | — | — | (inputs/outputs as in spec) |
| generic-raymarcher | in | vec2 | — | **UV** |
| generic-raymarcher | sdf | float | SDF | **SDF** (keep) |
| generic-raymarcher | displacement | vec3 | Displacement | **Displacement** (keep) |
| generic-raymarcher | ro | vec3 | Ray origin | **Ray origin** (keep) |
| generic-raymarcher | rd | vec3 | Ray direction | **Ray direction** (keep) |
| generic-raymarcher | out | float | — | **Glow** |
| generic-raymarcher | color | vec3 | Color | **Color** (keep) |
| cylinder-cone | in | vec2 | — | **UV** |
| cylinder-cone | out | float | — | **Glow** |
| iridescent-tunnel | in | vec2 | UV | **UV** (keep) |
| iridescent-tunnel | out | vec4 | Color | **Color** (keep) |
| inflated-icosahedron | in | vec2 | Screen position | **Screen position** (keep) |
| inflated-icosahedron | out | vec3 | Color | **Color** (keep) |
| shapes-2d | in | vec2 | — | **Position** |
| shapes-2d | out | float | — | **Value** |
| star-shape-2d | in | vec2 | — | **Position** |
| star-shape-2d | out | float | — | **Value** |
| metaballs | in | vec2 | — | **UV** |
| metaballs | out | float | — | **Glow** |
| star-2d | in | vec2 | — | **Position** |
| star-2d | out | float | — | **Value** |
| superellipse | in | vec2 | — | **Position** |
| superellipse | out | float | — | **Value** |
| plane-grid | in | vec2 | — | **UV** |
| plane-grid | out | float | — | **Grid** |
| sky-dome | in | vec2 | — | **UV** |
| sky-dome | out | vec3 | — | **Color** |
| bokeh-point | ro | vec3 | Ray origin | **Ray origin** (keep) |
| bokeh-point | rd | vec3 | Ray direction | **Ray direction** (keep) |
| bokeh-point | point | vec3 | Point | **Point** (keep) |
| bokeh-point | out | float | — | **Blur** |
| drive-home-lights | ro | vec3 | Ray origin | **Ray origin** (keep) |
| drive-home-lights | rd | vec3 | Ray direction | **Ray direction** (keep) |
| drive-home-lights | out | vec3 | — | **Color** |
| iterated-inversion | in | vec2 | — | **UV** |
| iterated-inversion | out | vec3 | — | **Color** |

---

## 6. Math nodes (primitives, trig, vector ops)

### 6.1 Math primitives (add, subtract, multiply, divide, power, sqrt, abs, floor, ceil, fract, modulo, min, max, clamp, mix, step, smoothstep)

| Port | Type | Suggested label |
|------|------|-----------------|
| a | float | **First value** |
| b | float | **Second value** |
| base | float | **Base** |
| exponent | float | **Exponent** |
| in | float | **Value** |
| min | float | **Minimum** |
| max | float | **Maximum** |
| edge | float | **Threshold** |
| edge0 | float | **Lower edge** |
| edge1 | float | **Upper edge** |
| x | float | **Value** |
| out | float | **Result** |

### 6.2 Math trig/exp (sin, cos, tan, asin, acos, atan, atan2, exp, log)

| Port | Type | Suggested label |
|------|------|-----------------|
| in | float | **Angle** (for sin/cos/tan/asin/acos/atan) or **Value** (for exp/log) |
| y | float | **Y** (for atan2) |
| x | float | **X** (for atan2) |
| out | float | **Result** |

### 6.3 Math vector ops (length, distance, dot, cross, normalize, reflect, refract)

| Port | Type | Suggested label |
|------|------|-----------------|
| in | vec2 | **Vector** |
| a | vec2/vec3 | **First vector** |
| b | vec2/vec3 | **Second vector** |
| I | vec2 | **Incident** |
| N | vec2 | **Normal** |
| eta | float | **Ratio** |
| out | float/vec2/vec3 | **Result** (or **Length** for length node) |

---

## 7. Blending and masking nodes

| Node ID | Port | Type | Current label | Suggested label |
|---------|------|------|---------------|-----------------|
| blend-mode | base | float | — | **Background** |
| blend-mode | blend | float | — | **Blend** |
| blend-mode | out | float | — | **Result** |
| compare | a | float | — | **First value** |
| compare | b | float | — | **Second value** |
| compare | out | float | — | **Result** |
| select | condition | float | — | **Condition** |
| select | trueValue | float | — | **If true** |
| select | falseValue | float | — | **If false** |
| select | out | float | — | **Result** |
| mask-composite-float | bg | float | Background | **Background** (keep) |
| mask-composite-float | mask | float | — | **Mask** |
| mask-composite-float | fg | float | Foreground | **Foreground** (keep) |
| mask-composite-float | out | float | — | **Result** |
| mask-composite-vec3 | bg | vec3 | Background | **Background** (keep) |
| mask-composite-vec3 | mask | float | — | **Mask** |
| mask-composite-vec3 | fg | vec3 | Foreground | **Foreground** (keep) |
| mask-composite-vec3 | out | vec3 | — | **Color** |

---

## 8. Post-processing nodes

| Node ID | Port | Type | Current label | Suggested label |
|---------|------|------|---------------|-----------------|
| blur | in | vec4 | — | **Color** |
| blur | out | vec4 | — | **Color** |
| glow-bloom | in | vec4 | — | **Color** |
| glow-bloom | out | vec4 | — | **Color** |
| edge-detection | in | vec4 | — | **Color** |
| edge-detection | out | vec4 | — | **Edges** |
| chromatic-aberration | in | vec4 | — | **Color** |
| chromatic-aberration | out | vec4 | — | **Color** |
| rgb-separation | in | vec4 | — | **Color** |
| rgb-separation | out | vec4 | — | **Color** |
| scanlines | in | vec4 | — | **Color** |
| scanlines | out | vec4 | — | **Color** |
| color-grading | in | vec4 | — | **Color** |
| color-grading | out | vec4 | — | **Color** |
| normal-mapping | in | vec4 | — | **Height** |
| normal-mapping | out | float | — | **Value** |
| lighting-shading | in | vec4 | — | **Luminance** |
| lighting-shading | out | float | — | **Shading** |
| blending-modes | in | vec4 | — | **Color** |
| blending-modes | out | float | — | **Result** |

---

## 9. Color system nodes

| Node ID | Port | Type | Current label | Suggested label |
|---------|------|------|---------------|-----------------|
| oklch-color-map-bezier | in | float | — | **Value** |
| oklch-color-map-bezier | startColor | vec3 | — | **Start color** |
| oklch-color-map-bezier | endColor | vec3 | — | **End color** |
| oklch-color-map-bezier | lCurve | vec4 | — | **L curve** |
| oklch-color-map-bezier | cCurve | vec4 | — | **C curve** |
| oklch-color-map-bezier | hCurve | vec4 | — | **H curve** |
| oklch-color-map-bezier | out | vec3 | — | **Color** |
| oklch-color-map-threshold | in | float | — | **Value** |
| oklch-color-map-threshold | startColor | vec3 | — | **Start color** |
| oklch-color-map-threshold | endColor | vec3 | — | **End color** |
| oklch-color-map-threshold | lCurve | vec4 | — | **L curve** |
| oklch-color-map-threshold | cCurve | vec4 | — | **C curve** |
| oklch-color-map-threshold | hCurve | vec4 | — | **H curve** |
| oklch-color-map-threshold | fragCoord | vec2 | — | **Frag coords** |
| oklch-color-map-threshold | resolution | vec2 | — | **Resolution** |
| oklch-color-map-threshold | out | vec3 | — | **Color** |
| tone-mapping (color-system-effects) | in | vec3 | — | **Color** |
| tone-mapping | out | vec3 | — | **Color** |
| oklch-color (color-system-primitives) | out | vec3 | — | **Color** |
| bezier-curve (color-system-primitives) | out | vec4 | — | **Color** |
| bayer-dither (color-system-primitives) | in | float | — | **Value** |
| bayer-dither | fragCoord | vec2 | — | **Frag coords** |
| bayer-dither | resolution | vec2 | — | **Resolution** |
| bayer-dither | out | float | — | **Value** |

---

## 10. Utility nodes

| Node ID | Port | Type | Current label | Suggested label |
|---------|------|------|---------------|-----------------|
| one-minus | in | float | — | **Value** |
| one-minus | out | float | — | **Result** |
| negate | in | float | — | **Value** |
| negate | out | float | — | **Result** |
| reciprocal | in | float | — | **Value** |
| reciprocal | out | float | — | **Result** |
| clamp-01 | in | float | — | **Value** |
| clamp-01 | out | float | — | **Result** |
| saturate | in | float | — | **Value** |
| saturate | out | float | — | **Result** |
| sign | in | float | — | **Value** |
| sign | out | float | — | **Result** |
| round | in | float | — | **Value** |
| round | out | float | — | **Result** |
| truncate | in | float | — | **Value** |
| truncate | out | float | — | **Result** |
| lerp | a | float | — | **Start** |
| lerp | b | float | — | **End** |
| lerp | t | float | — | **Factor** |
| lerp | out | float | — | **Result** |
| swizzle | in | vec4 | — | **Vector** |
| swizzle | out | vec4 | — | **Result** |
| split-vector | in | vec4 | — | **Vector** |
| split-vector | x | float | — | **X** |
| split-vector | y | float | — | **Y** |
| split-vector | z | float | — | **Z** |
| split-vector | w | float | — | **W** |
| combine-vector | x | float | — | **X** |
| combine-vector | y | float | — | **Y** |
| combine-vector | z | float | — | **Z** |
| combine-vector | w | float | — | **W** |
| combine-vector | out | vec4 | — | **Vector** |

---

## 11. Operation / output nodes

| Node ID | Port | Type | Current label | Suggested label |
|---------|------|------|---------------|-----------------|
| color-map | in | float | — | **Value** |
| color-map | out | vec3 | — | **Color** |
| final-output | in | vec3 | — | **Color** |

---

## 12. Quick reference: code name → human-readable label

Use this when adding labels to any port not listed above.

| Port name (code) | Suggested label (human) |
|------------------|--------------------------|
| in | **UV** (vec2), **Value** (float), **Color** (vec3/vec4) |
| out | **Result**, **Value**, **UV**, **Color**, or semantic (**Noise**, **Glow**, **Rays**) |
| a, b | **First value**, **Second value** (or **Start**, **End** for lerp) |
| t | **Factor** |
| min, max | **Minimum**, **Maximum** |
| base, exponent | **Base**, **Exponent** |
| edge, edge0, edge1 | **Threshold**, **Lower edge**, **Upper edge** |
| x, y, z, w | **X**, **Y**, **Z**, **W** (for components) or **Value** (single input) |
| ro, rd | **Ray origin**, **Ray direction** |
| position | **Position** |
| sdf | **SDF** |
| displacement | **Displacement** |
| condition | **Condition** |
| trueValue, falseValue | **If true**, **If false** |
| bg, fg | **Background**, **Foreground** |
| mask | **Mask** |
| blend | **Blend** |
| fragCoord | **Frag coords** |
| resolution | **Resolution** |
| startColor, endColor | **Start color**, **End color** |
| lCurve, cCurve, hCurve | **L curve**, **C curve**, **H curve** |
| I, N | **Incident**, **Normal** |
| eta | **Ratio** |
| point | **Point** |

---

## 13. Next steps

1. Review the tables and adjust any label to match product wording.
2. In each node spec file, add `label: 'Suggested label'` to every port in `inputs` and `outputs` (keep existing labels where they already match the style).
3. Ensure the help/ports UI uses `port.label ?? port.name` so the same labels appear in docs and node headers.
4. Build and smoke-test; port names are unchanged, so compilation and connections remain valid.
