
import { Context } from './Context'


class PlaystationStoreApi2Error extends Error {

  isPlaystationStoreApi2Error = true

  sdk = 'PlaystationStoreApi2'

  code: string
  ctx: Context

  constructor(code: string, msg: string, ctx: Context) {
    super(msg)
    this.code = code
    this.ctx = ctx
  }

}

export {
  PlaystationStoreApi2Error
}

