# Third-Party Notices

This project redistributes and/or depends on third-party software. Their
licenses and copyright notices are reproduced or referenced below, as required
by those licenses. Notation, schema, and documentation attributions are in
[`ATTRIBUTION.md`](ATTRIBUTION.md).

Dependencies are **not** vendored into this repository (`node_modules/` and
build output are git-ignored). What *is* redistributable here is the skill
bundle produced by `npm run skill:build`: `skills/bpmn/bin/bpmn-render.mjs`
bundles `bpmn-moddle`, `moddle`, `moddle-xml`, `bpmn-auto-layout`, `chevrotain`,
`@xmldom/xmldom` and their transitive dependencies, and ships alongside
`resvg.wasm` from `@resvg/resvg-wasm`. This file is the aggregated notice for
those components and for the toolchain that builds them.

License texts: MIT <https://opensource.org/license/mit>, Apache-2.0
<https://www.apache.org/licenses/LICENSE-2.0>, ISC
<https://opensource.org/license/isc-license-txt>, BSD-2/3-Clause
<https://opensource.org/license/bsd-3-clause>, MPL-2.0
<https://www.mozilla.org/MPL/2.0/>, Blue Oak Model License 1.0.0
<https://blueoakcouncil.org/license/1.0.0>, CC-BY-4.0
<https://creativecommons.org/licenses/by/4.0/>.

---

## 1. bpmn.io toolkit — `bpmn-js`, `diagram-js` (special obligation)

**Packages:** `bpmn-js@17.11.1`, `diagram-js@14.11.3`, and related
`@bpmn-io/*` modules.
**Copyright (c) 2014-present Camunda Services GmbH.**
**License:** the bpmn.io License (MIT-style, with an added watermark clause).

The full license text, as distributed in `bpmn-js`, is reproduced verbatim:

```
Copyright (c) 2014-present Camunda Services GmbH

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in the
Software without restriction, including without limitation the rights to use, copy,
modify, merge, publish, distribute, sublicense, and/or sell copies of the Software,
and to permit persons to whom the Software is furnished to do so, subject to the
following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

The source code responsible for displaying the bpmn.io project watermark that
links back to https://bpmn.io as part of rendered diagrams MUST NOT be
removed or changed. When this software is being used in a website or application,
the watermark must stay fully visible and not visually overlapped by other elements.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE
OR OTHER DEALINGS IN THE SOFTWARE.
```

**Compliance statement.** The default render path in this repository **does not
use `bpmn-js` at all.** `packages/bpmn-core/src/render/svg/` draws BPMN symbols
from SVG primitives against the OMG BPMN 2.0 shape vocabulary; no bpmn.io render
code, path data, or icon font is copied or redistributed, and the skill bundle
shipped in `skills/bpmn/bin/` contains none of it. The watermark clause is
therefore not triggered by the diagrams `/bpmn` produces.

`bpmn-js` remains a **development dependency** and is used in exactly two
places, neither of which ships:

1. `scripts/render-fidelity.mjs` — the opt-in fidelity renderer, which draws in
   a headless browser through `bpmn-js` and its own `saveSVG()` export. Anyone
   using that path is displaying and exporting bpmn.io's canvas and must honor
   the watermark clause when publishing the result.
2. A TypeScript `import type` of `bpmn-js/lib/Modeler` in
   `packages/bpmn-core/src/render/index.ts`, the browser entry point kept for
   callers that embed a live, editable canvas. Type-only imports are erased at
   build time and contribute no bpmn.io code to any artifact.

---

## 2. Runtime dependencies redistributed in the skill bundle

`npm run skill:build` produces `skills/bpmn/bin/bpmn-render.mjs` and
`skills/bpmn/bin/resvg.wasm`. Those two files are the only redistributable
artifacts this repository produces, and between them they contain exactly the
packages listed below (verified against the esbuild metafile, not assumed).

### MIT License

| Package | Version | Copyright |
|---|---|---|
| `bpmn-moddle`, `moddle`, `moddle-xml` | 8.1.0 / 6.2.3 / 10.1.0 | © 2014-present Camunda Services GmbH |
| `bpmn-auto-layout` | 0.5.0 | © bpmn.io / Camunda Services GmbH |
| `min-dash` | 4.2.3 | © bpmn.io / Camunda Services GmbH |
| `saxen` | 8.1.2 | © Nico Rehwaldt |
| `@xmldom/xmldom` | 0.9.12 | © 2019-present xmldom contributors; © 2012 jindw |

### Apache License 2.0

| Package | Version | Copyright |
|---|---|---|
| `chevrotain`, `@chevrotain/cst-dts-gen`, `@chevrotain/gast`, `@chevrotain/regexp-to-ast`, `@chevrotain/utils` | 12.0.0 | © Chevrotain contributors (Shahar Soel and contributors) |

> Apache-2.0 requires preserving the license and any `NOTICE` file. None of the
> Apache-2.0 packages above ships a `NOTICE` file, so there is no NOTICE content
> to propagate beyond this attribution.

### Mozilla Public License 2.0 (special obligation)

| Package | Version | Copyright |
|---|---|---|
| `@resvg/resvg-wasm` | 2.6.2 | © yisibl and contributors; wraps `resvg` © the resvg authors |

**Compliance statement.** `resvg.wasm` is redistributed **verbatim and
unmodified** inside `skills/bpmn/bin/`. MPL-2.0 is file-level copyleft: it
attaches to the covered files themselves, not to the code that calls them, so
bundling it next to MIT-licensed work does not relicense that work. The
obligations that do apply when shipping it in executable form are met as
follows:

- Recipients are informed that `resvg.wasm` is MPL-2.0 by this notice.
- The corresponding source is available under the same license at
  <https://github.com/thx/resvg-js> (WASM wrapper) and
  <https://github.com/linebender/resvg> (the renderer itself), and via the npm
  package `@resvg/resvg-wasm`.
- No modifications were made, so there is no modified source to publish.

Anyone redistributing the skill folder must carry this section with it.

---

## 3. Build / development tooling (npm, not shipped to end users)

Used to build, type-check, bundle and test this repository. None of these ship
inside the skill bundle; they are listed for completeness and because a few
carry attribution terms.

| Package | License | Note |
|---|---|---|
| `typescript` | Apache-2.0 | Type-checking only. |
| `playwright`, `playwright-core` | Apache-2.0 | Ship a `NOTICE` (© Microsoft Corp.). Used **only** by the opt-in `scripts/render-fidelity.mjs`; not required to build or run the skill. |
| `bpmn-js`, `diagram-js` | bpmn.io License | See §1. Development only. |
| `esbuild`, `vitest`, `tsx`, and their transitive dependencies | MIT / ISC / BSD (various) | Standard permissive toolchain. |
| `lightningcss` and its platform binary | **MPL-2.0** | Weak (file-level) copyleft, pulled in transitively by vitest's toolchain. Used unmodified as a build tool and never redistributed, so no source-disclosure obligation is triggered. Source: <https://github.com/parcel-bundler/lightningcss>. |

---

## 4. Specifications & notation

- **BPMN 2.0 (OMG)** — the specification this engine emits. The XSD schemas are
  no longer bundled in this repository; see [`ATTRIBUTION.md`](ATTRIBUTION.md).
- **BPMN Sketch Miner notation** — see [`ATTRIBUTION.md`](ATTRIBUTION.md).
