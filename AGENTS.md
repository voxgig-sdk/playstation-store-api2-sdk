# PlaystationStoreApi2 SDK — Agent Guide

This is a **generated** multi-language SDK project. The client libraries in
each language directory are produced by [@voxgig/sdkgen](https://github.com/voxgig/sdkgen)
from an API model; the generator, model, templates, and components all live in
`.sdk/`. Treat the language directories as build output — change the model,
a template, or a component and regenerate.

There are companion guides deeper in the tree: one per language
(`<lang>/AGENTS.md`) and one per feature
(`<lang>/src/feature/<name>/AGENTS.md`).

## Project map

**Targets** (8):

| Target | Directory | Build guide |
| --- | --- | --- |
| `go` | `go/` | [`go/AGENTS.md`](./go/AGENTS.md) |
| `go-cli` | `go-cli/` — A CLI surface, not an SDK client library. | [`go-cli/AGENTS.md`](./go-cli/AGENTS.md) |
| `go-mcp` | `go-mcp/` — An MCP server surface for AI agents, not an SDK client library. | [`go-mcp/AGENTS.md`](./go-mcp/AGENTS.md) |
| `lua` | `lua/` | [`lua/AGENTS.md`](./lua/AGENTS.md) |
| `php` | `php/` | [`php/AGENTS.md`](./php/AGENTS.md) |
| `py` | `py/` | [`py/AGENTS.md`](./py/AGENTS.md) |
| `rb` | `rb/` | [`rb/AGENTS.md`](./rb/AGENTS.md) |
| `ts` | `ts/` | [`ts/AGENTS.md`](./ts/AGENTS.md) |

**Features** (4): `ratelimit`, `retry`, `test`, `timeout`.

Each feature is generated into every SDK target — as a directory
`<lang>/src/feature/<name>/` (ts/js) or a flat file in the `<lang>/feature/`
package (other languages). Each target's guide documents its features.

**Entities** (1): `Container`.

## Generating and updating the SDK

All generation is driven from the `.sdk/` directory. The generated language
directories (`ts/`, `go/`, …) are **build output** — never edit them by
hand; fix the model, a template, or a component and regenerate.

```bash
cd .sdk
npm run add-target <lang>     # scaffold a language target (ts js go py php rb lua ...)
npm run add-feature <name>    # scaffold a feature (e.g. log, test)
npm run build                 # compile .sdk/src/cmp -> .sdk/dist
npm run generate              # emit/refresh the SDK into ../<lang>
```

`generate` **merges** into existing files and does **not** re-apply
placeholder substitution to merged content. If you ever see a literal
`ProjectName` or `GOMODULE` in generated output, delete that one file and
regenerate it fresh:

```bash
rm <lang>/<the-file-with-the-placeholder>
npm run generate
```

Note: the `voxgig-sdkgen` CLI only *scaffolds* (`target add` /
`feature add`). Generation itself runs via `npm run generate` (backed by
`@voxgig/model`) — there is no `generate` CLI subcommand.

### Two silent failure modes

Generation has two ways of going wrong that **nothing reports**. Neither
breaks a build or a test, so the only symptom is a tree that disagrees with
the model — which is easy to commit past.

**`voxgig-model --no-config` writes a REDUCED model.** The
`.model-config` build is what registers the generator actions, and an SDK
project loads `apidef` and `sdkgen` through exactly that mechanism:

```
sys: model: action: { apidef: load: 'build/apidef.js', sdkgen: load: 'build/sdkgen.js' }
sys: model: order: action: 'apidef,sdkgen'
```

`--no-config` skips it, so those actions never run — and the model build
still *writes* the model file, now missing whatever they contribute (the
name case variants, and whole subtrees). A reduced model is a valid model,
so nothing downstream complains. To inspect the model layer **without side
effects**, use `npm run dry-generate` (`-y`, writes nothing). Never
`--no-config` in anything whose output might be committed.

**Regeneration never DELETES.** A file the generator has stopped emitting
stays in the tree, and `git status` is silent because it is committed and
unchanged. Narrowing a feature's plugin selection, or dropping a target, can
leave whole modules behind that nothing references and no test covers.

To find either, the target trees must be deleted and regenerated — a
regeneration in place cannot see stale output at all.
## Adding a feature

A **feature** is a pipeline extension: an object of hooks that fire at named
stages of every entity operation (each target's guide documents its
features). Built-in features are `log` and `test`.

```bash
cd .sdk
npm run add-feature <name>    # e.g. log  (comma-separated for several)
npm run build && npm run generate
```

To author a **new** feature:

1. Define its model at `.sdk/model/feature/<name>.aon` — `name: key()`,
   `title`, `version`, `active`, `config.options.active`, a `hook`
   map (`<Stage>: active: true`), and per-language `deps`.
2. Register it in `.sdk/model/feature/feature-index.aon` with
   `@"<name>.aon"`.
3. Provide the per-language runtime under that target's feature template dir
   (`.sdk/tm/<lang>/src/feature/<name>/` for ts/js, `.sdk/tm/<lang>/feature/`
   otherwise) — the `FEATURE_Name` / `FEATURE_VERSION` placeholders are
   substituted on `add-feature`.
4. `npm run add-feature <name> && npm run build && npm run generate`.
## Customising: model, templates, components

Each language target is generated from **two layers**:

| Layer | Path | Nature |
| --- | --- | --- |
| **Templates** | `.sdk/tm/<lang>/` | Plain target-language source, copied verbatim with placeholder substitution. Edit when the file is the **same for every API** (transport, base classes, runtime, utilities). |
| **Components** | `.sdk/src/cmp/<lang>/` | TypeScript that **generates** source by walking the model. Edit when the file's shape **depends on the API** (entity classes, the constructor, README, tests). |

> Decision rule: *same for every API → template; depends on the API →
> component.*

Placeholders substituted on copy: `ProjectName` (Pascal-case SDK name),
`GOMODULE` (Go module path), `FEATURE_Name` / `FEATURE_VERSION`, and the
`$$path$$` interpolation of a model value (such as the name) in `.aon`.

Propagate a change: edit the template/component → `npm run build` (only
needed if you touched a component) → `npm run generate`. Target shape and
deps live in `.sdk/model/target/<lang>.aon`; features in
`.sdk/model/feature/<name>.aon`.
## The model language (aontu, `.aon` files)

The model is one structured object assembled by **aontu** (a unification
engine) from three sources: the API model (entities/operations, from the
OpenAPI spec via `@voxgig/apidef`), the base schema, and the target/feature
definitions in `.sdk/model/`. An `.aon` file is a relaxed JSON (jsonic
syntax) with unification semantics:

| Syntax | Meaning |
| --- | --- |
| `a: b: c: 1` | Nested-object shorthand for `a:{b:{c:1}}`. |
| `&: { ... }` | Schema applied to **every** child of a map (one rule, many entries). |
| `*default \| type` | A default value unified against a type (e.g. `*true \| boolean`). |
| `name: key()` | Bind a field to its map key (so `feature: log: {}` gets `name: 'log'`). |
| `$$path$$` | Interpolate a model value into a string — e.g. the SDK `name`. |
| `@"file.aon"` | Include another fragment (how the index files work). |
| `x: .y` | Reference another path's value (e.g. `deps: ts: .js`). |

For example, the schema for every feature entry:

```aontu
main: kit: feature: &: {
  name: key()
  active: *false | boolean
  title: string
  version: *'0.0.1' | string
  hook: &: { active: *false | boolean, await: *false | boolean }
}
```

Caveat: literal disjunctions (`'prod' | 'peer' | 'dev'`) are fragile in
aontu, so the model uses `*'prod' | string` and enforces the enum in code —
do not "fix" these into literal disjunctions.
## Where things live

```
.sdk/
  model/          the model: target/, feature/, and index .aon files
  src/cmp/<lang>/  components — TypeScript that generates API-specific source
  tm/<lang>/       templates — verbatim source copied with placeholders
  dist/            compiled components (npm run build)
<lang>/           generated SDK for each target (build output)
README.md         human-facing overview
Makefile          per-target deploy recipes
```

---

Generated by [@voxgig/sdkgen](https://github.com/voxgig/sdkgen). Regenerate
with `cd .sdk && npm run generate`.
