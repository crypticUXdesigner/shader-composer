# Expression node (sandboxed math DSL)

## Mission

Ship an **`expression`** shader node where users author a **small, parsed expression** (not raw GLSL/WGSL pasted into the GPU program) that reads **`a`–`d` float inputs** and writes a typed **`out`** (`float` / `vec2` / `vec3` / `vec4`), with **deterministic fallback** when the formula is invalid—while keeping the **immutable graph**, **typed connections**, preview/export compile paths, and **WebGPU (WGSL MVP) parity** for supported graphs.

## Execution order (for agents)

1. **Task 01** — lands first; freeze the **public compile API** (`ExpressionOutputKind`, `compileExpression` or equivalent) including **identifier → GPU binding** semantics (see Critical contract below).
2. **02A ∥ 02B** — may run in parallel after 01; reconcile via **shared helper** for warning text + fallback literal choice.
3. **03** — after **02A** has stable `NodeSpec` (`id`, parameter names, layout).
4. **04** — last; help + preset only when 01–03 behave.

**Branch discipline:** one PR can stack 01→02A→02B→03→04, or parallelize 02A/02B on separate branches that both rebase on 01—coordinate on **touching `WgslMvpCompiler.ts`** (high conflict risk).

## Critical contract: `a`–`d` are *ports*, not GPU identifiers

The user’s formula uses **`a`, `b`, `c`, `d`** as language identifiers. The compiler maps each to the **wired input expression** (already resolved in GLSL as `node_…` variables or inlined literals; in WGSL as `Expr.code` substrings from `resolveInputF32`).

**Task 01** should emit expressions that still reference logical names; **02A / 02B** must perform a **safe, word-boundary-aware substitution** into the final GPU snippet (or task 01 accepts an explicit binding map—pick one approach and document it in module JSDoc).

Do **not** `$param.expr` the DSL through `replacePlaceholders` as if it were shader text; `expr` is a **string parameter** compiled into code (see `UniformGenerator`: string params **do not** get uniforms — `src/shaders/compilation/UniformGenerator.ts`).

## Coordinator checklist (quality bar)

- **`displayName` + help `title`:** identical string, Title Case — `.cursor/rules/shaders/node-standards.mdc`.
- **Warnings:** user-visible breadcrumb when fallback triggers; prefix with `[WARNING]` to match `NodeShaderCompiler` style.
- **WebGPU return path:** Today `NodeShaderCompiler.compile()` may return `compileWgslMvp` metadata **without merging** earlier graph `warnings` collected in `validateGraph`. When adding expression fallback warnings, **verify** whether graph-level warnings are dropped on `targetBackend === 'webgpu'` and **fix in the same package if confirmed** (minimal merge of arrays).
- **`computeEffectiveNodeSpecs`:** follow the `select` precedent in `src/shaders/compilation/effectiveNodeSpecs.ts` — override **`out` port type** from `outputType` int; keep canonical spec’s default output type as **`float`** when param absent/invalid.
- **Enum UI:** add `getParameterEnumMappings('expression', 'outputType')` in `src/utils/parameterEnumMappings.ts` (pattern: `compare`, `blend-mode`, …).
- **Tests:** `npm run type-check`, `npm test`, `npm run lint`, `npm run build` — all green before marking any task ✅.

## Why this package exists

Some users prefer code for non-trivial math; wiring many small nodes is slow. This node complements the palette without unconstrained shader authoring in v1.

## Product goals

- **Code-first math** via CodeMirror 6, **minimal builtin surface** (exact list + arity in task 01).
- **Graph-native:** ports `a`–`d` (float), parameter-driven **output type**, serialized like any other node; undo/redo/presets behave normally.
- **Fail-soft:** invalid parse/type → shader still compiles; output = **typed zero**; **`metadata.warnings`** explains fallback (never silent failure).
- **Backend parity:** explicit inclusion in **`WGSL_SUPPORTED_NODE_TYPES`** (`src/shaders/compilation/WgslMvpCompiler.ts`) with matching semantics.

