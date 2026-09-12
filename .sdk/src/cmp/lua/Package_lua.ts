
import {
  Content,
  File,
  cmp,
  collectDeps,
  each,
  pkgDescription,
  keywords,
  repoInfo, packageName,
  packageVersion,
  targetFeatures,
} from '@voxgig/sdkgen'


import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'

import type {
  Model,
} from '@voxgig/apidef'


// The vendored modules the secrets feature needs whatever its chain names
// (ts/vendor/routes.json `sekreto/lua` and `plugin/lua`, minus the plugin
// KINDS, which are listed per active group from the model). Held to the
// vendored tree by ts/test/generate.test.ts's lua secrets case.
const SECRETS_CORE_MODULES = [
  'feature/secrets/sekreto',
  'feature/secrets/sekreto/addr',
  'feature/secrets/sekreto/err',
  'feature/secrets/sekreto/name',
  'feature/secrets/sekreto/providers',
  // The shared plugin helpers, in no group: httpjson (eight kinds), net
  // (httpjson, boru, secretspec), json and support (every kind), crypto
  // (aws AND gcpsecrets - two groups, so neither may own it).
  'feature/secrets/sekreto/plugins/crypto',
  'feature/secrets/sekreto/plugins/httpjson',
  'feature/secrets/sekreto/plugins/json',
  'feature/secrets/sekreto/plugins/net',
  'feature/secrets/sekreto/plugins/support',
  'feature/secrets/plugin',
  'feature/secrets/plugin/capability',
  'feature/secrets/plugin/catalog',
  'feature/secrets/plugin/config',
  'feature/secrets/plugin/depend',
  'feature/secrets/plugin/env',
  'feature/secrets/plugin/export',
  'feature/secrets/plugin/graph',
  'feature/secrets/plugin/host',
  'feature/secrets/plugin/json',
  'feature/secrets/plugin/order',
  'feature/secrets/plugin/point',
  'feature/secrets/plugin/ref',
  'feature/secrets/plugin/resolve',
  'feature/secrets/plugin/types',
  'feature/secrets/plugin/version',
]


const Package = cmp(async function Package(props: any) {
  const ctx$ = props.ctx$
  const target = props.target

  const model: Model = ctx$.model

  // Rock name is namespaced to model.origin (e.g. "voxgig-sdk"). LuaRocks has
  // no real namespaces, so the parts are hyphen-joined. The Lua module name
  // (`${model.name}_sdk`) used by `require` is unchanged.
  const ns = model.origin || 'voxgig-sdk'
  const pkgBase = ns.endsWith('-sdk') ? model.name : `${model.name}-sdk`
  const rockName = packageName(model, target.name)
  const { repoUrl, issuesUrl } = repoInfo(model)
  const labels = keywords(model).map((k) => `"${k}"`).join(', ')

  // Single source for the version so the rockspec version and the source.tag
  // (which `make publish` pushes as lua/v<rockVersion>) can never drift apart.
  const rockVersion = packageVersion(model, target.name)

  File({ name: model.name + '.rockspec' }, () => {
    Content(`package = "${rockName}"
version = "${rockVersion}-1"
source = {
  -- git+https (GitHub dropped git:// in 2022); pin the install to the release
  -- tag pushed by \`make publish\`, and point at the lua/ subdir of the monorepo.
  url = "git+https://github.com/${ns}/${model.name}-sdk.git",
  tag = "lua/v${rockVersion}",
  dir = "${model.name}-sdk/lua"
}
description = {
  summary = "${pkgDescription(model, target.name)}",
  homepage = "${repoUrl}",
  issues_url = "${issuesUrl}",
  license = "MIT",
  labels = { ${labels} }
}
dependencies = {
  "lua >= 5.3",
  "dkjson >= 2.5",
`)

    const seen = new Set<string>(['lua', 'dkjson'])
    for (const d of collectDeps(model, target.name, target.deps, ctx$.log)) {
      if (seen.has(d.name)) continue
      seen.add(d.name)
      const v = d.source === 'target' ? (d.version || '0.0') : d.version
      Content(`  "${d.name} >= ${v}",
`)
    }

    // Feature modules must be listed too, or an install-from-rock ships a
    // features.lua whose requires cannot resolve. Emitted from the model
    // (each = sorted order, byte-stable), plus the base feature every
    // factory falls back to. The station feature additionally carries the
    // VENDORED voxgig_station library beside its adapter (no voxgig-station
    // rock exists to depend on - station design 9.2's registry-less tier).
    // Gated: a feature that does not apply to lua must not be listed
    // as a rockspec module — the require would not resolve.
    //
    // The secrets feature carries the VENDORED sekreto core, the
    // voxgig/plugin runtime and the shared plugin helpers (no sekreto or
    // plugin rock exists to depend on); the plugin KINDS themselves are
    // listed from the model's active `def.lua` entries, so a trimmed
    // group's modules are not claimed. The compiled transport helper the
    // plugin kinds run is NOT a rock module: `build.type = "builtin"`
    // cannot produce an executable, so an install-from-rock carries the
    // helper's source and `make build` compiles it where the SDK runs.
    const feature = targetFeatures(model, target)
    let featureModules = `    ["feature.base_feature"] = "feature/base_feature.lua",\n`
    each(feature, (f: any) => {
      featureModules +=
        `    ["feature.${f.name}_feature"] = "feature/${f.name}_feature.lua",\n`
      if ('station' === f.name) {
        featureModules +=
          `    ["feature.station.voxgig_station"] = "feature/station/voxgig_station.lua",\n`
      }
      if ('secrets' === f.name) {
        const mods = [...SECRETS_CORE_MODULES]
        each(f.plugin, (plugin: any) => {
          if (false === plugin.active || null == plugin.active) return
          for (const one of Object.values(plugin.def?.lua || {})) {
            mods.push(String(one).replace(/\.lua$/, ''))
          }
        })
        for (const mod of Array.from(new Set(mods)).sort()) {
          featureModules +=
            `    ["${mod.replace(/\//g, '.')}"] = "${mod}.lua",\n`
        }
      }
    })

    Content(`}
build = {
  type = "builtin",
  modules = {
    ["${model.name}_sdk"] = "${model.name}_sdk.lua",
    ["config"] = "config.lua",
    ["config_shared"] = "config_shared.lua",
    ["config_plugins"] = "config_plugins.lua",
    ["features"] = "features.lua",
${featureModules}  }
}
`)
  })
})


export {
  Package
}
