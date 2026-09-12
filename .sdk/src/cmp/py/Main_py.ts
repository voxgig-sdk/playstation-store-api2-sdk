
import * as Path from 'node:path'

import {
  cmp, each, names, cmap,
  List, File, Content, Copy, Folder, Fragment, Line, FeatureHook,
  entityClassName, entityCollection,
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


import { Package } from './Package_py'
import { Config } from './Config_py'
import { Gitignore } from './Gitignore_py'
import { MainEntity } from './MainEntity_py'
import { EntityTypes } from './EntityTypes_py'


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
  const secrets = null != (feature as any).secrets

  // The one package directory everything the SDK owns lives in.
  const pkgdir = model.const.Name.toLowerCase() + '_sdk'

  Package({ target })

  Gitignore({})

  // Root-level statics only (Makefile, LICENSE, test/). The runtime
  // packages live under tm/py/pkg and are copied INSIDE the SDK package
  // below.
  Copy({
    from: 'tm/' + target.name,
    exclude: [/src\//, /pkg\//, TEST_CONTROL_EXCLUDE],
    replace: {
      ...props.ctx$.stdrep,
    }
  })

  // Everything the SDK owns lives inside ONE package directory.
  //
  // core/, entity/, feature/ and utility/ used to sit at the language root
  // as top-level importable names. `core`, `entity` and `utility` are all
  // real PyPI distributions AND common scratch filenames, and Python puts
  // the working directory first on sys.path — so a single utility.py beside
  // a notebook shadowed ours and the SDK died on
  // `No module named 'utility.voxgig_struct'`. Nesting them behind the
  // model-named package makes that impossible.
  //
  // The public import is unchanged: `from <name>_sdk import <Name>SDK`,
  // because <name>_sdk.py becomes <name>_sdk/__init__.py.
  Folder({ name: pkgdir }, () => {

  Copy({
    from: 'tm/' + target.name + '/pkg',
    // An ACTIVE feature's INACTIVE plugins do not ship. py has no
    // src/feature layout (srcfeature: false), so this blanket pkg copy is
    // the one place the generate-time plugin trim can act; the model's
    // `plugin.<group>.path` entries name their files relative to THIS
    // copy's root ('feature/secrets/voxgig_sekreto/plugins/<kind>.py').
    // See helpers/featureSource.pluginExcludes.
    exclude: [...pluginExcludes(model)],
    replace: {
      ...props.ctx$.stdrep,
    }
  })

  // Generate main SDK file
  File({ name: '__init__.' + target.ext }, () => {

    Fragment(
      {
        from: Path.normalize(__dirname + '/../../../src/cmp/py/fragment/Main.fragment.py'),
        replace: {
          ...props.ctx$.stdrep,

          // SECRETS. Both slots are emitted only when the secrets feature
          // applies to this target AND the model activates it - an
          // unconditional edit would land in every generated SDK, and with
          // the feature off the marker line is REMOVED, so the inactive
          // output is byte-identical to pre-migration. `feature` is
          // already gated by targetFeatures, so a target that does not
          // provide 'sekreto' never reaches these.
          //
          // CUSTOM-REGEX keys, like Entity_py's hook markers: jostraca's
          // built-in `#Name` tag pattern is hardcoded to `//` comments,
          // so a bare '#SecretsAccessor' key would silently never match a
          // python `# #SecretsAccessor` marker line.

          // The LIVE Sekreto, not a clone: sekreto holds provider and
          // cache state, so a clone would resolve into a copy that
          // prepare_auth never sees.
          '/(?<indent>[ \\t]*)#[ \\t]*#SecretsAccessor[ \\t]*\\n?/':
            ({ indent }: any) => !secrets ? '' :
              `${indent}def secrets(self):\n` +
              `${indent}    _s = getattr(self, "_secrets", None)\n` +
              `${indent}    return None if _s is None else _s.sekreto()\n\n`,

          // prepare() bypasses the feature hook pipeline, so the PreSpec
          // hook that resolves the secret for entity ops never runs on
          // this path and the resolve has to be explicit. It RAISES on a
          // broken provider - prepare() already raises on prepare_auth
          // errors, so the direct path's error contract is unchanged.
          '/(?<indent>[ \\t]*)#[ \\t]*#SecretsResolve[ \\t]*\\n?/':
            ({ indent }: any) => !secrets ? '' :
              `${indent}if getattr(self, "_secrets", None) is not None:\n` +
              `${indent}    self._secrets.resolve()\n\n`,

          '#BuildFeatures': ({ indent }: any) => {
            each(feature, (feat: any) => {
              const fname = feat.name.charAt(0).toUpperCase() + feat.name.slice(1)
              Content({ indent }, `  # feature: ${feat.name}
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

    // Type-checker-only imports for the entity factory return annotations
    // (def <Entity>(...) -> "<Entity>Entity"). Guarded by TYPE_CHECKING so
    // there is no eager runtime import (the factories still import lazily in
    // their bodies); this lets mypy resolve list()/load() return types on
    // client.<Entity>() results — e.g. flagging `.data` on a list() result.
    const entnames = each(entity)
    if (entnames.length > 0) {
      Content(`

from typing import TYPE_CHECKING

if TYPE_CHECKING:
`)
      each(entity, (ent: any) => {
        Content(`    from ${model.const.Name.toLowerCase()}_sdk.entity.${ent.name}_entity import ${entityClassName(ent, entityCollection(model))}
`)
      })
    }
  })

  // Generate the typed-model module (<sdk>_types.py) next to the main SDK file.
  EntityTypes({ target })

  // PEP 561 marker so the inline type hints ship to consumers. Emitted at the
  // language root (documents intent for the top-level modules) and inside the
  // entity package (the type-bearing package, included via package-data).
  File({ name: 'py.typed' }, () => {
    Content(``)
  })

  // Generate config module
  Folder({ name: '.' }, () => {
    Config({ target })
  })

  // Generate feature factory module
  File({ name: 'features.' + target.ext }, () => {
    Content(`# ${model.const.Name} SDK feature factory

from ${model.const.Name.toLowerCase()}_sdk.feature.base_feature import ${model.const.Name}BaseFeature
`)

    each(feature, (feat: any) => {
      if (feat.name !== 'base') {
        const fname = feat.name.charAt(0).toUpperCase() + feat.name.slice(1)
        Content(`from ${model.const.Name.toLowerCase()}_sdk.feature.${feat.name}_feature import ${model.const.Name}${fname}Feature
`)
      }
    })

    Content(`

_FEATURES = {
    "base": lambda: ${model.const.Name}BaseFeature(),
`)

    each(feature, (feat: any) => {
      if (feat.name !== 'base') {
        const fname = feat.name.charAt(0).toUpperCase() + feat.name.slice(1)
        Content(`    "${feat.name}": lambda: ${model.const.Name}${fname}Feature(),
`)
      }
    })

    Content(`}


def _make_feature(name):
    factory = _FEATURES.get(name)
    if factory is not None:
        return factory()
    return _FEATURES["base"]()


# True when this SDK was generated with the named feature class - the
# constructor's tolerance for extend-carried features reads this (an
# active name with no generated class must not become a BaseFeature
# stray when an extend instance carries it).
def _has_feature(name):
    return name in _FEATURES
`)
  })

  // Generate __init__.py files for sub-packages.
  // NOTE: deliberately omit __init__.py at the language-root (py/) level —
  // making py/ a package collides with the third-party `py` module on PyPI
  // (a single-file `py.py`), which causes pytest to construct test module
  // paths as `py.test.<file>` and fail with "'py' is not a package".
  Folder({ name: 'core' }, () => {
    File({ name: '__init__.' + target.ext }, () => {
      Content(``)
    })
  })

  Folder({ name: 'entity' }, () => {
    File({ name: '__init__.' + target.ext }, () => {
      Content(``)
    })
    // PEP 561 marker inside the type-bearing package so setuptools package-data
    // ("*" = ["py.typed"]) bundles it into the wheel.
    File({ name: 'py.typed' }, () => {
      Content(``)
    })
  })

  Folder({ name: 'feature' }, () => {
    File({ name: '__init__.' + target.ext }, () => {
      Content(``)
    })
  })

  Folder({ name: 'utility' }, () => {
    File({ name: '__init__.' + target.ext }, () => {
      Content(``)
    })
  })

  })

})


export {
  Main
}
