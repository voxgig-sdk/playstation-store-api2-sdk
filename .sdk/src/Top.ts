

import {
  cmp,
  Deploy,
  PublishWorkflow,
  ReadmeTop,
  AgentGuideTop,
  License,
  Security,
  Changelog,
} from '@voxgig/sdkgen'


const Top = cmp(function Top(props: any) {
  ReadmeTop({})

  // Agent onboarding guides at the project root: AGENTS.md + a thin CLAUDE.md,
  // populated with the real target / feature / entity lists. Emitted outside
  // any target Folder (same placement rule as ReadmeTop / Deploy).
  AgentGuideTop({})

  // Root governance files for a publishable, unofficial generated SDK:
  // an MIT LICENSE (held by Voxgig), a SECURITY.md disclosure policy, and a
  // seed CHANGELOG. Emitted at repo root, before the per-target folders.
  License({})
  Security({})
  Changelog({})

  // Root deployment Makefile: per-target `make deploy-<t>` (publish with
  // credentials injected by the aql key vault) plus an all-targets
  // `make deploy-dry` rehearsal.
  Deploy({})

  // Publishing an npm target from CI with no token: a dispatch workflow per
  // npm target using GitHub OIDC trusted publishing, and the one-time
  // set-up a maintainer must do, written to `.sdk/PUBLISHING.md` — beside
  // the generator rather than into the target's own docs, which describe
  // the SDK to the people who install it.
  PublishWorkflow({})
})


export {
  Top
}