## Non-goals (this package)

- Raw GLSL/WGSL injection, control flow, loops, user functions, textures, extra uniforms.
- Inferring output type from syntax only (**explicit `outputType` param**, default **float**).
- Vector or `any` **inputs** on v1 (defer follow-up).
- Fixing unrelated string-parameter UX (e.g. Swizzle) unless blocking `expression`.

## Locked decisions (from planning)

| Topic | Decision |
| --- | --- |
| Backends | WebGL + WebGPU WGSL MVP |
| Editor | CodeMirror 6 dependency |
| Acceptance | `type-check`, `test`, `lint`, `build` |
| Preset | Demo JSON under `src/presets/` (auto-listed after build — see `src/presets/README.md`) |

## High-touch files (expect edits)

| File / area | Why |
| --- | --- |
| `src/shaders/expression/**` | New DSL module (task 01) |
| `src/shaders/compilation/effectiveNodeSpecs.ts` | Override `out` type for `expression` |
| `src/shaders/compilation/MainCodeGeneratorNodeCode.ts` | `generateNodeCode` special-case; may thread `warnings[]` |
| `src/shaders/compilation/MainCodeGenerator.ts` | Pass `warnings` into codegen loop if API extended |
| `src/shaders/NodeShaderCompiler.ts` | Plumb warnings; optional WebGPU `warnings` merge |
| `src/shaders/compilation/WgslMvpCompiler.ts` | `case 'expression':`, allow-list, accumulate `metadata.warnings` |
| `src/shaders/nodes/expression.ts`, `src/shaders/nodes/index.ts` | Spec + registration |
| `src/utils/parameterEnumMappings.ts` | `outputType` labels |
| `src/utils/iconsNodeRegistry.ts` (if needed) | Icon id |
| `src/types/nodeSpec.ts` | Extend `ParameterUISelection` with `'code'` (or equivalent) |
| `src/lib/components/node/NodeBody.svelte`, `NodeBodyLayoutItem.svelte` | Render code editor; **keep both in sync** |
| `src/lib/components/node/parameters/ExpressionCodeEditor.svelte` | New |
| `src/lib/components/node/Node.svelte` | Ensure editor excluded from drag/selectors per `INPUT_LIKE_SELECTOR` |
| `src/data/node-documentation.json` | `node:expression` |

## Work items

| ID | Task | Status | Provides | Blocks |
| --- | --- | --- | --- | --- |
| 01 | [DSL parse, validate, dual emit](./01-expression-dsl-emission-expression-node.md) | ⏳ | Parse/emit API + Vitest | 02A, 02B |
| 02A | [GLSL compile integration](./02A-glsl-compile-hook-expression-node.md) | ⏳ | `NodeSpec`, `effectiveNodeSpecs`, codegen + tests | 03, 04 |
| 02B | [WGSL MVP compile integration](./02B-wgsl-compile-hook-expression-node.md) | ⏳ | Allow-list + `case 'expression'` + tests | 03, 04 |
| 03 | [Parameter UI — CodeMirror](./03-node-ui-code-editor-expression-node.md) | ⏳ | Editor UX, focus/interaction safety | 04 |
| 04 | [Docs, demo preset, closeout](./04-docs-preset-closeout-expression-node.md) | ⏳ | Help + preset + ✅ package | — |

## Progress tracker

- **Overall:** package not shipped (tasks outstanding).
- **Last reviewed:** 2026-05-10 (plan hardened for delegated implementation).

## Success criteria

- Graphs using only WGSL-MVP-supported nodes **plus `expression`** return `supported: true` when builtins used are allowed.
- Invalid `expr` never breaks compile; **`metadata.warnings`** records fallback (GLSL path; WGSL path must **populate** warnings too, not leave them hard-coded empty).
- `npm run type-check && npm run test && npm run lint && npm run build` green.
- `node-documentation.json` key **`node:expression`** exists; **`title` === `NodeSpec.displayName`**.
