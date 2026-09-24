
import {
  Content,
  File,
  cmp,
  each,
  omap,
  packageName,
  pkgDescription,
  keywords,
  repoInfo,
  PUBLISHER,
  PUBLISHER_URL,
  packageVersion,
  authorInfo,
  targetFeatures, envName,
  hasLiveScenarios,
} from '@voxgig/sdkgen'


import {
  KIT,
  Model,
  getModelPath,
  nom,
} from '@voxgig/apidef'


const Package = cmp(async function Package(props: any) {
  const ctx$ = props.ctx$
  const target = props.target

  const model: Model = ctx$.model

  // WHO WROTE THIS PACKAGE. Per target, falling back to the model-wide value
  // and then to the publisher — so a manifest cannot go on naming Voxgig
  // while the model names someone else, which is exactly what the hardcoded
  // constant here did.
  const author = authorInfo(model, target.name)

  // Gated by applicability: a feature that does not apply to this
  // target must not inject its deps into the generated manifest.
  const feature = targetFeatures(model, target)

  const only = (kind: string, deps: any) =>
    omap(deps, ([k, v]: any) => [v.active && kind === v.kind ? k : undefined, v.version])

  const deps =
    each(feature, (feature: any) =>
      omap(feature.deps?.[target.name], ([k, v]: any) =>
        [v.active ? k : undefined, v]))

      .reduce((a: any, deps: any) => (each(deps, (dep: any) =>
        a[dep.kind][dep.key$] = dep.version), a),
        {
          prod: only('prod', target.deps),
          peer: only('peer', target.deps),
          dev: only('dev', target.deps),
        })

  const SdkName = nom(model, 'Name')
  const { repoUrl, issuesUrl } = repoInfo(model)

  const pkg = {
    name: packageName(model, target.name),
    version: packageVersion(model, target.name),
    description: pkgDescription(model, target.name),
    keywords: keywords(model),
    homepage: `${repoUrl}#readme`,
    repository: { type: 'git', url: `git+${repoUrl}.git` },
    bugs: { url: issuesUrl },
    main: `dist/${SdkName}SDK.js`,
    type: 'commonjs',
    types: `dist/${SdkName}SDK.d.ts`,

    files: ['dist', 'src'],
    scripts: {
      ...(hasLiveScenarios(model) ? {
        'test:live': `npm run build && ${envName(model)}_TEST_LIVE=TRUE node --test dist-test/live.test.js`,
      } : {}),

      'pretest': 'npm run build',
      'test': 'node --enable-source-maps --test-concurrency=1 --test \'dist-test/**/*.test.js\'',
      'test-some': 'node --enable-source-maps --experimental-test-isolation=none ' +
        '--test-name-pattern=\"$TEST_PATTERN\" --test \'dist-test/**/*.test.js\'',
      'test-utility': 'node --enable-source-maps --test test/utility/*.test.ts',

      'pretest-coverage': 'npm run build',
      'test-coverage': 'node --test-concurrency=1 --experimental-test-coverage ' +
        '--test-coverage-exclude=\'**/dist-test/**\' ' +
        '--test-coverage-lines=85 --test-coverage-branches=68 --test-coverage-functions=88 ' +
        '--test \'dist-test/**/*.test.js\'',

      "watch": "tsc --build src test -w",
      // Prune compiled output before building: `tsc --build` is incremental and
      // never deletes .js for a removed source, so entity tests that the model
      // folds away would otherwise keep running from stale dist-test/ and fail.
      "build": "rm -rf dist dist-test && tsc --build src test",
      "clean": "rm -rf node_modules yarn.lock package-lock.json dist dist-test",
      "reset": "npm run clean && npm i && npm run build && npm test",
    },
    author,

    license: 'MIT',

    dependencies: deps.prod,
    peerDependencies: deps.peer,
    devDependencies: deps.dev,
  }

  File({ name: 'package.json' }, () => {
    Content(JSON.stringify(pkg, null, 2) + '\n')
  })
})


export {
  Package
}
