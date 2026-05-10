# 01 — Expression DSL (parse · validate · emit) — expression-node

## Agent instructions (START HERE)

Follow sections in order. **No UI, no `NodeSpec`, no compiler imports from `WgslMvpCompiler`/`NodeShaderCompiler`**—only **`src/shaders/expression/**`** + Vitest.

Non-negotiables:

- **No** `eval`, `new Function`, or string → GPU pass-through without AST.
- **Identifiers in user source are only** `a`, `b`, `c`, `d` (ports) **plus** allow‑listed builtins (`sin`, …). Reject any other identifier.
- Emitters output **expression fragments** only (no `;`, no statements, no `#` directives).

## Overview

Implement a sandboxed grammar: float literals, `+ - * /`, unary `-`, parentheses, calls to a **fixed builtin table**, and optional `vec2` / `vec3` / `vec4` constructors **when type rules allow**. Expose a single entry point (name up to you; examples below) used by **02A** and **02B**.

## Critical: port-name binding

Emitted GLSL/WGSL will initially reference logical names **`a`…`d`**. The GPU program uses **different** substrings per graph (GLSL `node_*` vars, WGSL `Expr.code`, etc.).

**Choose one documented approach:**

1. **Preferred:** `compileExpression(source, outKind, bindings: { a: string; b: string; c: string; d: string })` where emitters append **parenthesized** sub-expressions for each port (e.g. emit `(node_abc_a)` not bare `a`), **or**
2. Emit with `a`…`d` and document a **post-pass** in 02A/02B: replace `\ba\b` … `\bd\b` with bound strings in **longest-safe** order (all single letters; order `d,c,b,a` before `a` if you ever add longer names—v1 only single letters).

Without this, implementation **will** emit broken shaders.

## Scope

### In

- Suggested layout: `src/shaders/expression/` — `ast.ts`, `parse.ts`, `check.ts`, `emitGlsl.ts`, `emitWgsl.ts`, `builtins.ts`, `index.ts` (barrel), `*.test.ts`.
- **Minimal builtins (v1)** — implement **identically** on both backends (document arity & types in `builtins.ts`):
  - Ops: `+ - * /`, unary `-`, `()`.
  - Scalar math: `sin`, `cos`, `abs`, `sqrt`, `pow`, `floor`, `fract`, `min`, `max`, `clamp`, `mix`, `smoothstep`.
  - Constructors: `vec2(e0,e1)`, `vec3(...)`, `vec4(...)` with **arity 2/3/4** respectively, **float**-typed components only in v1.
- **Typing:** Root expression type **must equal** requested `ExpressionOutputKind` (`float | vec2 | vec3 | vec4`). **No silent scalar→vector promotion** unless the user wrote a constructor explicitly.
- **Limits:** Max source length cap (recommend **4096** chars); reject `NaN` / `Infinity` literals.
- **Tests:** Vitest beside module; minimum:
  - Per-builtin **pair** spot-check (GLSL substring + WGSL substring) where behavior differs naming (`mix`/`clamp` ok same name in WGSL).
  - Invalid: `1+`, `foo()`, unknown id `x`, arity errors, wrong root type (`out=float`, expr=`vec3(1,2,3)`).
  - Binding test: emitted code uses substituted port fragments when **`bindings`** provided.

### Out

- Compiler/UI/docs (tasks **02–04**).

## Public API shape (implement; names may vary)

```ts
export type ExpressionOutputKind = 'float' | 'vec2' | 'vec3' | 'vec4';

export type ExpressionBindings = { a: string; b: string; c: string; d: string };

export function compileExpression(
  source: string,
  out: ExpressionOutputKind,
  bindings: ExpressionBindings
):
  | { ok: true; glslExpr: string; wgslExpr: string }
  | { ok: false; reason: string };
```

- **`glslExpr` / `wgslExpr`**: pure RHS fragments (no assignment).
- **`reason`**: short, stable English for warnings (02A copies into `[WARNING] …`).

## WGSL builtins (sanity)

Reuse WGSL spelling already used elsewhere in **`WgslMvpCompiler`** (e.g. `mix`, type suffixes `f32`, `vec3<f32>(…)`). If a GLSL builtin has no WGSL analogue in your subset, **omit it from v1** rather than approximating silently.

## Dependencies

### Provides

- Importable compile API + tests blocking **02A/02B**.

### Blocks

- **02A**, **02B** until merged.

## Completion

✅ Done when API is frozen, bindings behave as documented, **`npm run type-check` + `npm test`** pass.

### Acceptance (observable)

- **`ok: false`** never returns emitted strings.
- At least **one** test proves **distinct** `bindings.a` vs `bindings.b` appear in **both** `glslExpr` and `wgslExpr`.

### Final steps

- Update `docs/implementation/expression-node/_OVERVIEW.md` row **01** with ✅ date + note.
