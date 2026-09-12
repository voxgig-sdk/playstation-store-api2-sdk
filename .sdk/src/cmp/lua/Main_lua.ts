
import * as Path from 'node:path'

import {
  cmp, each, names, cmap,
  List, File, Content, Copy, Folder, Fragment, Line, FeatureHook,
  targetFeatures, pluginExcludes,
  TEST_CONTROL_EXCLUDE
} from '@voxgig/sdkgen'


import type {
  ModelEntity
} from '@voxgig/apidef'


import {
  KIT,
  getModelPath
} from '@voxgig/apidef'


import { Package } from './Package_lua'
import { Config } from './Config_lua'
import { Gitignore } from './Gitignore_lua'
import { MainEntity } from './MainEntity_lua'
import { EntityTypes } from './EntityTypes_lua'


// Features whose source is a CONTAINER under the top-level feature/ dir,
// beside the flat `<name>_feature.lua` every other lua feature is. Today
// that is `secrets`: its folder holds a vendored @voxgig/sekreto port, the
// voxgig/plugin runtime and the C transport helper - some forty files of
// key-store, request-signing and child-process code that an SDK which never
// asked for secrets must not ship. Anything named here is EXCLUDED from the
// verbatim copy unless the model SELECTS the feature (see the Copy below);
// its shipped test suite under test/feature/<name>/ goes with it. The
// clojure target gates its container the same way (Main_clojure.ts).
const CONTAINED = ['secrets']


