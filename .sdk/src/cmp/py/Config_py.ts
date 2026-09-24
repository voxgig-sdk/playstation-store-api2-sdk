
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
  resolveAuthIn,
  resolveAuthName,
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


function pluginImports(feature: any, pkg: string) {
  each(feature, (f: any) => {
    const bypath: Record<string, string[]> = {}

    each(f.plugin, (plugin: any) => {
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
  const feature = targetFeatures(model, target)

  const headers = getModelPath(model, `main.${KIT}.config.headers`) || {}

  const authActive = isAuthActive(model)
  const authPrefix = resolveAuthPrefix(model)
  // `in` and `name` travel with the prefix now. They were resolved by
  // apidef all along and dropped here, so an apiKey-in-query API got an
  // Authorization header it does not read. Emitted only when they differ
  // from the defaults, so a header/Authorization SDK is byte-identical to
  // what it generated before.
  const authIn = resolveAuthIn(model)
  const authName = resolveAuthName(model)

  let baseUrl = ''
  try { baseUrl = getModelPath(model, `main.${KIT}.info.servers.0.url`) } catch (_e) { }

  const svars = serverVariables(model)
  const serverBlock = 0 === svars.length ? '' :
    '            "server": {\n' +
    svars.map((v: any) => `                ${JSON.stringify(v.name)}: ${JSON.stringify(v.dflt)},\n`).join('') +
    '            },\n'

  const authBlock = authActive
    ? `            "auth": {
                "prefix": "${authPrefix}",${'header' === authIn ? '' : `
                "in": "${authIn}",`}${'Authorization' === authName ? '' : `
                "name": "${authName}",`}
            },\n`
    : ''

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
