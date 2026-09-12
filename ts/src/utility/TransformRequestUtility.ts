
import { Context } from '../types'

/* Convert entity data or match query into a srtucture suitable for use as request data.
 *
 * The operation (op) property `reqform` is used to perform the data preparation.
 */
function transformRequest(ctx: Context) {
  const spec = ctx.spec
  const utility = ctx.utility
  const point = ctx.point
  const isfunc = utility.struct.isfunc
  const transform = utility.struct.transform

  if (spec) {
    spec.step = 'reqform'
  }

  try {
    const reqform = point.transform.req
    const reqdata = isfunc(reqform) ? reqform(ctx) : transform({
      reqdata: ctx.reqdata
    }, reqform)

    return stripAction(reqdata)
  }
  catch (err) {
    return utility.makeError(ctx, err)
  }
}



// `$action` selects WHICH POINT of the op to use (see MakePointUtility). It
// is the SDK's own discriminator, never an API field, so it must not survive
// into the wire body. The GraphQL path already strips it where it builds its
// input object; this is the same rule on the REST path, which had no such
// step and sent it verbatim -- `{"$action":"merge", ...}` to GitHub's merge
// endpoint. Harmless there, because GitHub ignores unknown keys; not
// harmless against an API that validates its request bodies strictly.
//
// Only a top-level key of a plain object: a body may legitimately be an
// array or a scalar, and neither can carry a selector.
//
// `__proto__` is assigned through Object.defineProperty, never `body[key] =`.
// It is a legal JSON key and can be a real API field, but plain assignment
// invokes the inherited setter: the key would vanish from the serialised
// request and silently become the body's prototype instead. Same treatment
// as StructUtility's condenseSet, for the same reason.

function stripAction(reqdata: any) {
  if (null == reqdata || 'object' !== typeof reqdata || Array.isArray(reqdata)) {
    return reqdata
  }

  if (!Object.prototype.hasOwnProperty.call(reqdata, '$action')) {
    return reqdata
  }

  const body: Record<string, any> = {}
  for (const key of Object.keys(reqdata)) {
    if ('$action' === key) {
      continue
    }
    if ('__proto__' === key) {
      Object.defineProperty(body, key, {
        value: reqdata[key],
        enumerable: true,
        writable: true,
        configurable: true,
      })
    }
    else {
      body[key] = reqdata[key]
    }
  }

  return body
}

export {
  transformRequest
}
