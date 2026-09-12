
import * as Path from 'node:path'

import {
  cmp, each, names, cmap,
  List, File, Content, Copy, Folder, Fragment, Line, FeatureHook,
  pluginExcludes,
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


import { Package } from './Package_php'
import { Config } from './Config_php'
import { Gitignore } from './Gitignore_php'
import { MainEntity } from './MainEntity_php'
import { EntityTypes } from './EntityTypes_php'


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

  // Copy tm/php files with replacements
  Copy({
    from: 'tm/' + target.name,
    // ANCHORED at the template root. Copy's exclude matches the
    // SOURCE-RELATIVE path, so the old unanchored /src\// also pruned
    // `feature/secrets/sekreto/src/` - the vendored sekreto core, whose
    // directory depth is fixed by upstream and by the vendoring guard. The
    // anchored form prunes the same top-level `tm/php/src/` placeholder
    // tree (a `src` directory entry matches on the `$` arm, so the whole
    // subtree is still pruned at the directory) and nothing else.
    //
    // pluginExcludes: the generate-time plugin trim (an INACTIVE plugin
    // group's declared files stay out of the tree - the model's `path`
    // entries are target-root-relative, which is this Copy's root). With
    // no active feature declaring a plugin catalogue it is EMPTY, so a
    // simple SDK's output is unchanged. The FEATURE-level trim for php
    // stays an add-time concern (vendor-tag rollout, Decision 5).
    exclude: [/^src(\/|$)/, TEST_CONTROL_EXCLUDE, ...pluginExcludes(model)],
    replace: {
      ...props.ctx$.stdrep,
    }
  })

  // Generate main SDK file
  File({ name: model.const.Name.toLowerCase() + '_sdk.' + target.ext }, () => {

    Fragment(
      {
        from: Path.normalize(__dirname + '/../../../src/cmp/php/fragment/Main.fragment.php'),
        replace: {
          ...props.ctx$.stdrep,

          '#BuildFeatures': ({ indent }: any) => {
            each(feature, (feat: any) => {
              const fname = feat.name.charAt(0).toUpperCase() + feat.name.slice(1)
              Content({ indent }, `  // feature: ${feat.name}
`)
            })
          },

          '#Feature-Hook': ({ name, indent }: any) => Content({ indent }, `
($utility->feature_hook)($this->_rootctx, "${name}");
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

  // Generate config module
  Folder({ name: '.' }, () => {
    Config({ target })
  })

  // Generate typed models (types/<Sdk>Types.php) — classmap-autoloaded.
  EntityTypes({ target })

  // Generate feature factory module
  File({ name: 'features.' + target.ext }, () => {
    Content(`<?php
declare(strict_types=1);

// ${model.const.Name} SDK feature factory

require_once __DIR__ . '/feature/BaseFeature.php';
`)

    each(feature, (feat: any) => {
      if (feat.name !== 'base') {
        const fname = feat.name.charAt(0).toUpperCase() + feat.name.slice(1)
        Content(`require_once __DIR__ . '/feature/${fname}Feature.php';
`)
      }
    })

    Content(`

class ${model.const.Name}Features
{
    public static function make_feature(string $name)
    {
        switch ($name) {
            case "base":
                return new ${model.const.Name}BaseFeature();
`)

    each(feature, (feat: any) => {
      if (feat.name !== 'base') {
        const fname = feat.name.charAt(0).toUpperCase() + feat.name.slice(1)
        Content(`            case "${feat.name}":
                return new ${model.const.Name}${fname}Feature();
`)
      }
    })

    Content(`            default:
                return new ${model.const.Name}BaseFeature();
        }
    }

    /**
     * Does a generated feature class back this name? False for a name only
     * an options extend instance can supply (the station adopt path) - the
     * constructor uses this to skip make_feature for such names instead of
     * adding a stray BaseFeature.
     */
    public static function has_feature(string $name): bool
    {
        switch ($name) {
            case "base":
`)

    each(feature, (feat: any) => {
      if (feat.name !== 'base') {
        Content(`            case "${feat.name}":
`)
      }
    })

    Content(`                return true;
            default:
                return false;
        }
    }
}
`)
  })

})


export {
  Main
}
