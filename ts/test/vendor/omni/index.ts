// VENDORED: @voxgig/omni 0.1.4 (typescript/src/index.ts)
// Source: https://github.com/voxgig/omni @ 274708cc2d12b21707d975543953f845f8444be0  [tag: sdk-20260911-2013-0]
// License: MIT (c) voxgig - see repository LICENSE. Do not edit: resync from upstream.
// @voxgig/omni - shared multi-language test runner.

export {
  CAPABILITIES,
  EXISTSMARK,
  NULLMARK,
  OmniError,
  SPECVERSION,
  UNDEFMARK,
  errify,
  fixjson,
  loadspec,
  makeRunner,
  match,
  matchval,
  nullmodifier,
  resolvespec,
} from './Runner'

export type { Flags, Provider, RunPack, RunSet, RunSetFlags, Runner, Subject } from './Runner'

export {
  clone,
  deepequal,
  getpath,
  islist,
  ismap,
  isnode,
  jsonstr,
  pathify,
  stringify,
  walk,
} from './Util'

export type { Json } from './Util'
