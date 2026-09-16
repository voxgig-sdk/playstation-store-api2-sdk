#!/usr/bin/env bash
# Standard repository status report. Implementation is supplied by sdkgen.
set -euo pipefail
sdk_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
report="$sdk_dir/node_modules/@voxgig/sdkgen/dist/admin/status.js"
if [[ ! -f "$report" ]]; then
  echo 'Install or update the .sdk dependencies to use the status report.' >&2
  exit 1
fi
exec node "$report" "$sdk_dir/.." "$@"
