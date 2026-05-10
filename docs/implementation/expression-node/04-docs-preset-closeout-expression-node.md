# 04 — Documentation, demo preset, closeout — expression-node

## Agent instructions (START HERE)

Depends on **01–03** complete and green under **`npm run type-check && npm run test && npm run lint && npm run build`**.

Non-negotiables:

- **`src/data/node-documentation.json`**: exactly one **`helpItems["node:expression"]`** entry; **`title`** **character-for-character equals** **`NodeSpec.displayName`** (`.cursor/rules/shaders/node-standards.mdc`, `help-discovery.mdc`).
- Preset follows **`SerializedGraphFile`** (`src/presets/README.md`); **`audioSetup` optional** — omit unless needed.
- **No** unrelated doc churn.

## Overview

Ship discoverability:

1. **`node-documentation.json`** — tagline, description, limits (no statements/branches), **fallback** explanation (“invalid formula → zero output + warning”), builtin summary, **`setupExampleGraph`**, **`suggestedTargets`** for **`out`**.
2. **`src/presets/<kebab-name>.json`** — minimal graph showcasing **`expression`** (e.g. `sin(time)+a`-style safe expr). **Naming:** descriptive kebab-case; UI shows Title Case derived from filename per README.
3. **Optional:** one short paragraph **`docs/user-goals/04-nodes-and-parameters.md`** referencing Expression — only if WG explicitly wants user-goals synced (product call).

## Dependencies

### Provides

- Help + seeded preset for QA.

### Blocks

- Nothing downstream.

## Verification

```bash
npm run type-check && npm run test && npm run lint && npm run build
```

Load preset / graph JSON through existing validation helpers if repo has **`audit-setup-examples`** etc. (optional parity).

## Completion

✅ Done when Help entry + preset ship, README index row for package already exists (verify **`docs/implementation/README.md`** link), **`_OVERVIEW`** all ✅ + short ship note.

### Acceptance (observable)

- Repo search **`node:expression`**: exactly **one** help block; **`title`** matches **`displayName`**.

### Final steps

- Mark **`expression-node/_OVERVIEW.md`** Progress → **✅ Shipped YYYY‑MM‑DD** when merged.
- Per **`docs-implementation-done-cleanup.mdc`**, do **not** delete package until stakeholder confirms archival policy.
