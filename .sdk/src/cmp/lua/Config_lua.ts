
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
  formatLuaTable,
  luaLongString,
} from './utility_lua'


function pluginRequires(feature: any): { locals: string[], defs: Record<string, string[]> } {
  const bypath: Record<string, { local: string, syms: string[] }> = {}
  const defs: Record<string, string[]> = {}

  each(feature, (f: any) => {
    const syms: string[] = []

    each(f.plugin, (plugin: any) => {
      // Filter on `active` HERE rather than trusting the feature object to
      // arrive filtered: getting it wrong in this direction emits a
      // require for a module the plugin trim just deleted - an SDK that
      // does not load, rather than one that merely carries too much.
      if (false === plugin.active || null == plugin.active) return

      for (const [sym, one] of Object.entries(plugin.def?.lua || {})) {
        const path = String(one)
        const local = path.replace(/^.*\//, '').replace(/\.lua$/, '')
        const entry = (bypath[path] = bypath[path] || { local: 'plugin_' + local, syms: [] })
        entry.syms.push(sym)
        syms.push(entry.local + '.' + sym)
      }
    })

    if (0 < syms.length) {
      defs[f.name] = syms.sort()
    }
  })

  const locals = Object.keys(bypath).sort().map((path: string) => {
    const mod = path.replace(/\.lua$/, '').replace(/\//g, '.')
    return `local ${bypath[path].local} = require("${mod}")`
  })

  return { locals, defs }
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

  let baseUrl = ''
  try { baseUrl = getModelPath(model, `main.${KIT}.info.servers.0.url`) } catch (_e) { }

  const svars = serverVariables(model)
  const serverBlock = 0 === svars.length ? '' :
    '      server = {\n' +
    svars.map((v: any) => `        [${JSON.stringify(v.name)}] = ${JSON.stringify(v.dflt)},\n`).join('') +
    '      },\n'

  const authIn = resolveAuthIn(model)
  const authName = resolveAuthName(model)
  const authBlock = authActive
    ? `      auth = {
        prefix = "${authPrefix}",${'header' === authIn ? '' : `
        ["in"] = "${authIn}",`}${'Authorization' === authName ? '' : `
        name = "${authName}",`}
      },\n`
    : ''

  const { def: configDef, json: configJson } = configDefinition(model, target.name)
  const asData = isConfigData(configJson, configReprSetting(model))

  File({ name: 'config.' + target.ext }, () => {

    Content(`-- ${model.const.Name} SDK configuration

`)

    if (asData) {
      Content(`local json = require("dkjson")


-- THE API MODEL, EMBEDDED AS DATA (sdkgen rung L1).
--
-- Emitted only above a size threshold, or when \`main.kit.config.repr\` pins
-- it: for a small model the table literal is smaller and far easier to read
-- when debugging.
local CONFIG_DATA = ${luaLongString(configJson)}


-- Parse a fresh, fully materialised config table. Every call re-parses, so
-- prefer require("config_shared") unless you need a private copy you intend
-- to mutate.
local function make_config()
  return json.decode(CONFIG_DATA)
end
`)
    }
    else {

    // Identity values from configDefinition's def, not re-derived here, so
    // the literal rep and the data rep cannot disagree (the ts #MainMeta
    // discipline).
    Content(`-- Build a fresh, fully materialised config table. Every call rebuilds the
-- whole structure, so prefer require("config_shared") unless you need a
-- private copy you intend to mutate.
local function make_config()
  return {
    main = {
      name = "${model.const.Name}",
      slug = ${JSON.stringify(configDef.main.slug)},
      version = ${JSON.stringify(configDef.main.version)},
      target = ${JSON.stringify(configDef.main.target)},
    },
    feature = {
`)

    each(feature, (f: any) => {
      // From configDefinition's def, not f.config, so the literal carries
      // the feature's `transport` role (station design §8.4) beside its
      // options and cannot drift from the data rep.
      const fconfig = configDef.feature[f.name] || {}
      Content(`      ["${f.name}"] = ${formatLuaTable(fconfig, 3)},
`)
    })

    Content(`    },
    options = {
      base = "${baseUrl}",
${serverBlock}${authBlock}      headers = ${formatLuaTable(headers, 3)},
      entity = {
`)

    each(entity, (entity: any) => {
      Content(`        ["${entity.name}"] = {},
`)
    })

    Content(`      },
    },
    entity = ${formatLuaTable(
configDef.entity, 2)},
  }
end
`)
    }

    Content(`

local function make_feature(name)
  local features = require("features")
  local factory = features[name]
  if factory ~= nil then
    return factory()
  end
  return features.base()
end


-- Attach make_feature to the SDK class
local function setup_sdk(SDK)
  SDK._make_feature = make_feature
end


return make_config
`)
  })

  const plugins = pluginRequires(feature)

  File({ name: 'config_plugins.' + target.ext }, () => {
    Content(`-- ${model.const.Name} SDK feature plugin definitions
--
-- The sekreto plugin DEFINITIONS the model selected per feature, required
-- below from the modules the catalogue's active \`plugin.def\` entries
-- declare. Handed to each feature (secrets builds its Sekreto with them):
-- a provider kind not listed here is unknown to this SDK - the four
-- built-in kinds (env, memory, dotenv, file) come with the core and never
-- appear here.
${0 < plugins.locals.length ? '\n' + plugins.locals.join('\n') + '\n' : ''}

local FEATURE_PLUGINS = {
${Object.keys(plugins.defs).sort().map((fname: string) =>
  `  ["${fname}"] = {\n` +
  plugins.defs[fname].map((sym: string) => `    ${sym},\n`).join('') +
  `  },\n`).join('')}}


-- The definitions list for one feature's chain; empty when the model
-- selected no plugin group for it.
return function(name)
  return FEATURE_PLUGINS[name] or {}
end
`)
  })

  // A sibling module rather than a member of `config`: `config` returns a
  // bare function (`require("config")()`), and turning it into a table would
  // change its observable type for any consumer holding it as a factory.
  File({ name: 'config_shared.' + target.ext }, () => {
    Content(`-- ${model.const.Name} SDK shared configuration

local make_config = require("config")

local value = nil


-- Return the config for this Lua state, built once on first use. The SDK
-- reads the config on every request and never writes to it, so one instance
-- is shared by every client rather than rebuilt per client.
--
-- The returned table is shared: treat it as read-only. Callers that need to
-- mutate should use require("config")(), which always returns a fresh copy.
return function()
  if value == nil then
    value = make_config()
  end
  return value
end
`)
  })
})


export {
  Config
}
