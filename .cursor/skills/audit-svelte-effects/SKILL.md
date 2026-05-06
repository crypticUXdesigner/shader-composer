---
name: audit-svelte-effects
description: Audit $effect / $effect.pre / $effect.root usage across the repo against Svelte 5 docs (escape hatch, prefer $derived and events). Use for periodic hygiene, pre-refactor review, or when debugging effect loops.
---

# Audit Svelte `$effect` usage

**Canonical checklist + rubric:** **`.cursor/commands/audit-svelte-effects.md`** (slash **`/audit-svelte-effects`**).

**Rule of thumb:** **`frontend/svelte-standards.mdc`** — effects for imperative/DOM side work; do not use effects to synchronise derived state.

---

## Flow

1. Open **`audit-svelte-effects.md`** and follow **Steps** + **Deliverable**.
2. Cite official doc links from that file when classifying call sites.
3. Output **Keep / Refactor / Investigate** per site; do not expand scope into unrelated refactors unless asked.
