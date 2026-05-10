# 02B — WGSL MVP compiler integration — expression-node

## Agent instructions (START HERE)

Depends on **01** + **`NodeSpec` from 02A** (same `id` / port names / param names).

Primary file: **`src/shaders/compilation/WgslMvpCompiler.ts`** (~8k LOC). Use existing math nodes as templates — search **`case 'add':`**, **`case 'multiply':`** (~L3700). Output uses **`setNodeOut(nodeId, 'out', { type, code })`** with WGSL types **`f32`**, **`vec2<f32>`**, **`vec3<f32>`**, **`vec4<f32>`**.

Non-negotiables:

- Append **`expression`** to **`WGSL_SUPPORTED_NODE_TYPES`** (top of same file) **only** with tests.
- **Invalid `expr`:** assign **typed zero** `code` (same type as normal success branch) + record warning — **never** return `supported: false` solely due to bad expr.
- **Bindings:** use **`resolveInputF32(nodeId, 'a')`** (and `b`,`c`,`d` with appropriate fallback param names matching **02A**). For each port, if resolver returns null, use **`'0.0'`** as binding substring (consistent with GLSL path defaults).

## Overview

1. **`WGSL_SUPPORTED_NODE_TYPES`:** add `'expression'`.
2. In the big **`switch (node.type)`** (same function as other cases), add **`case 'expression':`**:
   - Resolve **`a`–`d`** with **`resolveInputF32`** (mirror **`add`** / **`multiply`** patterns).
   - Map `outputType` int → WGSL **`type`** string for **`setNodeOut`**.
   - **`compileExpression(expr, kind, { a: a.code, … })`** from task 01.
   - **`setNodeOut(nodeId,'out',{ type, code: wgslExpr })`** on success.
   - On failure: **`code: '0.0'`** / **`vecN<f32>(…)'`** fallback matching declared type.
3. **Warnings accumulation:** **`compileWgslMvp`** success return currently sets **`metadata: { warnings: [] }`** (~L7992). Refactor minimally to **`const shaderWarnings: string[] = []`** in the main compile routine, **`push`** on expression fallback **and any future needs**, assign **`warnings: shaderWarnings`** in **success** returns. Align message text with **02A** (**shared helper** `pushExpressionFallbackWarning(warnings, nodeId, reason)` in e.g. `src/shaders/expression/warnings.ts`).

## Cross-cutting: WebGPU `metadata.warnings` merge

Verify **`NodeShaderCompiler.compile`** when **`targetBackend === 'webgpu'`** returns **`…wgslResult`** — if early graph validation **`warnings`** are **not merged** into `metadata.warnings`, fix by **`warnings: [...warnings, ...wgslResult.metadata.warnings]`** (or concat once) **in the same WP** if reproducible.

## Scope

### In

- **`WgslMvpCompiler.ts`** allow-list + `case 'expression'`, warning accumulation refactor, WebGPU merge fix if needed, tests.

### Out

- UI (**03**), docs/preset (**04**).

## Tests

- Add or extend WGSL compile tests (patterns: **`NodeShaderCompiler.test.ts`** `'compiles src/presets/new.json on WebGPU'`, **`wgslMvpCompileSnapshots`**, grep repo for **`compileWgslMvp`** callers).
- Minimum assertions:
  - Graph with **`expression`** + supported chain → **`supported: true`**.
  - WGSL **`code`** contains expected substring for a trivial **`sin(a)`**-style expr **after bindings**.
  - Invalid expr → **`supported: true`** + **`metadata.warnings`** non‑empty (**after** merge fix if applied).

## Completion

✅ Done when **`npm run type-check && npm test && npm run lint && npm run build`** pass; snapshots change **only** with committed expectation.

### Acceptance (observable)

- **`grep`** or snapshot: **`expression`** appears in allow-list constant + **`case 'expression'`** exists.
- WGSL codegen **imports** DSL from **`src/shaders/expression`** (no duplicated parser logic).

### Final steps

- `docs/implementation/expression-node/_OVERVIEW.md` row **02B** ✅.
