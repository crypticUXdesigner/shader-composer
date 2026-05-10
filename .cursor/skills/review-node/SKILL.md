---
name: review-node
description: Review a shader node by id/name with an end-user lens—discoverability, mental model, parameter clarity (including short parameter/group/layout labels so the node body grid does not break), panel/canvas flows, help text, and layout vs docs/user-goals. Reply with a 1–2 sentence evaluation and a bulleted list of recommended changes (or None). Use when the operator runs `/review-node` or asks for a structured node QA pass with a node identifier.
---

# Review node

Structured review of **one node** named in the prompt (id like `rings`, **display name** like “Rings”, or ambiguous string — resolve to **`NodeSpec.id`**).

**Primary lens:** **What does this feel like to someone building a graph?** Prefer observations about naming, predictability, discoverability, documentation, and parameter UX over internal code quality.

**Honor:** **`core/project-conventions.mdc`**, **`docs/user-goals/04-nodes-and-parameters.md`** (and linked flows: graph/canvas, connections, audio, timeline), **`shaders/node-standards.mdc`** — especially **Parameter and group label rules** (short **`ParameterSpec` / `ParameterGroup` / layout header** text so the **node body grid** does not break), then **Port label rules** (`UV` vs `Position`, symbolic math **`A`/`B`/`=`/`Mix`**, redundant **Inputs** outputs, constants), **`frontend/help-discovery.mdc`**. Extended port reference: **`docs/implementation/node-port-labels-in-out-analysis.md`**. Incorporate any **extra constraints** from the prompt (preset, screenshot, regression, WGSL-only, etc.).

**Command twin:** `.cursor/commands/review-node.md` (canonical invoke line).

---

## 0. Resolve target

1. Locate **`src/shaders/nodes/<…>.ts`** (or sibling) exporting `*NodeSpec`; confirm **`id`** matches registry entry in **`src/shaders/nodes/index.ts`** (`nodeSystemSpecs`).
2. If name is ambiguous, list candidates briefly and pick by explicit user choice—or default to clearest **`id`** match and state the assumption.
3. Load **`src/data/node-documentation.json`** entry **`node:<id>`** if present; judge whether it helps a **user** decide *when* to use the node and what to try first.

---

## 1. End-user value & mental model

- **Job-to-be-done:** In one sentence, what should someone accomplish with this node?
- **First impression:** From **display name**, **category**, and short description alone, is the role obvious—or easy to confuse with a sibling node? **`displayName`** + help **`title`** match **`shaders/node-standards.mdc`** (Title Case default; exceptions for identifiers/acronyms/shader tokens)?
- **Differentiation:** Overlap with similar nodes; would a user know which to pick? If overlap is high, is the doc/UI copy doing enough to separate them?
- **Outcomes users care about:** Anything likely to read as “broken” (flat black, blown-out, no motion when they expect motion, parameter seems to do nothing) — note as **symptoms**, not root-cause code paths unless the prompt asks for depth.

---

## 2. Flows & clarity (user-goals)

Check alignment with **`04-nodes-and-parameters.md`** and related user-goals for this node’s parameter set:

- **Fixed vs connected:** Are connectable parameters obvious? Any port where **input mode** (override vs use connection) would confuse a newcomer?
- **Live values:** When driven by connection, audio, or timeline, would the user have a fair chance to see **effective** value cues (ports, tooltips, automation indicators) as described in user-goals?
- **Audio / file / timeline:** If the node participates (e.g. **`supportsAudio`**, automation lanes, file params), does the spec match the **interaction** users expect (picker, loading, pauses)?
- **Canvas vs panel:** Color/enum/overlays and on-node affordances — anything likely to feel inconsistent between side panel and canvas?
- **Ports (header):** Do `PortSpec.label`s match **`node-standards.mdc`** — **short** labels that scan in a tight header (not mini-sentences). Reserve longer wording for **docs/tooltips**. Then check vec2 **intent** (`UV` vs `Position` vs `Screen position` / **Frag coords**), **mix/lerp** (**`Mix`** weight), symbolic math vs prose branching, and **omit** redundant **Inputs** single-output labels where policy says to.

---

## 3. Discoverability & help

