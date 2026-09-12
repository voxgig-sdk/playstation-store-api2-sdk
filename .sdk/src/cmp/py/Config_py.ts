
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
  formatPyDict,
} from './utility_py'


// PLUGIN DEFINITION IMPORTS AND THE FEATURE_PLUGINS MAP (mirrors
// cmp/ts/Config_ts.ts).
//
// Upstream sekreto replaced its self-registration registry with
// voxgig/plugin definitions: a provider kind the caller did not pass in
// via `plugins: [...]` is unknown to that Sekreto. So config imports each
// active plugin's exported definition BY NAME (the model's `def.py` map)
// and hands the list to the feature through FEATURE_PLUGINS.
//
// The `def` map is declared in the model rather than derived from
// filenames because one module may export several definitions (sekreto's
// aws.py exports awssecrets AND awsparams). A def value is the module's
// path under tm/py ('pkg/feature/.../aws.py'); Main copies tm/py/pkg INTO
// the <name>_sdk package, so the import module is the path with `pkg/`
// swapped for the package name and slashes for dots.
function pluginImports(feature: any, pkg: string) {
  each(feature, (f: any) => {
    // path -> [symbol, ...], so one import line serves a two-definition
    // module.
    const bypath: Record<string, string[]> = {}

    each(f.plugin, (plugin: any) => {
      // Filter on `active` HERE rather than trusting the feature object
      // to arrive filtered: getting it wrong in this direction emits an
      // import for a module the plugin trim just deleted - an SDK that
      // does not import, rather than one that merely carries too much.
      if (false === plugin.active || null == plugin.active) return

      for (const [sym, one] of Object.entries(plugin.def?.py || {})) {
        const path = String(one)
        ; (bypath[path] = bypath[path] || []).push(sym)
      }
    })

    for (const path of Object.keys(bypath).sort()) {
      const mod = pkg + '.' +
        path.replace(/^pkg\//, '').replace(/\.py$/, '').replace(/\//g, '.')
      Line(`from ${mod} import ${bypath[path].sort().join(', ')}`)
    }
  })
}

// The FEATURE_PLUGINS entries: one line per feature that has any active
// plugin definitions, listing the imported symbols.
function pluginDefs(feature: any) {
  each(feature, (f: any) => {
    const syms: string[] = []
    each(f.plugin, (plugin: any) => {
      if (false === plugin.active || null == plugin.active) return
      syms.push(...Object.keys(plugin.def?.py || {}))
    })
    if (0 < syms.length) {
      Line(`    "${f.name}": [${syms.sort().join(', ')}],`)
    }
  })
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
  const svars = serverVariables(model)
  const serverBlock = 0 === svars.length ? '' :
    '            "server": {\n' +
    svars.map((v: any) => `                ${JSON.stringify(v.name)}: ${JSON.stringify(v.dflt)},\n`).join('') +
    '            },\n'

  const authBlock = authActive
    ? `            "auth": {
                "prefix": "${authPrefix}",
            },\n`
    : ''

  // The same config as an OBJECT, built by the shared helper so this target's
  // literal and the data that replaces it above the threshold are the same
  // config by construction. The JSON is what the threshold is measured on -
  // emitted source size varies by language, the model does not. Passing the
  // target name opts in to the main.slug/version/target identity fields -
  // the literal path below emits them too, keeping the two reps in step.
  const { def: configDef, json: configJson } = configDefinition(model, target.name)
  const asData = isConfigData(configJson, configReprSetting(model))

  const pkg = model.const.Name.toLowerCase() + '_sdk'

  File({ name: 'config.' + target.ext }, () => {

    Content(`# ${model.const.Name} SDK configuration
${asData ? '\nimport json\n' : ''}`)

    pluginImports(feature, pkg)

    // The FEATURE_PLUGINS map is ALWAYS emitted, even empty: the secrets
    // feature module imports it unconditionally, and (unlike ts) the py
    // feature source is copied by Main's blanket pkg copy whether or not
    // the model declares the feature - an import of a missing name would
    // fail the whole package at collection time.
    Content(`

# The sekreto plugin DEFINITIONS the model selected per feature, imported
# above by name from the modules the catalogue's active \`plugin.def\`
# entries declare. Handed to each feature (secrets builds its Sekreto
# with them): a provider kind not listed here is unknown to that SDK.
FEATURE_PLUGINS = {
`)

    pluginDefs(feature)

    Content(`}


_shared_config = None


def shared_config():
    """Return the process-wide config, built once on first use.

    The SDK reads the config on every request and never writes to it, so one
    instance is shared by every client rather than rebuilt per client.

    The returned dict is shared: treat it as read-only. Callers that need to
    mutate should use make_config, which always returns a fresh copy.
    """
    global _shared_config
    if _shared_config is None:
        _shared_config = make_config()
    return _shared_config


`)

    // ABOVE THE THRESHOLD: emit the model as DATA.
    //
    // A dict literal makes CPython build the whole structure opcode by opcode
    // at import, and the compiler hold the entire literal in memory to produce
    // that bytecode. A string constant is one object, and `json.loads` (the C
    // scanner) builds the dict far faster than the equivalent literal.
    //
    // `json.loads` yields exactly what the literal did - str keys, int for
    // whole numbers, True/False/None - so make_config's result is unchanged.
    //
    // JSON.stringify output is a valid Python string literal: every escape it
    // emits (\\", \\\\, \\n, \\uXXXX) means the same thing in Python, it never emits
    // \\/ (which Python would not treat as an escape), and Python 3 source is
    // UTF-8 so non-ASCII needs no escaping.
    if (asData) {
      Content(`# THE API MODEL, EMBEDDED AS DATA (sdkgen rung L1).
#
# Emitted only above a size threshold, or when \`main.kit.config.repr\` pins it:
# for a small model the dict literal is smaller and far easier to read when
# debugging.
_CONFIG_DATA = ${JSON.stringify(configJson)}


def make_config():
    """Parse a fresh, fully materialised config dict.

    Every call re-parses, so prefer shared_config unless you need a private
    copy you intend to mutate.
    """
    return json.loads(_CONFIG_DATA)
`)
      return
    }

    // Identity values from configDefinition's def, not re-derived here, so
    // the literal rep and the data rep cannot disagree on identity (the
    // slug is CARRIED, never derived from the camel name - station's
    // descriptor reads all three; see cmp/ts/Config_ts.ts #MainMeta).
    Content(`def make_config():
    """Build a fresh, fully materialised config dict.

    Every call rebuilds the whole structure, so prefer shared_config unless
    you need a private copy you intend to mutate.
    """
    return {
        "main": {
            "name": "${model.const.Name}",
            "slug": ${JSON.stringify(configDef.main.slug)},
            "version": ${JSON.stringify(configDef.main.version)},
            "target": ${JSON.stringify(configDef.main.target)},
        },
        "feature": {
`)

    each(feature, (f: any) => {
      // From configDefinition's def, not f.config, so the literal carries
      // the feature's `transport` role (station design §8.4) beside its
      // options and cannot drift from the data rep.
      const fconfig = configDef.feature[f.name] || {}
      Content(`            "${f.name}": ${formatPyDict(fconfig, 3)},
`)
    })

    Content(`        },
        "options": {
            "base": "${baseUrl}",
${serverBlock}${authBlock}            "headers": ${formatPyDict(headers, 3)},
            "entity": {
`)

    each(entity, (entity: any) => {
      Content(`                "${entity.name}": {},
`)
    })

    Content(`            },
        },
        "entity": ${formatPyDict(
configDef.entity, 2)},
    }
`)
  })
})


export {
  Config
}
