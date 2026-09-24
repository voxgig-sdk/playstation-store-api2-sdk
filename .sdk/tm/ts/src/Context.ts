
import { inspect } from 'node:util'

import { PlaystationStoreApi2SDK } from './PlaystationStoreApi2SDK'
import { PlaystationStoreApi2Error } from './PlaystationStoreApi2Error'

import { Utility } from './utility/Utility'
import { getprop, setprop, getpath } from './utility/StructUtility'

import { Operation } from './Operation'
import { Response } from './Response'
import { Result } from './Result'
import { Spec } from './Spec'


class Context {

  id = 'C' + ('' + Math.random()).substring(2, 10)

  // Store the output of each operation step.
  out: Record<string, any> = {}

  // Store for the current operation.
  current: WeakMap<String, any> = new WeakMap()


  ctrl: Record<string, any> = {}
  meta: Record<string, any> = {}

  client: PlaystationStoreApi2SDK
  utility: Utility

  op: Operation
  point: any

  config: Record<string, any>
  entopts: Record<string, any>
  options: Record<string, any>

  opmap: Record<string, Operation>

  response?: Response
  result?: Result
  spec?: Spec

  data?: any
  reqdata?: any
  match?: any
  reqmatch?: any

  entity?: any

  // Shared persistent store.
  shared: WeakMap<String, any>


  constructor(ctxmap: Record<string, any>, basectx?: Context) {
    this.client = getprop(ctxmap, 'client', getprop(basectx, 'client'))
    this.utility = getprop(ctxmap, 'utility', getprop(basectx, 'utility'))

    // An operation gets its OWN control unless the caller passed one: a
    // paging cursor left on the client's control would otherwise be picked
    // up by the next, unrelated call. A context with no opname is not an
    // operation, so it still shares (an entity's, with the client's).
    const opname = getprop(ctxmap, 'opname')
    const basectrl = null == opname ? getprop(basectx, 'ctrl', this.ctrl) : this.ctrl
    this.ctrl = getprop(ctxmap, 'ctrl', basectrl)
    this.meta = getprop(ctxmap, 'meta', getprop(basectx, 'meta', this.meta))

    this.config = getprop(ctxmap, 'config', getprop(basectx, 'config'))
    this.entopts = getprop(ctxmap, 'entopts', getprop(basectx, 'entopts'))
    this.options = getprop(ctxmap, 'options', getprop(basectx, 'options'))

    this.entity = getprop(ctxmap, 'entity', getprop(basectx, 'entity'))
    this.shared = getprop(ctxmap, 'shared', getprop(basectx, 'shared'))
    this.opmap = getprop(ctxmap, 'opmap', getprop(basectx, 'opmap'))

    this.data = getprop(ctxmap, 'data', {})
    this.reqdata = getprop(ctxmap, 'reqdata', {})
    this.match = getprop(ctxmap, 'match', {})
    this.reqmatch = getprop(ctxmap, 'reqmatch', {})

    this.point = getprop(ctxmap, 'point', getprop(basectx, 'point'))
    this.spec = getprop(ctxmap, 'spec', getprop(basectx, 'spec'))
    this.result = getprop(ctxmap, 'result', getprop(basectx, 'result'))
    this.response = getprop(ctxmap, 'response', getprop(basectx, 'response'))

    this.op = this.resolveOp(opname)
  }


  resolveOp(opname: string): Operation {
    const entname = getprop(this.entity, 'name', '')
    const cacheKey = entname + ':' + opname
    let op: Operation = getprop(this.opmap, cacheKey)

    if (null == op && null != opname) {
      const opcfg = getpath(this.config, ['entity', entname, 'op', opname])
      let input = 'match'

      if ('update' === opname || 'create' === opname) {
        input = 'data'
      }

      op = new Operation({
        entity: entname,
        name: opname,
        input,
        points: getprop(opcfg, 'points', [])
      })

      setprop(this.opmap, cacheKey, op)
    }

    return op
  }


  error(code: string, msg: string) {
    return new PlaystationStoreApi2Error(code, msg, this)
  }


  toJSON() {
    return {
      id: this.id,
      op: this.op,
      spec: this.spec,
      entity: this.entity,
      result: this.result,
      response: this.response,
      meta: this.meta,
    }
  }

  toString() {
    return 'Context ' + (this as any).utility?.struct.jsonify(this.toJSON())
  }

  [inspect.custom]() {
    return this.toString()
  }

}


export {
  Context,
}
