# 03 — Node parameter UI (CodeMirror) — expression-node

## Agent instructions (START HERE)

Depends on **`NodeSpec` from 02A** finalized: **`expression`**, **`expr`** (string), **`outputType`** (int enum).

Non-negotiables:

- **`NodeBody.svelte` + `NodeBodyLayoutItem.svelte`**: **must remain in sync** (duplicate grid branches)—diff both whenever you edit one.
- **`.cursor/rules/frontend/`**: `svelte-standards`, `keyboard-focus`, `css-standards`, `design-system`.
- **`ParameterUISelection`**: `src/types/nodeSpec.ts` union must include **`'code'`** (preferred). **`'custom'` LayoutElement exists in types but has no NodeBody branch** today—**do not** rely on `'custom'` without implementing it fully.

## Overview

Embed **CodeMirror 6** only for **`expression.expr`**. **`outputType`** uses existing **EnumSelector** via **`getParameterEnumMappings('expression','outputType')`** (owned by **02A**).

## Scope

### In

1. **`package.json`:** Add minimal `@codemirror/*` packages; run lockfile update.
2. **`ExpressionCodeEditor.svelte`** (`src/lib/components/node/parameters/`):
   - `onMount` creates **`EditorView`**, **`onDestroy`/return teardown** destroys it.
   - Props: **`value: string`**, **`onChange: (v: string) => void`**, **`label`**, **`disabled`**, **`class`** optional.
   - **Height:** minimum **120px** content box (CSS token or `:global` scoped rule from `tokens-node-editor.css`).
   - **Highlighting:** theme-light syntax via **`@codemirror/lang-cpp`** **or** smaller legacy highlighter—justify bundle size in PR comment.
   - **Updates:** Prefer **immediate** editor UX; **`onChange` to graph**: debounce (**150–300ms**) or **`blur`**-commit—**avoid** compiling WGSL every keypress if profiler shows regressions; document choice in PR.

3. **NodeBody (+ LayoutItem)** grid branch:

```svelte
{:else if uiType === 'code'}
  <!-- ExpressionCodeEditor; onChange -> onParameterChange(paramName, stringValue) -->
```

4. **Spec `parameterLayout`** for `expression`:
   - `parameterUI: { expr: 'code' }` on the **`grid`** element that lists `expr` (mirrors **`input`** override pattern for knobs).

5. **Interaction safety**
   - Confirm **`src/lib/components/node/Node.svelte`** **`INPUT_LIKE_SELECTOR`** includes a selector that covers CodeMirror content (often **`.cm-editor`**, **`[role="textbox"]`**, **`textarea.cm-content`**—inspect DOM after mount). Extend selector **if needed** so drags/delete shortcuts behave like other embedded inputs.

6. **Optional:** **`read_lints`** + Svelte MCP validate per project rules after substantive edits.

### Out

- Help/preset (**04**).

## Canvas overlay / Parameter hit regions

`ParameterHitRegions.ts` reads **`ParameterUIRegistry`**. **`'code'`** is new—verify overlay doesn’t **`throw`**; if precision is poor, acceptable v1 tolerance: oversized hit rect **or** register a renderer stub with sane **`calculateMetrics`** height matching editor cell (**document caveat**).

## Completion

✅ Done when **`npm run type-check && npm run lint && npm run build && npm test`** pass, editor usable on canvas, focused editor blocks destructive shortcuts (**verify `keyboard-focus`** guard applies).

### Acceptance (observable)

- Multiline **`expr`** with newline saves round-trip on reload (preset/load test manually or automate via serialization test).
- No new **`any`** (strict TS).

### Final steps

- `docs/implementation/expression-node/_OVERVIEW.md` row **03** ✅.
