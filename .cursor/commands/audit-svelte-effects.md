# Audit `$effect` usage (Svelte 5)

Full-pass or scoped review of `$effect` / `$effect.pre` / `$effect.root` / `$effect.tracking` against official Svelte 5 guidance. Use for periodic hygiene, before large refactors, or when effects feel fragile.

**Skill:** **`audit-svelte-effects`** (optional shortcut to this flow).

---

## Official references

- [$effect](https://svelte.dev/docs/svelte/$effect) — lifecycle, dependency tracking, teardown, browser-only (no SSR).
- [When not to use `$effect`](https://svelte.dev/docs/svelte/$effect#When-not-to-use-$effect) — treat as an **escape hatch**; avoid syncing state between reactives inside effects.
- [$derived](https://svelte.dev/docs/svelte/$derived), [$derived.by](https://svelte.dev/docs/svelte/$derived) — preferred when a value is computed from other reactive values.
- [Derived overrides](https://svelte.dev/docs/svelte/$derived#Overriding-derived-values) (Svelte 5.25+) — when you need to sometimes override a derived.
- [Function bindings](https://svelte.dev/docs/svelte/bind#Function-bindings) — linking inputs without effect chains.
- [untrack](https://svelte.dev/docs/svelte/svelte#untrack) — documented edge case when read/write the same reactive in an effect.

---

## Judgment rubric

**Likely appropriate (escape-hatch territory)**

- Imperative DOM/canvas, layout measurement, third-party non-reactive APIs.
- Subscriptions/timers/listeners with a **returned teardown** when resources are recreated per run.

**Likely inappropriate or high-risk**

- Assigning to `$state` (or similar) mainly to **mirror** another reactive → prefer **`$derived` / `$derived.by`** or **event-driven** updates.
- Multiple effects that **write** state the **other** reads (sync-loop risk).
- Fetch or heavy work on every dependency change without abort/dedup/cancel discipline.

**Footguns**

- Dependencies read **after** `await` or inside deferred callbacks → **not** tracked; may be silent bugs.
- **Conditional** branches: only the **last run’s** reads become dependencies.
- **`$effect.pre` / `$effect.root`**: confirm rare/advanced need; document why simpler options fail.

---

## Steps

1. Search the repo for: `$effect`, `$effect.pre`, `$effect.root`, `$effect.tracking`, `$effect.pending` (if used with boundaries).
2. Per match: file, minimal excerpt, **what** is tracked (synchronous reads), **teardown** yes/no, **writes** to reactive state yes/no.
3. Classify each: **Keep / Refactor / Investigate** with one sentence tied to the rubric; for **Refactor**, name the preferred primitive (`$derived`, handler, function binding, module helper, etc.).
4. Summarize: counts by classification, **clusters** by feature area, **top 3** refactors that reduce risk or complexity.

---

## Deliverable

Table or bullets: **location → classification → rationale → suggested change (or “keep”)**. Implement refactors only if the operator asks for follow-up work.
