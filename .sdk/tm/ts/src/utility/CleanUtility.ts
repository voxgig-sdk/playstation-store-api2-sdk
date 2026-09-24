
import { Context } from '../types'


import {
  walk, size, pad, slice, clone
} from './StructUtility'


// Clean request data by partially hiding sensitive values.
function clean(ctx: Context, val: any) {
  const options = ctx.options

  const cleankeyre = options?.__derived__?.clean?.keyre
  const hintsize = 4


  return val
}


export {
  clean
}
