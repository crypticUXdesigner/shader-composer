# 02A — GLSL compiler integration — expression-node

## Agent instructions (START HERE)

Depends on **01** (`compileExpression` + bindings). Goal: **`expression`** compiles on **WebGL path** (`targetBackend === 'webgl'` in `NodeShaderCompiler.compile`).

Read **`src/shaders/compilation/MainCodeGeneratorNodeCode.ts`** (`generateNodeCode`) before coding: today it resolves **`inputVars`**, runs **`replacePlaceholders(nodeSpec.mainCode, …)`**, then special‑cases **`generic-raymarcher`**. Follow that pattern.

Non-negotiables:

- **Do not** put raw user `expr` into `mainCode` for placeholder expansion as **`$param.expr`** literal text into GLSL—the value is prose that must compile to an **RHS expression**.
- **String param `expr`:** Already excluded from uniforms in **`UniformGenerator.generateUniformNameMapping`** (`paramSpec.type === 'string'` branch) — verify no regression.
- **Warnings:** Mirror `NodeShaderCompiler` conventions: prefix **`[WARNING]`** (see existing `warnings.push` usages in **`src/shaders/NodeShaderCompiler.ts`**).

## Overview

1. Add **`src/shaders/nodes/expression.ts`** + export in **`src/shaders/nodes/index.ts`**.
2. Extend **`computeEffectiveNodeSpecs`** (`src/shaders/compilation/effectiveNodeSpecs.ts`): for **`canonical.id === 'expression'`**, clone spec and set **`outputs` port `out` type** from int param **`outputType`** (`0=float`, `1=vec2`, `2=vec3`, `3=vec4` — document mapping in one enum comment).
3. In **`generateNodeCode`**, when **`nodeSpec.id === 'expression'`**:
   - After **`inputVars`** is fully populated (including fallbacks — same loop as peers), build **`bindings`:**
     - `a: inputVars.get('a') ?? '0.0'` (and similarly `b`,`c`,`d`) — floats only in v1.
   - Read **`outputType`** from `node.parameters` with spec default fallback; map → **`ExpressionOutputKind`**.
   - Read **`expr`** string from `node.parameters.expr` ?? spec default.
   - Call **`compileExpression(expr, kind, bindings)`**.
   - On **`ok: true`:** emit **`${outputVar} = ${glslExpr};`** where **`outputVar`** is `outputVars.get('out')` (same as other nodes’ `$output.out` target).
   - On **`ok: false`:** emit assignment of **typed fallback zero** (`0.0`, `vec2(0.0)`, …) matching effective output port type **and push warning** including node id + `reason`.
4. **Skip** the generic `replacePlaceholders` path for this node **or** use a **`mainCode` stub that is never executed** — pick the approach that minimizes foot-guns (early `return code.join('\n')` after push is clearest).

## Warning plumbing (required)

`generateNodeCode` currently returns **only `string`**. **`NodeShaderCompiler.compile`** owns the `warnings: string[]` that becomes **`metadata.warnings`**.

Pick **one** minimal approach:

- **Recommended:** Extend **`generateMainCode`** (`src/shaders/compilation/MainCodeGenerator.ts`) + **`generateNodeCode`** signature to accept **`warnings: string[] | undefined`** and **`push`** from the `expression` branch; thread from **`NodeShaderCompiler.compile`** Step 7 where **`warnings`** already exists.

Document the signature change in PR when present.

## Scope

### In

- **`expression` NodeSpec**, **`effectiveNodeSpecs`**, **`generateNodeCode` branch**, **`parameterEnumMappings`**, GLSL-focused tests, warning threading as above.

### Out

- WGSL emission (**02B**).
- CodeMirror UI (**03**).
- **`node-documentation.json`** / preset (**04**).

## NodeSpec checklist (normative)

| Field | Value |
| --- | --- |
| `id` | `expression` |
| `displayName` | `Expression` (or product-chosen Title Case — must match help `title` in 04) |
| `category` | `Math` (Power button: **ineligible**, consistent with existing Math policy) |
| `inputs` | `a`,`b`,`c`,`d` type **`float`**, each `fallbackParameter` same name + float **default `0.0`** in `parameters` |
| `parameters` | `expr: { type: 'string', default: 'a' }` (or similarly safe); `outputType: { type: 'int', min: 0, max: 3, default: 0, … }` |
| `parameterLayout` | Grid: `outputType` row + **`expr` full width span** — final height comes from **`'code'` UI** in 03 |

Add **`getParameterEnumMappings`** for **`('expression','outputType')`** in **`src/utils/parameterEnumMappings.ts`**.

Optional **`icon`** on spec + **`iconsNodeRegistry`** entry if icons don’t resolve automatically.

## Tests

- Add **`src/shaders/**/*.test.ts`** (or extend **`NodeShaderCompiler.test.ts`**): compile a tiny graph `uv-coordinates → expression → … → final-output` (or simplest valid pigment path) asserting:
  - valid `expr` appears in **`shaderCode`** as substring tied to **`bindings`** (e.g. uses **`sin(`**).
  - invalid `expr` still yields **successful** compile + **warning** substring + **`0.0` / vec zero** assignment.
  - **`outputType` change** type-check acceptance: downstream node receives compatible type (**use `mix`/`color-map`** or simpler consumer).

## Completion

✅ Done when **`npm run type-check && npm run test && npm run lint && npm run build`** pass and **`_OVERVIEW` 02A** updated.

### Acceptance (observable)

- Invalid **`expr`** → **`metadata.warnings.length`** increments (GLSL/WebGL compile).
- **`TypeValidator`** sees updated **`out`** type via **`effectiveNodeSpecs`** (graph-level assertion).

### Final steps

- `docs/implementation/expression-node/_OVERVIEW.md` row **02A** ✅.
