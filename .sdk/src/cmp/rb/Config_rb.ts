
import * as Path from 'node:path'


import {
  Content,
  File,
  Fragment,
  Line,
  cmp,
  configDefinition,
  configReprSetting,
  each,
  isAuthActive,
  isConfigData,
  rawStringLiteral,
  resolveAuthPrefix,
  serverVariables,
  targetFeatures,
} from '@voxgig/sdkgen'


import {
  KIT,
  Model,
  getModelPath,
  nom,
} from '@voxgig/apidef'


import {
  formatRubyHash,
} from './utility_rb'


// PLUGIN DEFINITION REQUIRES AND THE FEATURE_PLUGINS MAP (the ruby peer of
// cmp/py/Config_py.ts's pluginImports/pluginDefs).
//
// Upstream sekreto replaced its self-registration registry with
// voxgig/plugin definitions: a provider kind the caller did not pass in via
// `plugins: [...]` is unknown to that Sekreto. So config requires each
// active plugin's module and names its exported definition CONSTANT (the
// model's `def.rb` map), handing the list to the feature through
// FEATURE_PLUGINS.
//
// The `def` map is declared in the model rather than derived from filenames
// because one module may export several definitions (sekreto's aws.rb
// exports AWSSECRETS and AWSPARAMS) - hence the de-duplication by path, so
// a two-definition module yields ONE require. A def value is the module's
// path under tm/rb, which is this target's root, so the require_relative is
// that path without its extension.
//
// GATED, unlike go and py: the whole block is emitted only when an active
// feature DECLARES a plugin catalogue for this target. An SDK that does not
// carry the secrets feature must be byte-identical to what it was before
// the feature existed, and an unread constant is not a thing a simple SDK
// should have to explain.
function rbPlugins(model: any, feature: any) {
  // path -> [constant, ...], so one require serves a two-definition module.
  const bypath: Record<string, string[]> = {}
  const defs: Record<string, string[]> = {}
  let declared = false

  each(feature, (f: any) => {
    // `only_active: false`, and this is the whole subtlety: the feature
    // object a component is handed has ALREADY been filtered, so asking it
    // whether a catalogue EXISTS answers no as soon as every group is off.
    // (Same trap helpers/featureSource documents one level down.)
    const all = getModelPath(model, `main.${KIT}.feature.${f.name}.plugin`,
      { required: false, only_active: false }) || {}

    if (0 < Object.keys(all).length) {
      declared = true
    }

    const syms: string[] = []

    each(f.plugin, (plugin: any) => {
      // Filter on `active` HERE rather than trusting the feature object to
      // arrive filtered: getting it wrong in this direction emits a require
      // for a module the plugin trim just deleted - an SDK that does not
      // load, rather than one that merely carries too much.
      if (false === plugin.active || null == plugin.active) return

      for (const [sym, one] of Object.entries(plugin.def?.rb || {})) {
        const path = String(one)
        ; (bypath[path] = bypath[path] || []).push(sym)
        syms.push(sym)
      }
    })

    if (0 < syms.length) {
      defs[f.name] = syms.sort()
    }
  })

  const requires = Object.keys(bypath).sort().map(
    (path: string) => `require_relative '${path.replace(/\.rb$/, '')}'`)

  return { requires, defs, declared }
}


