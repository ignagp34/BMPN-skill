# Attribution & Provenance

This file credits third-party notation, schemas, and documentation reproduced in
or relied upon by this repository. Software dependencies and their licenses are
listed separately in [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md).

---

## BPMN Sketch Miner notation (textual DSL)

The textual domain-specific language used by this project — the trace-based
syntax in which a process is written as repeated, merge-by-label execution
traces (`( )` events, `[ ]` data objects, `|` parallel, `?` gateway questions,
`...` fragments, `//` annotations, pool/lane `:` annotations, etc.) — is the
**BPMN Sketch Miner** notation.

> **BPMN Sketch Miner**
> Ana Ivanchikj, Souhaila Serbout, and Cesare Pautasso
> Software Institute (USI), Università della Svizzera italiana, Lugano, Switzerland
> <https://www.bpmn-sketch-miner.ai/>

The system prompt shipped with the skill
(`skills/bpmn/references/system-prompt-v5.md`) describes and gives examples of
this notation, with syntax rules compiled from the official BPMN Sketch Miner
documentation.

The notation, its syntax, and its authoring methodology are credited to the
authors above and are **not** the original work of this project. This project is
not affiliated with, sponsored by, or endorsed by the BPMN Sketch Miner authors
or USI.

### What in this project *is* original work

The following are independent, original work authored for this repository and
are **not** part of, derived from, or copied out of the BPMN Sketch Miner tool
or its source code:

- **`@text-to-bpmn/core`** — the DSL lexer/parser (built on Chevrotain), the
  semantic model, the BPMN 2.0 XML emitter, the orthogonal layout/edge-routing,
  and the validator.
- **The headless SVG renderer** (`packages/bpmn-core/src/render/svg/`) — every
  BPMN glyph is drawn from SVG primitives against the OMG BPMN 2.0 shape
  vocabulary. No render code, path data, or icon font from `bpmn-js` or any
  other modeller is copied or derived.
- **`@text-to-bpmn/cli`** and the `/bpmn` skill — the command line, the
  packaging, and the agent workflow.

In other words: the **notation** (how a user writes the text) is BPMN Sketch
Miner's; the **engine** that parses that text and produces/renders/evaluates
BPMN 2.0 is this project's own implementation.

---

## BPMN 2.0 XML schemas (OMG)

This project emits and validates against the **Business Process Model and
Notation (BPMN) 2.0** specification, published by the **Object Management Group
(OMG)**.

> Business Process Model and Notation (BPMN), Version 2.0
> Copyright © Object Management Group, Inc. (OMG)
> <https://www.omg.org/spec/BPMN/2.0/>

"BPMN", "Business Process Model and Notation", and "OMG" are trademarks of the
Object Management Group, Inc. The OMG XSD schema files are **not** redistributed
in this repository; they lived in the research monorepo's evaluation harness and
were left there. The element shapes drawn by the renderer follow the notation
described in the specification, which is a specification of a notation, not
copyrightable software.

---

## bpmn.io toolkit watermark

The diagrams `/bpmn` produces are drawn by this project's own renderer, so the
bpmn.io watermark clause does not apply to them.

`bpmn-js` (and `diagram-js`) by bpmn.io / Camunda Services GmbH is still used by
the opt-in fidelity renderer (`scripts/render-fidelity.mjs`), which draws in a
headless browser and exports through bpmn-js's own `saveSVG()`. Output from
*that* path is a bpmn.io render: the bpmn.io License requires the watermark
linking to <https://bpmn.io> to stay fully visible and unobstructed. See the
bpmn.io entry in [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md).

---

## Fonts

No font is redistributed in this repository or in the skill bundle. The SVG
output asks for `Arial, Helvetica, sans-serif` and leaves the choice to the
viewer. PNG rasterization borrows a sans-serif face already installed on the
host (Arial, Segoe UI, Liberation Sans or DejaVu Sans, whichever is found
first); if none is available the PNG is skipped rather than rendered with
missing text.

---

## Third-party trademarks

Trademarks referenced in this repository are the property of their respective
owners and are used for nominative/descriptive (interoperability and
identification) purposes only. This includes, without limitation: BPMN, BPMN
Sketch Miner, Camunda, Signavio, Bizagi, OpenAI / ChatGPT / GPT, Anthropic /
Claude, and Google / Gemini. No affiliation or endorsement is implied.
