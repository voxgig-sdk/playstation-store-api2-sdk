
import {
  Content,
  File,
  cmp,
  collectDeps,
  pkgDescription,
  repoInfo, packageName,
  packageVersion,
  authorInfo,
} from '@voxgig/sdkgen'


import type {
  Model,
} from '@voxgig/apidef'


const Package = cmp(async function Package(props: any) {
  const ctx$ = props.ctx$
  const target = props.target

  const model: Model = ctx$.model

  // WHO WROTE THIS PACKAGE. Per target, falling back to the model-wide value
  // and then to the publisher — so a manifest cannot go on naming Voxgig
  // while the model names someone else, which is exactly what the hardcoded
  // constant here did.
  const author = authorInfo(model, target.name)

  const gemName = packageName(model, target.name)
  const { repoUrl, issuesUrl, changelogUrl } = repoInfo(model)

  File({ name: model.const.Name + '_sdk.gemspec' }, () => {
    // `gem build` rejects a duplicate runtime dependency, so the json
    // fallback is emitted only when the model does not declare json.
    const deps = collectDeps(model, target.name, target.deps, ctx$.log)
    const hasJson = deps.some((d: any) => 'json' === d.name)

    Content(`Gem::Specification.new do |spec|
  spec.name          = "${gemName}"
  spec.version       = "${packageVersion(model, target.name)}"
  spec.authors       = ["${author.name}"]
  spec.summary       = "${pkgDescription(model, target.name)}"
  spec.description   = "${pkgDescription(model, target.name)}"
  spec.license       = "MIT"
  spec.homepage      = "${repoUrl}"
  spec.metadata      = {
    "homepage_uri"          => "${repoUrl}",
    "source_code_uri"       => "${repoUrl}",
    "bug_tracker_uri"       => "${issuesUrl}",
    "changelog_uri"         => "${changelogUrl}",
    "rubygems_mfa_required" => "true"
  }

  spec.files         = Dir[
    "*.rb",
    "core/**/*.rb",
    "entity/**/*.rb",
    "feature/**/*.rb",
    "utility/**/*.rb",
    "LICENSE",
    "README.md",
    "REFERENCE.md"
  ]
  spec.require_paths = ["."]

  spec.required_ruby_version = ">= 3.0"
${hasJson ? '' : `
  spec.add_dependency "json"
`}`)

    for (const d of deps) {
      const req = gemRequirement(d.version)
      Content(`  spec.add_dependency "${d.name}"${null == req ? '' : `, "${req}"`}
`)
    }

    Content(`
  spec.add_development_dependency "minitest", "~> 5.0"
  spec.add_development_dependency "rake", "~> 13.0"
end
`)
  })
})


// `~> 0` admits only 0.x releases, so an absent, `*` or all-zero version is
// no constraint at all.
function gemRequirement(version?: string): string | null {
  const v = String(version ?? '').trim()
  if ('' === v || '*' === v || /^0(\.0)*$/.test(v)) {
    return null
  }
  return /^(>=|<=|~>|!=|=|>|<)/.test(v) ? v : '~> ' + v
}


export {
  Package
}