- **Category & listing:** Right place in the palette; not buried or miscategorized for what it does.
- **node-documentation.json:** Actionable for users (when to use, what to connect, typical pitfalls)? Gaps in *user-facing* explanation matter more than spec-field parity.
- **Tooltips / labels:** Jargon vs plain language; direction of effect (e.g. “more” vs “less” of a quality) matches what the shader **feels** like when dragged. **Parameters & groups:** do **not** suggest long descriptive **`ParameterSpec.label`** strings, **`parameterGroups[].label`** titles, or **`parameterLayout` section/header `label`s** — the **node body uses narrow columns**; verbose copy **breaks layout**. Prefer **one-to-three words**; move nuance to **tooltips** / **`node-documentation.json`**. **Ports:** shortest label per **`node-standards.mdc`** (header is tight too).

---

## 4. Parameter intuitiveness (“knob predictability”)

For each important parameter:

- **Label length (layout):** Is **`parameters.*.label`** short enough for the **on-node body** next to controls? Flag sentence-like or marketing-style strings; recommend **trimming** or **synonyms** per **`node-standards.mdc` Parameter and group label rules**.
- **Label + control type:** Does the label match the perceived effect (including inversions like falloff vs sharpness)?
- **Range & step:** Fine control vs coarse; surprise jumps or dead zones at ends?
- **`knobPolarity` / `knobCenter`:** Centered vs one-sided matches how users think about the quantity?
- **Behavioral mapping:** Nonlinear remaps in the shader — would a short hint explain **perceived** vs raw value?
- **Defaults:** Sensible first frame for a new node; avoids “nothing visible” or extreme starting looks unless intentional.

---

## 5. Parameter UI layout & structure

Evaluate **`parameterLayout`** (see layout element types in **`nodeSpec.ts`**):

- **Group & section titles:** Are **`parameterGroups[].label`** and any layout-element **`label`** headers (grid blocks, rows, strips, …) **brief**? Long section titles steal horizontal space from controls and often **warp the grid** — prefer **short headers**; use docs for exposition.
- **Grouping:** Section order matches a user’s task (e.g. shape → look → modulation → output), not implementation order.
- **Scanning:** Density, orphans, and whether power users can find the one knob they need quickly.
- **`parameterUI` overrides:** Toggle vs slider vs dropdown — matches how often the user will flip vs scrub.
- **Wide rows:** **`extraColumns`**, **`minColumns`** — justified for complex rows (bezier, audio bands) without cluttering simple nodes.

---

## 6. User-facing flexibility (light touch)

- **Missing obvious controls:** Knobs users would reasonably expect next (bounds, seed, orientation, blend, quality) — list as **opportunities**, not implementation tasks unless the prompt asks to build them.
- **Opaque constants:** Magic numbers that force users into narrow looks where a named parameter would help — flag from a **user control** angle.

---

## 7. Implementation & internals (only when user-visible)

Skim **`NodeSpec`** and shader only enough to catch issues that **show up in the product**:

- Wrong or misleading **placeholders** / outputs that would produce incorrect or unstable **visible** results.
- **Registration** missing → node not available (user impact).
- **WGSL / backend split:** Call out **user-visible** parity issues (e.g. different look on WebGPU) if the prompt or context cares; avoid general code-quality review.

**Deprioritize unless the prompt asks:** test coverage shopping lists, refactors, **`parameterTransfer`** / worker plumbing, spec-shape nits with no UX consequence.

---

## Report format (required)

The operator should get a **short, skimmable** reply—no long essay unless they explicitly ask for depth.

1. **Evaluation** — **one to two sentences** overall (verdict on **how it serves users**—clarity, predictability, discoverability—and the main strength or risk).
2. **Recommended changes** — a **bulleted list** of concrete follow-ups framed for **UX or user-facing copy/layout** when possible. If nothing actionable surfaced, write **`None`**. When suggesting **renames** for **parameters, groups, layout section headers, or ports**, keep copy **minimal** — especially **parameter and group labels** (**`node-standards.mdc` Parameter and group label rules**) so the **node body** stays stable; put detail in **docs/tooltips**, not longer on-canvas strings. Internal-only cleanups belong here only if they clearly fix a user-visible problem.

Do **not** add separate sections for implementation, UX, layout, etc., unless the prompt asks for a full write-up. The sections above (**0–7**) are **review steps**, not mandatory headings in the reply.

If the prompt asked for **fixes**: still use this format first, then add **minimal** follow-up tasks or a single PR sketch after the list.

---

## Checklist

Target resolved • registry + **user-facing** doc (`node-documentation.json`) checked • **`04-nodes-and-parameters.md`** (and linked flows as needed) reflected • **`node-standards.mdc`** — **parameter/group/layout header** brevity first, then **port** conventions • mental model, discoverability, parameters, layout, help • implementation skim **only for user-visible risks** • **1–2 sentence evaluation + recommended changes list (or None)** • extra prompt context honored
