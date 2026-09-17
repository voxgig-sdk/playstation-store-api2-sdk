# Repository administration

Run these scripts from any working directory:

```sh
.sdk/admin/status.sh
.sdk/admin/status.sh --json
.sdk/admin/status.sh --github
```

`status.sh` reads the compiled SDK model, repository state, target directories,
publication settings, tool versions, and documentation outputs. It does not run
builds or tests, contact package registries, fetch Git refs, or change files.
`--github` also reads recent workflow runs and Pages status through `gh`.
Install the `.sdk` dependencies before using it.

## Is the committed tree what the generator produces?

```sh
cd .sdk && npm run check-drift
```

`check-drift.sh` answers a question nothing else asks. Generation has two
failure modes that are **completely silent** — neither breaks a build or a
test, and the only symptom is a tree that disagrees with the model:

- **Regeneration never DELETES.** A file the generator has stopped emitting
  stays in the tree. Narrow the secrets plugin selection, drop a target,
  rename an entity, and the superseded output is still committed. One SDK
  carried seven orphaned provider clients in `scala/` and seven in `zig/`;
  the scala ones surfaced only because a test cross-checks the tree against
  the model, and zig's were caught by nothing.
- **`voxgig-model --no-config` writes a REDUCED model.** It skips the
  `.model-config` build that registers the apidef and sdkgen actions, so
  neither runs — and `model/sdk.json` is still written, now missing the name
  case variants and `main.api` / `main.custom`. Use `npm run dry-generate`
  to inspect a model without side effects, and never `--no-config` in
  anything whose output might be committed.

The script deletes every target tree, regenerates, and reports what differs —
which is the only way to see output the generator no longer emits. It refuses
to run on a dirty tree, restores the target's own build artifacts and
lockfiles (which the generator never writes), and leaves the regenerated tree
in place so the diff can be read.

It **detects**; it does not prevent. Run it before a release, or after
changing the model or the toolchain. It is deliberately not in CI: it
regenerates every target, which is minutes of work and needs the `.sdk`
dependencies installed.

When a GitHub Pages edition and its CI workflow are enabled, docgen generates
`setup-github-pages.sh` here. Preview its changes, then configure Pages:

```sh
.sdk/admin/setup-github-pages.sh --dry-run
.sdk/admin/setup-github-pages.sh
```

The setup script configures GitHub Actions as the publishing source. It does
not commit, push, merge, or deploy. Push the documentation workflow and project
changes to its configured deployment branch to publish the website.

The status launcher and the drift check come from create-sdkgen; the status
reporting code comes from sdkgen. Docgen owns the generated Pages setup
script. Put project-specific administration scripts beside them with
different names.
