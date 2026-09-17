#!/usr/bin/env bash
# Is the committed tree what the generator actually produces?
#
# BOTH FAILURE MODES THIS CATCHES ARE SILENT. Nothing breaks when generated
# output drifts from the model, so nothing reports it:
#
#   - STALE OUTPUT. Regeneration never DELETES a file it has stopped
#     emitting. Narrow the model's secrets plugin selection, drop a target,
#     rename an entity - the superseded files stay in the tree. Seen in one
#     SDK as seven orphaned provider clients in scala and seven in zig: the
#     scala ones surfaced only because one test cross-checks the tree
#     against the model, and zig's were caught by nothing at all.
#
#   - MODEL DRIFT. The committed .sdk/model/sdk.json can go round a loop,
#     gaining and losing the name case variants and main.api / main.custom
#     depending on which command last wrote it. `voxgig-model --no-config`
#     writes a REDUCED model - it skips the .model-config build that
#     registers the apidef and sdkgen actions, so neither runs, and sdk.json
#     is still written without what they contribute. The only symptom is a
#     dirty tree after regenerating, which is easy to commit past. To
#     inspect a model with no side effects: `npm run dry-generate`.
#
# THE TARGET TREES ARE DELETED FIRST, and that is the whole point. A plain
# regeneration cannot find stale output: the file is committed, generation
# leaves it alone, and `git status` is silent. Only forcing the generator to
# reproduce the tree from nothing shows what it no longer emits.
#
# This DETECTS, it does not prevent. Run it before a release, or after
# changing the model or the toolchain.
#
# Not wired into CI on purpose: it regenerates every target, which is
# minutes of work and needs the .sdk dependencies installed - too heavy for
# a per-push job, and it would only tell CI what one command finds here.
set -euo pipefail

sdk_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
root="$(cd -- "$sdk_dir/.." && pwd)"
cd "$root"

# What each target's OWN toolchain produces - a TypeScript build, a
# resolved lockfile - which the generator does not emit and must not be
# reported as stale. Everything else under a target directory is generated.
keep='(^|/)(dist|dist-test|node_modules)/|(^|/)(package-lock\.json|composer\.lock|go\.sum|Cargo\.lock|yarn\.lock)$'

# A dirty tree makes the answer meaningless - every uncommitted edit would
# read as drift - and this deletes directories, so it must not run over
# work that is not in git.
if [[ -n "$(git status --porcelain)" ]]; then
  echo 'check-drift: the working tree has uncommitted changes.' >&2
  echo 'Commit or stash them first: this deletes and regenerates every' >&2
  echo 'target, and uncommitted work would be lost and read as drift.' >&2
  exit 2
fi

targets="$(node -e '
  const m = require("./.sdk/model/sdk.json")
  const t = (m.main && m.main.kit && m.main.kit.target) || {}
  console.log(Object.keys(t).sort().join("\n"))
')"

echo 'check-drift: deleting and regenerating every target ...'
while IFS= read -r t; do
  [[ -n "$t" && -d "$t" ]] && rm -rf -- "$t"
done <<< "$targets"

log="$(mktemp)"
trap 'rm -f "$log"' EXIT
if ! ( cd "$sdk_dir" && npm run generate ) >"$log" 2>&1; then
  echo 'check-drift: generation FAILED. Restoring the tree.' >&2
  cat "$log" >&2
  git checkout -- . || true
  exit 2
fi

# Put back what the generator was never going to write.
git status --porcelain | awk '"D" == $1 { print $2 }' | grep -E "$keep" \
  | while IFS= read -r f; do git checkout -- "$f"; done || true

drift="$(git status --porcelain)"

if [[ -z "$drift" ]]; then
  echo 'check-drift: clean. The committed tree is what the generator produces.'
  exit 0
fi

echo >&2
echo 'check-drift: DRIFT. These differ from what the generator produces:' >&2
echo >&2
echo "$drift" >&2
echo >&2
echo 'D  output the generator no longer emits - delete it.' >&2
echo 'M  output that changed - commit it.' >&2
echo '?? output not committed - commit it.' >&2
echo >&2
echo 'The regenerated tree is left in place so the diff can be read.' >&2
echo 'Restore with: git checkout -- .' >&2
exit 1