const Main = cmp(async function Main(props: any) {

  const { target } = props
  const { model } = props.ctx$

  const entity: ModelEntity = getModelPath(model, `main.${KIT}.entity`)
  // Gated by the applicability tags, so this target never imports or
  // registers a feature it has no source for. One rule, one place:
  // helpers/applicability.
  const feature = targetFeatures(model, target)

  Package({ target })

  Gitignore({})

  // THE feature/<name>/ CONTAINER IS GATED HERE, at generate time - the
  // top-level-container peer of the `srcFeatureExcludes` gate ts and js
  // apply to src/feature/<name>/. `target add` keeps an unselected
  // feature out of a project's tm/ in the first place; this covers a
  // feature switched off after it was added, and the generator suite,
  // which copies the whole scaffold tree.
  const containerExcludes = CONTAINED
    .filter((name: string) => null == feature[name])
    .flatMap((name: string) => [
      new RegExp('(^|/)feature/' + name + '_feature\\.lua$'),
      new RegExp('(^|/)feature/' + name + '/'),
      new RegExp('(^|/)test/feature/' + name + '/'),
    ])

  // Copy tm/lua files with replacements.
  //
  // pluginExcludes: the generate-time plugin trim (an ACTIVE feature's
  // INACTIVE plugin group's declared files stay out of the tree). The
  // model's lua `path` entries are target-root-relative, which is this
  // Copy's root - helpers/featureSource documents that getting the root
  // wrong makes the trim a silent no-op.
  Copy({
    from: 'tm/' + target.name,
    exclude: [/src\//, TEST_CONTROL_EXCLUDE,
      ...containerExcludes, ...pluginExcludes(model)],
    replace: {
      ...props.ctx$.stdrep,
    }
  })

  // THE NATIVE BUILD SEAM. sekreto's lua PLUGIN kinds (hashicorp, aws, ...)
  // run a small compiled transport helper, because Lua 5.4 has no sockets
  // and no TLS; the four built-in kinds never reach it. The helper's
  // source is vendored with the feature (feature/secrets/native/
  // sekretonet.c) and the template Makefile `-include`s this fragment, so
  // it is compiled - and OpenSSL linked - ONLY when the model activates a
  // plugin group that lua has definitions for. An SDK without secrets, or
  // with the built-in chain alone, gets no fragment, no compiler run and
  // no OpenSSL dependency.
  //
  // The vendored file opens with the vendoring tool's three-line `--`
  // provenance header (every file under tm/lua is stamped in lua's comment
  // syntax; the guard holds that), which the C compiler cannot read - so
  // the rule feeds the compiler from line four. Line numbers in a compiler
  // diagnostic are therefore three lower than in the file.
  const nativeGroups: string[] = []
  each(feature, (f: any) => {
    each(f.plugin, (plugin: any) => {
      if (false === plugin.active || null == plugin.active) return
      if (0 < Object.keys(plugin.def?.lua || {}).length) {
        nativeGroups.push(f.name + '.' + plugin.name)
      }
    })
  })

  if (0 < nativeGroups.length) {
    Folder({ name: 'feature' }, () => {
      Folder({ name: 'secrets' }, () => {
        File({ name: 'native.mk' }, () => {
          Content(`# ${model.const.Name} SDK: the sekreto transport helper build.
#
# GENERATED because a secrets plugin group is active
# (${nativeGroups.sort().join(', ')}): the plugin provider kinds run this
# helper for every socket and child process, since Lua 5.4 has none. An
# SDK without an active plugin group has no such file, and its Makefile's
# optional include of it is a no-op - nothing is compiled and OpenSSL is
# not linked.
#
# The source carries the vendoring tool's three-line provenance header in
# lua comment syntax, which the compiler cannot read: it is fed the file
# from line four. Compiler line numbers are therefore three lower than the
# file's.
NATIVE := feature/secrets/native/sekreto-net

CC ?= cc
CFLAGS ?= -std=c11 -O2 -Wall -Wextra
LDLIBS ?= -lssl -lcrypto

feature/secrets/native/sekreto-net: feature/secrets/native/sekretonet.c
	@command -v $(CC) >/dev/null 2>&1 || { echo "secrets: a C compiler ($(CC)) is needed to build the sekreto transport helper that this SDK's plugin provider kinds run - install one, or use only the built-in provider kinds" >&2; exit 1; }
	tail -n +4 $< | $(CC) $(CFLAGS) -x c - -o $@ $(LDLIBS)
`)
        })
      })
    })
  }

  // Generate main SDK file
  File({ name: model.name + '_sdk.' + target.ext }, () => {

    Fragment(
      {
        from: Path.normalize(__dirname + '/../../../src/cmp/lua/fragment/Main.fragment.lua'),
        replace: {
          ...props.ctx$.stdrep,

          // Load the LuaLS typed-model annotations module so it is part of
          // the loaded program (module body is empty — no runtime effect) and
          // does not depend on workspace-wide language-server scanning.
          // NOTE: plain marker keys must EMBED the lua comment prefix
          // (`-- #X`) — jostraca's bare `#X` form only matches `//`-style
          // comment lines (cf. the `'-- #LoadOp'` keys in Entity_lua.ts).
          '-- #TypesRequire': ({ indent }: any) => Content({ indent },
            `-- Typed-model annotations (LuaLS ---@class); empty at runtime.\n` +
            `require("${model.name}_types")`),

          // Same embedded `-- ` prefix requirement as above (the bare
          // '#BuildFeatures' key never matched the lua comment line).
          '-- #BuildFeatures': ({ indent }: any) => {
            each(feature, (feat: any) => {
              const fname = feat.name.charAt(0).toUpperCase() + feat.name.slice(1)
              Content({ indent }, `  -- feature: ${feat.name}
`)
            })
          },

          '#Feature-Hook': ({ name, indent }: any) => Content({ indent }, `
self._utility.feature_hook(self._rootctx, "${name}")
`),

        }
      },

      // Entities - injected at SLOT
      () => {
        each(entity, (entity: ModelEntity) => {
          const entitySDK = getModelPath(model, `main.${KIT}.entity.${entity.name}`)
          const entprops = { target, entity, entitySDK }
          MainEntity(entprops)
        })
      })
  })

  // Generate typed-model annotations (LuaLS ---@class / ---@field)
  EntityTypes({ target })

  // Generate config module
  Folder({ name: '.' }, () => {
    Config({ target })
  })

  // Generate feature factory module
  File({ name: 'features.' + target.ext }, () => {
    Content(`-- ${model.const.Name} SDK feature factory

local BaseFeature = require("feature.base_feature")
`)

    each(feature, (feat: any) => {
      if (feat.name !== 'base') {
        const fname = feat.name.charAt(0).toUpperCase() + feat.name.slice(1)
        Content(`local ${fname}Feature = require("feature.${feat.name}_feature")
`)
      }
    })

    Content(`

local features = {}

features.base = function()
  return BaseFeature.new()
end

`)

    each(feature, (feat: any) => {
      if (feat.name !== 'base') {
        const fname = feat.name.charAt(0).toUpperCase() + feat.name.slice(1)
        Content(`features["${feat.name}"] = function()
  return ${fname}Feature.new()
end

`)
      }
    })

    Content(`
return features
`)
  })

  // Generate _make_feature function referenced by Main.fragment.lua
  // This is part of the main SDK class, inserted via the slot

})


export {
  Main
}
