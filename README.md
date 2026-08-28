# BPMN skill

Type `/bpmn` and get a BPMN 2.0 diagram of whatever you are looking at — a
process described in prose, a document, a code repository, an endpoint's
execution flow, a CI pipeline. SVG, PNG and an editable `.bpmn`, generated
locally.

This is the engine from the *text-to-BPMN* TFM, repackaged as a
[Claude Code skill](https://docs.claude.com/en/docs/claude-code/skills). The
research monorepo it came from lives at
[BPMN-DSL-Monorepo](https://github.com/ignagp34/BPMN-DSL-Monorepo).

## How it works

```
request ──▶ subagent ──▶ Sketch Miner DSL ──▶ bpmn-render (offline)
            reads the                          parse → BPMN 2.0 XML → layout
            17k-token DSL spec                 → SVG → PNG → validate
            + the source material                       │
                                                        ▼
                                        bpmn-out/<name>/<name>.{svg,png,bpmn,dsl}
```

The split matters: **the model is written by an LLM, the diagram is not.** Once
the DSL exists, every coordinate, every edge route and every glyph is computed
by deterministic code. The same DSL always produces the same diagram.

Nothing in the render path touches the network, and nothing needs a browser.

## Layout

```
packages/
  bpmn-core/     @text-to-bpmn/core — DSL parser, BPMN emitter, layout pipeline,
                 headless SVG renderer, WASM rasterizer, validator
  bpmn-cli/      bpmn-render — the command line the skill invokes
skills/
  bpmn/          the installable skill: SKILL.md + DSL spec + bundled binary
prompts/
  processes/     the 15 synthetic reference processes, kept as evaluation fixtures
examples/        a worked example: DSL in, SVG out
scripts/         build, install, optional fidelity renderer
```

## Install

```bash
npm install && npm run skill:build && npm run skill:install
```

`skill:build` bundles the engine into `skills/bpmn/bin/bpmn-render.mjs` (~1 MB)
plus `resvg.wasm` (~2.4 MB). `skill:install` copies `skills/bpmn/` to
`~/.claude/skills/bpmn`. Start a new Claude Code session and `/bpmn` is there.

The installed skill needs **Node ≥ 20 and nothing else** — no `node_modules`, no
Chromium, no network.

## Using the CLI directly

```bash
node skills/bpmn/bin/bpmn-render.mjs --dsl process.dsl --out bpmn-out --name onboarding
```

```
--dsl <path>       Sketch Miner DSL. "-" reads stdin.
--bpmn <path>      Render an existing BPMN 2.0 file instead.
--out <dir>        Output root. Default: bpmn-out
--name <slug>      Base name for the folder and files.
--formats <list>   Any of svg,png,bpmn,dsl. Default: all.
--theme dark       Dark palette.
--png-width <px>   PNG raster width.
--padding <px>     Whitespace around the diagram. Default: 20.
```

It always prints one JSON object on stdout — output paths, parse errors and the
validation report — so an agent can decide whether to retry.

## Example

[`examples/skill-flow.dsl`](examples/skill-flow.dsl) models the skill's own
execution, retry loop included, and [`examples/skill-flow.svg`](examples/skill-flow.svg)
is what the renderer makes of it:

```bash
node skills/bpmn/bin/bpmn-render.mjs --dsl examples/skill-flow.dsl --name skill-flow
```

## Rendering, without a browser

The original app rendered through bpmn-js on a live canvas, which meant a
browser. Here the pipeline splits at the point where it stops needing one:

- **Layout** (`bpmn-auto-layout` → pool/lane placement → orthogonal routing →
  edge channels → label and artifact placement) was already pure Node. It runs
  unchanged and produces BPMN XML with complete diagram interchange.
- **Rendering** is new: `render/svg/` draws that DI directly to SVG. Text is
  measured against Helvetica advance widths, so labels wrap and centre without a
  canvas to measure with.
- **Rasterizing** uses `@resvg/resvg-wasm` — WebAssembly, so it bundles as a
  single file and needs no per-platform binary. It borrows a sans-serif face
  from the host; if it finds none, the PNG is skipped and the SVG stands alone.

Because every glyph is drawn from BPMN primitives rather than reused from
bpmn-js, the output carries no third-party render code and no bpmn.io watermark
obligation. See [`ATTRIBUTION.md`](ATTRIBUTION.md).

Typical end-to-end cost for a 30-node diagram: **under 300 ms**.

### Fidelity mode (optional)

When you need output pixel-identical to bpmn.io's canvas — to match figures from
the original TFM applications, say — there is a second renderer that draws with
bpmn-js in headless Chromium:

```bash
npx playwright install chromium
npm run render:fidelity -- --dsl process.dsl --out bpmn-out --name onboarding
```

It is deliberately kept out of the skill: it needs Playwright and a ~115 MB
browser download, which is precisely the weight the skill exists to avoid. Its
output *is* a bpmn.io render, so the watermark clause applies to it — see
[`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md) §1.

## Known issues

- `tests/render/orthogonal.test.ts` has one failing assertion
  (`canon-1 enters Input customer order from the top`). It fails identically in
  the upstream monorepo at the same dependency versions — it predates this
  repackaging and is not caused by it.
- `LAYOUT_UNREADABLE_LABEL` fires for almost every named event, because the
  heuristic compares the label against the event's 36 px circle while the label
  is actually placed outside it. Noise, not a defect in the diagram.

## Pending

Distil the v5 system prompt (~17k tokens) to roughly 4–5k without losing
quality, verified against the 15 processes in `prompts/processes/` rather than
by eye. Reference numbers to beat, from the TFM evaluation of 445 runs:
`scored_mean` 0.826, label completeness 0.933, feature coverage 0.892.

## License & attribution

- Original code: **MIT** — see [`LICENSE`](LICENSE).
- Third-party software and licenses: [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md).
  Note that `skills/bpmn/bin/resvg.wasm` is **MPL-2.0**; redistributing the skill
  folder means carrying that notice with it.
- The textual DSL is the **BPMN Sketch Miner** notation (Ivanchikj, Serbout &
  Pautasso, USI); the parser, engine and renderer here are original work.
  Notation, OMG BPMN 2.0 schema and trademark attributions are in
  [`ATTRIBUTION.md`](ATTRIBUTION.md).
