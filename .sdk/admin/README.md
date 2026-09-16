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

When a GitHub Pages edition and its CI workflow are enabled, docgen generates
`setup-github-pages.sh` here. Preview its changes, then configure Pages:

```sh
.sdk/admin/setup-github-pages.sh --dry-run
.sdk/admin/setup-github-pages.sh
```

The setup script configures GitHub Actions as the publishing source. It does
not commit, push, merge, or deploy. Push the documentation workflow and project
changes to its configured deployment branch to publish the website.

The status launcher comes from create-sdkgen; its reporting code comes from
sdkgen. Docgen owns the generated Pages setup script. Put project-specific
administration scripts beside them with different names.
