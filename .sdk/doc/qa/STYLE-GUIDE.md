# Documentation style guide

This guide applies to every docgen edition: the API summary, the
presentation, and the documentation website. It also applies to authored
pages and customised templates. It adapts the [aontu style guide](https://github.com/aontu-lang/aontu/blob/main/docs/STYLE-GUIDE.md)
for API and SDK documentation with a neutral voice.

The order of precedence is this guide, the Google developer documentation
style guide, and Vale defaults. The rules ship with docgen under `qa/`.

## Voice

State what the API or SDK does, what input it accepts, and what result it
returns. Use second person when giving instructions and neutral prose in
reference material. Do not use first-person singular or plural, jokes,
marketing claims, invented observations, or exaggerated comparisons.

Use present tense, active verbs, and familiar words. Explain a technical
term when a reader first needs it. Introduce a code block with a short
sentence ending in a colon. Explain a result after the block when that
explanation adds information. Do not repeat the code in prose.

State limits and prerequisites beside the operation they qualify. Describe
errors by their observable result and the action the reader can take.
Finish a guide with a next step or a reference link.

## Structure

The summary gives a few pages of orientation to the API, SDKs, and additional
tools. Explain capabilities, connection and authentication, a first request,
SDK choice, and operational features, with links to the detailed reference.
The presentation moves from API purpose to capabilities, authentication,
client setup, available SDKs, and next steps.

The website separates tutorials, how-to guides, reference pages, and
explanations. A tutorial teaches through a small task. A how-to guide gives
the steps for a specific result. A reference defines inputs, behaviour,
outputs, and errors. An explanation describes a design choice and its
consequences. Additional authored Markdown belongs in the configured
content directory, outside the generated website directory.

## Punctuation and spelling

Use sentence case in headings, serial commas, and British spelling.
Preserve product names, API identifiers, and language-specific spelling.
Use a comma, colon, parentheses, or a new sentence instead of an em dash.
Do not use emoji or exclamation marks. Prefer `for example` and `that is`
to Latin abbreviations.

Docgen normalises Latin abbreviations and em dashes in model-derived prose.
It preserves literal code and schemas. Authored pages and custom templates
are checked as written.

## Word choice

The banned-phrase list is
`qa/styles/config/vocabularies/Docgen/reject.txt`. It is adapted from
aontu's vocabulary. Vale and the local gate read this one list. Do not
keep a second list in code or introduce inline exemptions. Changes to a
rule belong in a reviewed change to the rule file.

Use literal terms for API operations, types, SDK packages, and MCP tools.
Distinguish an API entity from an instance returned by an SDK. Distinguish
a package name from an import name. Describe an unpublished SDK as
unpublished; do not present a registry installation command for it.

## Examples

Examples use the existing apidef/sdkgen model. Do not read the OpenAPI
source again or invent endpoints, request fields, responses, or tool names.
Show required parameters. Label setup fragments as fragments; a fragment
that constructs a client does not demonstrate a successful API request.

Never include credentials. Use environment variables or an explicit
placeholder. State whether a check executes a request, compiles an example,
or only validates its syntax. Do not describe an example as executed unless
a test executes it. Put project-specific examples in
`main.kit.doc.target.<name>.example`.

## Text QA and CI

Generation records the actual Markdown and HTML output in
`.sdk/doc/qa-manifest.json`. All active editions are included automatically,
including custom component output and authored website pages. The local
gate and Vale use this same manifest and extract the same prose. Code,
scripts, and styles are excluded from prose checks.

The local gate checks banned phrases across line wraps, first person,
punctuation, emoji, and repeated words within a line. Vale checks spelling,
word choice, and the pinned Google rules. Errors fail CI; warnings and
suggestions provide additional feedback. Vale is required in CI. The
`--local-only` option is for a quick local check and is never used by the
workflow.

The binary is pinned to Vale 3.14.0 and the Google package to 0.7.1. Rule
levels and their reasons are recorded in `qa/vale.ini`. Names derived from
the model are accepted without imposing a different capitalisation. Add
other domain words through `main.kit.doc.qa.vocabulary`; entries must be
literal words or phrases, rather than broad regular expressions.

Generated Pages sites use local styles, scripts, and assets. Slidev disables
remote font providers. Fonts supplied by a project must be local WOFF or
WOFF2 files. Check links and asset paths when adding an authored page.
