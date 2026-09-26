
// Import-free, so the scaffold's own tests can load it without the toolchain.


type Place = 'folder' | 'root'


type RootPlan = {
  top: boolean
  build: boolean

  // Generated targets only: absent means not generated at all.
  place: Record<string, Place>
}


type Fail = new (message: string) => Error


function rootPlan(kit: any, Fail: Fail = Error): RootPlan {
  const phase = kit?.phase || {}
  const phaseActive = (name: string): boolean =>
    false !== (phase[name] && phase[name].active)

  const top = phaseActive('top')
  const build = phaseActive('build')

  const target = kit?.target || {}
  const place: Record<string, Place> = {}

  for (const name of Object.keys(target).sort()) {
    if (null != target[name] && false !== target[name].active) {
      place[name] = true === target[name].output?.root ? 'root' : 'folder'
    }
  }

  const atRoot = Object.keys(place).filter((name: string) => 'root' === place[name])

  if (1 < atRoot.length) {
    throw new Fail(
      'Only one target can be generated at the project root, and ' +
      atRoot.length + ' declare `output: root: true`: ' + atRoot.join(', ') + '.')
  }

  if (1 === atRoot.length && top) {
    throw new Fail(
      'Target "' + atRoot[0] + '" is generated at the project root, where the ' +
      'SDK repository files (README, LICENSE, Makefile, workflows) would ' +
      'overwrite its own. Declare `main: kit: phase: top: active: false` in ' +
      'model/project.aontu.')
  }

  return { top, build, place }
}


export type {
  Place,
  RootPlan,
}

export {
  rootPlan,
}
