---
name: bpmn
description: Turn anything into a BPMN 2.0 diagram — a process described in natural language, a document, a codebase, an execution flow, a CI/CD pipeline. Produces SVG, PNG and an editable .bpmn file. Use when the user types /bpmn, asks for a BPMN, process, swimlane, or flow diagram, or asks to visualize how a process, repository, pipeline or workflow actually works. Runs fully offline — no web service, no browser.
---

# BPMN diagram generator

Turns a description, a document or a codebase into a real BPMN 2.0 diagram.

The pipeline has two halves. **You** (with a subagent) do the modelling: read the
material and write it as Sketch Miner DSL. **The bundled CLI** does everything
else deterministically and offline: parse the DSL, emit BPMN 2.0 XML, lay it
out, render SVG and PNG, and validate the result.

Never draw BPMN XML or SVG by hand. Never call a web service. The engine is
local and it is the only thing that produces diagrams here.

## Step 1 — Decide what the diagram is of

The user's request tells you the subject. Common shapes:

| Request | What to model |
|---|---|
| A process described in prose | The process as described |
| "explain this repo / this module" | The execution flow of its main use case: entry point → calls → branches → error paths |
| "how does this endpoint work" | One request's journey through the code |
| "our CI pipeline" | Jobs, gates and deploy steps from the workflow config |
| A document (spec, SOP, contract) | The process the document describes |

If the subject is genuinely ambiguous — a repo with several unrelated flows —
ask one short question before spending effort. Otherwise pick the most useful
reading and say which one you picked.

**Language:** label the diagram in the language of the user's request, not the
language of the source code identifiers.

## Step 2 — Have a subagent write the DSL

Always delegate this step. The DSL specification is ~17k tokens and the source
material (a repo, a long document) can be much larger; keeping both out of the
main conversation is the point.

Launch a subagent (`general-purpose`) with a prompt that contains:

1. **The specification, by reference — not pasted:**
   "Read `<skill-dir>/references/system-prompt-v5.md` in full before writing
   anything. It is the complete specification of the BPMN Sketch Miner DSL, and
   it is the system prompt you must follow."
2. **The material**, either inline (the user's prose) or as paths for the
   subagent to read (files, directories, a document). For a repo, tell it which
   entry points to start from so it does not read the whole tree.
3. **The task:** which process to model, in which language, at what level of
   detail.
4. **The output contract:** "Write only the DSL to `<path>/source.dsl`. No
   markdown fences, no commentary, no explanation — the file must contain the
   DSL and nothing else. Then reply with a two-line summary of what you
   modelled."

`<skill-dir>` is the directory this SKILL.md lives in.

## Step 3 — Render

```bash
node "<skill-dir>/bin/bpmn-render.mjs" --dsl "<path>/source.dsl" --out bpmn-out --name "<slug>"
```

Writes `bpmn-out/<slug>/<slug>.{svg,png,bpmn,dsl}` and prints one JSON object on
stdout. Useful flags:

| Flag | Effect |
|---|---|
| `--out <dir>` | Output root. Default `bpmn-out`. |
| `--name <slug>` | Base name for the folder and the files. |
| `--formats svg,png,bpmn,dsl` | Subset of artifacts. Default: all four. |
| `--theme dark` | Dark palette instead of black-on-white. |
| `--png-width 2000` | Raster width for the PNG. |
| `--bpmn <file>` | Render an existing BPMN 2.0 file instead of DSL. |
| `--quiet` | No human-readable summary on stderr. |

## Step 4 — Fix what the engine reports

Read the JSON. Act on it:

- **`ok: false`** — the DSL did not compile. Send `error` and `parseErrors` back
  to the subagent, ask it to fix the DSL, and render again. **Retry at most
  twice.** If it still fails, show the user the errors and the DSL rather than
  pretending it worked.
- **`validation.errors` non-empty** — the diagram rendered but is structurally
  wrong. Same retry loop.
- **`validation.warnings`** — usually cosmetic or informational
  (`IMPLICIT_START_EVENT`, `LAYOUT_UNREADABLE_LABEL`). Do not retry for these.
  Mention them only if one materially affects the diagram.
- **`pngNote`** — the PNG was skipped because no system font was found. The SVG
  is still complete; say so and move on.

## Step 5 — Deliver

Show the diagram, then point at the files:

1. Send the **SVG** to the user with `display: "render"` so it appears in the
   panel. Send the PNG too when they asked for a raster.
2. State the output folder and what is in it — in particular that
   `<slug>.bpmn` opens in Camunda Modeler, bpmn.io or any BPMN tool, and
   `<slug>.dsl` is the editable source.
3. Summarise the model in two or three lines: the pools, the decision points,
   the distinct outcomes.

If the user asks for a change, edit the DSL and re-render — do not start over.

## What the DSL is, in one paragraph

Sketch Miner notation describes a process as **execution traces**, not as a
drawing. Each paragraph is one complete path from start to end; blank lines
separate traces; repeating a task name verbatim across traces is what makes the
miner infer a gateway, a merge or a loop. You never write gateways yourself.
`Pool: task` assigns a swimlane, `( )` marks events, `[ ]` data objects, `?`
labels a decision, `|` splits parallel branches. The full rules, including the
anti-patterns that produce broken diagrams, are in
`references/system-prompt-v5.md` — the subagent reads it, you do not need to.

## Constraints

- **Offline.** The engine never touches the network. Do not look up BPMN tools
  or services online, and do not suggest pasting the DSL into a website.
- **Node ≥ 20** is the only requirement. `bin/` is self-contained: no
  `npm install`, no `node_modules`, no browser.
- The engine is the source of truth for whether a model is valid. If it reports
  a problem, the model has that problem.