const Config = cmp(async function Config(props: any) {
  const ctx$ = props.ctx$
  const target = props.target

  const model: Model = ctx$.model

  const entity = getModelPath(model, `main.${KIT}.entity`)
  // Gated by the applicability tags, so this target never imports or
  // registers a feature it has no source for. One rule, one place:
  // helpers/applicability.
  const feature = targetFeatures(model, target)

  const headers = getModelPath(model, `main.${KIT}.config.headers`) || {}

  const authActive = isAuthActive(model)
  // config.auth.prefix override -> spec-derived info.security.prefix -> 'Bearer'
  const authPrefix = resolveAuthPrefix(model)

  let baseUrl = ''
  try { baseUrl = getModelPath(model, `main.${KIT}.info.servers.0.url`) } catch (_e) { }

  // Templated server URL: emit the spec's server-variable defaults so the
  // runtime can substitute {name} placeholders in base (see make_options).
  // `#` is escaped so a default can never open a Ruby interpolation.
  const svars = serverVariables(model)
  const rbs = (s: string) => JSON.stringify(s).replace(/#/g, '\\#')
  const serverBlock = 0 === svars.length ? '' :
    '        "server" => {\n' +
    svars.map((v: any) => `          ${rbs(v.name)} => ${rbs(v.dflt)},\n`).join('') +
    '        },\n'

  const authBlock = authActive
    ? `        "auth" => {
          "prefix" => "${authPrefix}",
        },\n`
    : ''

  // The same config as an OBJECT, built by the shared helper so this target's
  // literal and the data that replaces it above the threshold are the same
  // config by construction. The JSON is what the threshold is measured on -
  // emitted source size varies by language, the model does not.
  // Passing the target name opts in to the main slug/version/target identity
  // fields (station descriptor inputs) - the literal path below emits them
  // too, keeping data and literal reps in step.
  const { def: configDef, json: configJson } = configDefinition(model, target.name)
  const asData = isConfigData(configJson, configReprSetting(model))

  const { requires, defs, declared } = rbPlugins(model, feature)

  const pluginRequireBlock = 0 === requires.length ? '' :
    '\n' + requires.join('\n') + '\n'

  // Emitted whenever a catalogue is declared, even with every group off:
  // the feature module reads the map unconditionally, and an SDK whose
  // chain is all built-ins still has to answer with an empty list.
  const featurePluginsBlock = !declared ? '' :
    `  # The sekreto plugin DEFINITIONS the model selected per feature,
  # required above from the modules the catalogue's active \`plugin.def\`
  # entries declare. Handed to each feature (secrets builds its Sekreto
  # with them): a provider kind not listed here is unknown to this SDK.
  FEATURE_PLUGINS = {
` +
    Object.keys(defs).sort().map((fname: string) =>
      `    "${fname}" => [${defs[fname].join(', ')}],\n`).join('') +
    `  }.freeze


`

  File({ name: 'config.' + target.ext }, () => {

    Content(`# ${model.const.Name} SDK configuration
${asData ? "\nrequire 'json'\n" : ''}${pluginRequireBlock}
module ${model.const.Name}Config
${featurePluginsBlock}  # Return the process-wide config, built once on first use. The SDK reads
  # the config on every request and never writes to it, so one instance is
  # shared by every client rather than rebuilt per client.
  #
  # The returned hash is shared: treat it as read-only. Callers that need to
  # mutate should use make_config, which always returns a fresh copy.
  def self.shared_config
    @shared_config ||= make_config
  end


`)

    // ABOVE THE THRESHOLD: emit the model as DATA.
    //
    // A hash literal makes the Ruby parser build a node per entry and the VM
    // execute an instruction per entry on every load. A string constant is one
    // token, and `JSON.parse` (a C extension) builds the hash far faster.
    //
    // `JSON.parse` yields exactly what the literal did - String keys, Integer
    // for whole numbers, true/false/nil - so make_config's result is unchanged.
    //
    // A SINGLE-quoted literal, so the JSON survives verbatim: a double-quoted
    // Ruby string would interpolate any `#{` the model happens to contain.
    if (asData) {
      Content(`  # THE API MODEL, EMBEDDED AS DATA (sdkgen rung L1).
  #
  # Emitted only above a size threshold, or when \`main.kit.config.repr\` pins
  # it: for a small model the hash literal is smaller and far easier to read
  # when debugging.
  CONFIG_DATA = ${rawStringLiteral(configJson)}.freeze

  # Parse a fresh, fully materialised config hash. Every call re-parses, so
  # prefer shared_config unless you need a private copy you intend to mutate.
  def self.make_config
    JSON.parse(CONFIG_DATA)
  end
`)
    }
    else {

    Content(`  # Build a fresh, fully materialised config hash. Every call rebuilds the
  # whole structure, so prefer shared_config unless you need a private copy
  # you intend to mutate.
  def self.make_config
    {
      "main" => {
        "name" => "${model.const.Name}",
        "slug" => ${rbs(String(configDef.main.slug))},
        "version" => ${rbs(String(configDef.main.version))},
        "target" => ${rbs(String(configDef.main.target))},
      },
      "feature" => {
`)

    each(feature, (f: any) => {
      // From configDefinition's def, not f.config, so the literal carries
      // the feature's `transport` role (station design §8.4) beside its
      // options and cannot drift from the data rep.
      const fconfig = configDef.feature[f.name] || {}
      Content(`        "${f.name}" => ${formatRubyHash(fconfig, 4)},
`)
    })

    Content(`      },
      "options" => {
        "base" => "${baseUrl}",
${serverBlock}${authBlock}        "headers" => ${formatRubyHash(headers, 4)},
        "entity" => {
`)

    each(entity, (entity: any) => {
      Content(`          "${entity.name}" => {},
`)
    })

    Content(`        },
      },
      "entity" => ${formatRubyHash(
configDef.entity, 3)},
    }
  end
`)
    }

    Content(`

  def self.make_feature(name)
    require_relative 'features'
    ${model.const.Name}Features.make_feature(name)
  end
end
`)
  })
})


export {
  Config
}
