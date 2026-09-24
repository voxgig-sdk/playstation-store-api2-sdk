
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
import { Schema } from './Schema_lua'
import { PrepareAuth } from './PrepareAuth_lua'
import { Gitignore } from './Gitignore_lua'
import { MainEntity } from './MainEntity_lua'
import { EntityTypes } from './EntityTypes_lua'


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

  const containerExcludes = CONTAINED
    .filter((name: string) => null == feature[name])
    .flatMap((name: string) => [
      new RegExp('(^|/)feature/' + name + '_feature\\.lua$'),
      new RegExp('(^|/)feature/' + name + '/'),
      new RegExp('(^|/)test/feature/' + name + '/'),
    ])

  Copy({
    from: 'tm/' + target.name,
    exclude: [/src\//, TEST_CONTROL_EXCLUDE,
      ...containerExcludes, ...pluginExcludes(model)],
    replace: {
      ...props.ctx$.stdrep,
    }
  })

  const nativeGroups: string[] = []
  let wantsVault = false
  each(feature, (f: any) => {
    each(f.plugin, (plugin: any) => {
      if (false === plugin.active || null == plugin.active) return
      if (0 < Object.keys(plugin.def?.lua || {}).length) {
        nativeGroups.push(f.name + '.' + plugin.name)
        if ('minivault' === plugin.name) {
          wantsVault = true
        }
      }
    })
  })

  // The transport helper serves every kind that reaches the network or a
  // child process. The vault reaches neither, so a vault-only chain needs
  // the module and not the program.
  const wantsNet = nativeGroups.some((one) => !/\.minivault$/.test(one))

  if (0 < nativeGroups.length) {
    Folder({ name: 'feature' }, () => {
      Folder({ name: 'secrets' }, () => {
        File({ name: 'native.mk' }, () => {
          Content(`# ${model.const.Name} SDK: the sekreto native helper build.
#
# GENERATED because a secrets plugin group is active
# (${nativeGroups.sort().join(', ')}). Lua 5.4 has no sockets, no TLS and no
# cryptography, so the kinds that need any of the three reach a small
# compiled helper - and this file builds only the ones this SDK's chain
# actually uses. An SDK without an active plugin group has no such file,
# and its Makefile's optional include of it is a no-op: nothing is
# compiled and nothing is linked.
#
# The source carries the vendoring tool's three-line provenance header in
# lua comment syntax, which the compiler cannot read: it is fed the file
# from line four. Compiler line numbers are therefore three lower than the
# file's.
NATIVE := ${[
            wantsNet ? 'feature/secrets/native/sekreto-net' : '',
            wantsVault ? 'feature/secrets/native/sekretovault.so' : '',
          ].filter((one) => '' !== one).join(' ')}

CC ?= cc
CFLAGS ?= -std=c11 -O2 -Wall -Wextra
LDLIBS ?= -lssl -lcrypto
${wantsNet ? `
feature/secrets/native/sekreto-net: feature/secrets/native/sekretonet.c
	@command -v $(CC) >/dev/null 2>&1 || { echo "secrets: a C compiler ($(CC)) is needed to build the sekreto transport helper that this SDK's plugin provider kinds run - install one, or use only the built-in provider kinds" >&2; exit 1; }
	tail -n +4 $< | $(CC) $(CFLAGS) -x c - -o $@ $(LDLIBS)
` : ''}${wantsVault ? `
# The mini vault's crypto is a LOADABLE MODULE, not a program: minivault.lua
# opens it with package.loadlib and calls luaopen_sekretovault, so it is
# compiled -shared -fPIC and keeps the .so name that call expects. It links
# libcrypto alone - the vault reads a file and never opens a socket, so it
# needs no TLS.
#
# LUA_CFLAGS is where a consumer points the compiler at lua.h when it is not
# on the default include path (Homebrew, a pkg-config build, a vendored Lua).
LUA_CFLAGS ?= $(shell pkg-config --cflags lua5.4 2>/dev/null || pkg-config --cflags lua 2>/dev/null)

feature/secrets/native/sekretovault.so: feature/secrets/native/sekretovault.c
	@command -v $(CC) >/dev/null 2>&1 || { echo "secrets: a C compiler ($(CC)) is needed to build the mini vault's crypto module - install one, or use only the built-in provider kinds" >&2; exit 1; }
	tail -n +4 $< | $(CC) $(CFLAGS) $(LUA_CFLAGS) -fPIC -shared -x c - -o $@ -lcrypto
` : ''}`)
        })
      })
    })
  }

  File({ name: model.name + '_sdk.' + target.ext }, () => {

    Fragment(
      {
        from: Path.normalize(__dirname + '/../../../src/cmp/lua/fragment/Main.fragment.lua'),
        replace: {
          ...props.ctx$.stdrep,

          // Load the LuaLS typed-model annotations module so it is part of
          // the loaded program (module body is empty — no runtime effect) and
          // does not depend on workspace-wide language-server scanning.
          // (`-- #X`) — jostraca's bare `#X` form only matches `//`-style
          // comment lines (cf. the `'-- #LoadOp'` keys in Entity_lua.ts).
          '-- #TypesRequire': ({ indent }: any) => Content({ indent },
            `-- Typed-model annotations (LuaLS ---@class); empty at runtime.\n` +
            `require("${model.name}_types")`),

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

      () => {
        each(entity, (entity: ModelEntity) => {
          const entitySDK = getModelPath(model, `main.${KIT}.entity.${entity.name}`)
          const entprops = { target, entity, entitySDK }
          MainEntity(entprops)
        })
      })
  })

  EntityTypes({ target })

  Folder({ name: '.' }, () => {
    Config({ target })
    Schema({ target })
  })

  // GENERATED, NOT COPIED. Where the credential goes is a fact about the
  // API - header, query or cookie, under the name the spec gives - and tm/
  // Called at the TARGET ROOT, like Config above (that Folder({name:'.'})
  // is the root itself), because the lua tree has no src/ wrapper: the
  PrepareAuth({ target })

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

})


export {
  Main
}
