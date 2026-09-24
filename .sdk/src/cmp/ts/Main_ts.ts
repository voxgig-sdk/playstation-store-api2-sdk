
import * as Path from 'node:path'

import {
  cmp, each, names, cmap,
  List, File, Content, Copy, Folder, Fragment, Line, FeatureHook,
  entityClassName, entityCollection, srcFeatureExcludes, pluginExcludes,
  stationLibrary,
  targetFeatures,
  TEST_CONTROL_EXCLUDE
} from '@voxgig/sdkgen'


import type {
  ModelEntity
} from '@voxgig/apidef'


import {
  KIT,
  getModelPath
} from '@voxgig/apidef'


import { Package } from './Package_ts'
import { Config } from './Config_ts'
import { PrepareAuth } from './PrepareAuth_ts'
import { Schema } from './Schema_ts'
import { Gitignore } from './Gitignore_ts'
import { MainEntity } from './MainEntity_ts'
import { EntityBase } from './EntityBase_ts'
import { EntityTypes } from './EntityTypes_ts'
import { SdkError } from './SdkError_ts'


const Main = cmp(async function Main(props: any) {

  const { target } = props
  const { model } = props.ctx$

  const entity: ModelEntity = getModelPath(model, `main.${KIT}.entity`)
  // Gated by the applicability tags, so this target never imports or
  // registers a feature it has no source for. One rule, one place:
  // helpers/applicability.
  const feature = targetFeatures(model, target)

  // Does the secrets feature apply here and is it switched on? Both, since
  // targetFeatures already dropped it for a target with no sekreto port.
  const secrets = null != feature.secrets

  Package({ target })

  Gitignore({})

  Copy({
    from: 'tm/' + target.name,
    // Root copies src/feature/<name>/ per ACTIVE feature; keep this blanket
    // copy from restoring one that was switched off after `target add`.
    // A feature's inactive plugins go too - same rule, one level
    // deeper. See helpers/featureSource.pluginExcludes.
    exclude: [
      ...srcFeatureExcludes(model),
      ...pluginExcludes(model),
      TEST_CONTROL_EXCLUDE,
    ],
    replace: {
      ...props.ctx$.stdrep,
    }
  })

  Folder({ name: 'src' }, () => {

    SdkError({ target })

    File({ name: model.const.Name + 'SDK.' + target.name }, () => {

      Line(`// ${model.const.Name} ${target.Name} SDK\n`)

      List({ item: entity }, ({ item }: any) => {
        const cls = entityClassName(item, entityCollection(model))
        return Line(`import { ${cls} } from './entity/${cls}'`)
      })

      Line(`export type * from './${model.const.Name}Types'\n`)

      Fragment(
        {
          from: Path.normalize(__dirname + '/../../../src/cmp/ts/fragment/Main.fragment.ts'),
          replace: {
            ...props.ctx$.stdrep,

            '// #SecretsImport': () => secrets ?
              Line(`import * as sekreto from './feature/secrets/sekreto'`) : undefined,

            '// #SecretsField': ({ indent }: any) => secrets ?
              Line({ indent }, '_secrets?: any') : undefined,

            // The LIVE instance, not a clone: sekreto holds provider and
            // cache state, so a clone would resolve into a copy that
            // prepareAuth never sees.
            '// #SecretsAccessor': ({ indent }: any) => secrets ?
              Content({ indent }, `
secrets() {
  return this._secrets && this._secrets.sekreto()
}
`) : undefined,

            '// #SecretsResolve': ({ indent }: any) => secrets ?
              Content({ indent }, `
if (null != this._secrets) {
  try {
    await this._secrets.resolve()
  }
  catch (err: any) {
    return err instanceof Error ? err : new Error(String(err))
  }
}
`) : undefined,

            '// #SecretsExport': ({ indent }: any) => secrets ?
              Line({ indent }, 'sekreto,') : undefined,

            '#BuildFeatures': ({ indent }: any) => {
              List({ item: feature, line: false }, ({ item }: any) =>
                Line({ indent },
                  `featureAdd(this._rootctx, new ${item.Name}Feature())`))
            },

            '#Feature-Hook': ({ name, indent }: any) => Content({ indent }, `
fres = featureHook(ctx, '${name}')
if (fres instanceof Promise) { await fres }
`),

            '#TestOptions': ({ indent }: any) => {
              const topts = {
                feature: cmap(feature, {
                  active: false
                }),
              }
              Content({ indent },
                JSON.stringify(topts, null, 2)
                  .replace(/^{\n  /, '').replace(/\n}$/, ',\n').replace(/\n  /g, '\n'))
            }
          }
        },

        () => {
          each(entity, (entity: ModelEntity) => {
            const entitySDK = getModelPath(model, `main.${KIT}.entity.${entity.name}`)
            const entprops = { target, entity, entitySDK }
            MainEntity(entprops)
          })
        })

      const stationPkg = stationLibrary(model, target.name)
      if (null != stationPkg) {
        Fragment({
          from: Path.normalize(
            __dirname + '/../../../src/cmp/ts/fragment/MainStation.fragment.ts'),
          replace: {
            ...props.ctx$.stdrep,
            "'STATIONPKG'": JSON.stringify(stationPkg),
          }
        })
      }
    })

    Config({ target })

    // GENERATED, NOT COPIED. Where the credential goes is a fact about the
    // API, and tm/ can only hold one answer. See PrepareAuth_ts.
    PrepareAuth({ target })
    Schema({ target })
    EntityBase({ target })
    EntityTypes({ target })

  })
})


export {
  Main
}
