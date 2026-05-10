# Review node (`/review-node`)

**Skill:** **`review-node`** — `.cursor/skills/review-node/SKILL.md`

---

## Invoke

`/review-node` **\<node id or display name\>** plus optional context (preset, UX concern, WGSL parity, regressions).

The agent resolves the node (`NodeSpec`) and reviews it with an **end-user lens**: **value and mental model**, **flows** (connections, live values, audio/timeline where relevant), **discoverability and help**, **`displayName`/help-title casing**, **parameter and group labels** (`ParameterSpec`, `parameterGroups`, **`parameterLayout` section headers`) — **keep short** so the **on-node body grid** does not break (**`shaders/node-standards.mdc` Parameter and group label rules**), **port `label`s** — **short, scannable** (**`node-standards.mdc` Port label rules**; see **`docs/implementation/node-port-labels-in-out-analysis.md`** for ports), **parameter intuitiveness**, **UI layout**, and **user-facing flexibility**. A **light** implementation skim covers only **user-visible** risks (wrong output, missing registration, parity). Align with **`docs/user-goals/04-nodes-and-parameters.md`** and **`shaders/node-standards.mdc`**.

**Output:** **Evaluation** (1–2 sentences) and **Recommended changes** (bulleted list, or **None**). See skill report format in **`review-node`**.

---

If the slash menu does not list this file yet: type **`@`** **`.cursor/commands/review-node.md`** or **`@`** the skill path.
