
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
  indent,
  isAuthActive,
  isConfigData,
  isHttpBasicAuth,
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
  formatJson,
} from './utility_ts'


const Config = cmp(async function Config(props: any) {
  const ctx$ = props.ctx$
  const target = props.target

  const model: Model = ctx$.model

  const entity = getModelPath(model, `main.${KIT}.entity`)
  // Gated by the applicability tags, so this target never imports or
  // registers a feature it has no source for. One rule, one place:
  // helpers/applicability.
  const feature = targetFeatures(model, target)

  const ff = Path.normalize(__dirname + '/../../../src/cmp/ts/fragment/')

  const headers = getModelPath(model, `main.${KIT}.config.headers`) || {}

  const authActive = isAuthActive(model)
  // config.auth.prefix override -> spec-derived info.security.prefix -> 'Bearer'
  const authPrefix = resolveAuthPrefix(model)
  const authBasic = isHttpBasicAuth(model)
  const authBlock = authActive
    ? `auth: {
      prefix: '${authPrefix}',${authBasic ? `
      basic: true,` : ''}
    },

    `
    : ''

  // Templated server URL: emit the spec's server-variable defaults so the
  // runtime can substitute {name} placeholders in base (see makeOptions).
  const svars = serverVariables(model)
  const serverBlock = 0 === svars.length ? '' :
    'server: {\n' +
    svars.map((v: any) => `      ${JSON.stringify(v.name)}: ${JSON.stringify(v.dflt)},\n`).join('') +
    '    },\n\n    '

  // Read the base URL here rather than leaving it to a `$$...$$` stdrep
  // placeholder in the fragment. stdrep can only substitute a path the model
  // actually has: a model with no `info.servers` left the placeholder itself in
  // the generated source, so `options.base` came out as the literal string
  // '$main.kit.info.servers.0.url$'. Reading it explicitly yields '' in that
  // case, which is what every other target already emits, and is identical to
  // the old output whenever the model does define a server.
  let baseUrl = ''
  try {
    baseUrl = getModelPath(model, `main.${KIT}.info.servers.0.url`)
  } catch (_e) { }

  // The same config as an OBJECT, built by the shared helper so this target's
  // literal and the data that replaces it above the threshold are the same
  // config by construction. The JSON is what the threshold is measured on -
  // emitted source size varies by language, the model does not.
  const { def: configDef, json: configJson } = configDefinition(model, target.name)
  const asData = isConfigData(configJson, configReprSetting(model))

  File({ name: 'Config.' + target.ext }, () => {

    if (asData) {
      Fragment({
        from: ff + 'Config.data.fragment.ts',

        replace: {

          '// #ImportFeatures': () => {
            each(feature, (f: any) => {
              Line(`import { ${nom(f, 'Name')}Feature } from ` +
                `'./feature/${f.name}/${nom(f, 'Name')}Feature'`)
            })
            pluginImports(feature)
          },

          '// #FeatureClasses': () => each(feature, (f: any) => {
            Line(` ${f.name}: ${nom(f, 'Name')}Feature,`)
          }),

          '// #FeaturePlugins': () => pluginDefs(feature),

          // A JS string literal, so the JSON survives verbatim. JSON.stringify
          // escapes the quotes and backslashes the model contains (values like
          // `$STRING` carry backticks, which a template literal could not).
          "'CONFIGJSON'": JSON.stringify(configJson),
        }
      })
      return
    }

    Fragment({
      from: ff + 'Config.fragment.ts',

      replace: {

        "'BASEURL'": JSON.stringify(baseUrl),

        "'SERVERBLOCK'": serverBlock,

        "'AUTHBLOCK'": authBlock,

        "'HEADERS'": indent(JSON.stringify(headers, null, 2), 4).trim(),

        '// #ImportFeatures': () => {
          each(feature, (f: any) => {
            Line(`import { ${nom(f, 'Name')}Feature } from ` +
              `'./feature/${f.name}/${nom(f, 'Name')}Feature'`)
          })
          pluginImports(feature)
        },

        // Values from configDefinition's def, not re-derived here, so the
        // literal rep and the data rep cannot disagree on identity.
        '// #MainMeta': () => {
          Line(`    slug: ${JSON.stringify(configDef.main.slug)},`)
          Line(`    version: ${JSON.stringify(configDef.main.version)},`)
          Line(`    target: ${JSON.stringify(configDef.main.target)},`)
        },

        '// #FeatureClasses': () => each(feature, (f: any) => {
          // Trailing comma: the map has one entry per feature, so entries
          // must be comma-separated (a single feature hid this until now).
          Line(` ${f.name}: ${nom(f, 'Name')}Feature,`)
        }),

        '// #FeaturePlugins': () => pluginDefs(feature),

        // Rendered from configDefinition's def, not from f.config, so the
        // literal carries the feature's `transport` role (station design
        // §8.4) beside its options and cannot drift from the data rep.
        '// #FeatureConfigs': () => each(feature, (f: any) => {
          Line(` ${f.name}: ${formatJson(configDef.feature[f.name], { margin: 4 })},`)
        }),


        '// #EntityConfigs': () => each(entity, (entity: any) => {
          Content(`
      ${entity.name}: {
      },
`)
        }),

        // configDefinition's `def.entity` verbatim, NOT rebuilt here. This
        // reduce was a second copy of that function's entityDefs loop, and
        // when configDefinition started reconstructing a point's `parts`
        // from apidef's segment vector (its ADR-003), only the data
        // representation got it — the literal one emitted empty paths. The
        // config-repr equivalence test caught it, which is what it is for.
        "'ENTITYMAP'": formatJson(configDef.entity, { margin: 2 }).trim(),
      }
    })
  })
})



// PLUGIN DEFINITION IMPORTS AND THE FEATURE_PLUGINS MAP.
//
// Upstream sekreto replaced its self-registration registry with
// voxgig/plugin definitions: a provider kind the caller did not pass in
// via `plugins: [...]` is unknown to that Sekreto. So Config no longer
// imports provider modules for their side effects — it imports each
// active plugin's exported Definition BY NAME (the model's `def` map)
// and hands the list to the feature through FEATURE_PLUGINS.
//
// Emitted here because Config already imports every active feature from
// the model, and this is the same list one level down. The `def` map is
// declared in the model rather than derived from filenames because one
// file may export several definitions (sekreto's aws.ts exports
// awssecrets AND awsparams).
function pluginImports(feature: any) {
  each(feature, (f: any) => {
    // path -> [symbol, ...], so one import line serves a two-definition
    // module.
    const bypath: Record<string, string[]> = {}

    each(f.plugin, (plugin: any) => {
      // Filter on `active` HERE rather than trusting the feature object to
      // arrive filtered. Whether a model path was read with `only_active`
      // varies by call site, and getting it wrong in this direction emits
      // an import for a module the trim just deleted — an SDK that does
      // not compile, rather than one that merely carries too much.
      if (false === plugin.active || null == plugin.active) return

      for (const [sym, one] of Object.entries(plugin.def?.ts || {})) {
        const path = String(one)
        ; (bypath[path] = bypath[path] || []).push(sym)
      }
    })

    for (const path of Object.keys(bypath).sort()) {
      const spec = './' + path.replace(/^src\//, '').replace(/\.ts$/, '')
      Line(`import { ${bypath[path].sort().join(', ')} } from '${spec}'`)
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
      syms.push(...Object.keys(plugin.def?.ts || {}))
    })
    if (0 < syms.length) {
      Line(` ${f.name}: [${syms.sort().join(', ')}],`)
    }
  })
}

export {
  Config
}
