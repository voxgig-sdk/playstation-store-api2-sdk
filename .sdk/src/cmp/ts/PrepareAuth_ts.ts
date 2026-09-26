
import {
  Content,
  File,
  Folder,
  cmp,
  isAuthSuppressed,
  isHttpBasicAuth,
  resolveAuthIn,
  resolveAuthName,
  resolveAuthPrefix,
} from '@voxgig/sdkgen'


const PrepareAuth = cmp(async function PrepareAuth(props: any) {
  const { target } = props
  const { model } = props.ctx$

  const suppressed = isAuthSuppressed(model)
  const where = resolveAuthIn(model)
  const resolvedName = resolveAuthName(model)
  const name = 'header' === where ? resolvedName.toLowerCase() : resolvedName
  const prefix = resolveAuthPrefix(model)
  const basic = isHttpBasicAuth(model)

  Folder({ name: 'utility' }, () => {
    File({ name: 'PrepareAuthUtility.' + target.ext }, () => {
      Content(render({ suppressed, where, name, prefix, basic }))
    })
  })
})


function render(spec: {
  suppressed: boolean, where: string, name: string, prefix: string, basic: boolean
}): string {
  const head = `
import { Context, Spec } from '../types'

`


  // Auth switched off outright by the project. The credential-placing
  // body would be dead code, so it is not emitted — but the function
  // stays, because makeSpec calls it unconditionally.
  if (spec.suppressed) {
    return head + `
function prepareAuth(ctx: Context): Spec | Error {
  const spec = ctx.spec

  if (null == spec) {
    return ctx.error('auth_no_spec', 'Expected context spec property to be defined.')
  }

  return spec
}


export {
  prepareAuth
}
`
  }

  const preamble = `
const CRED_name = '${jsstr(spec.name)}'
${'cookie' === spec.where ? `
const COOKIE_header = 'cookie'
` : ''}
const OPTION_apikey = 'apikey'
const OPTION_secret = 'secret'

const NOTFOUND = '__NOTFOUND__'


function prepareAuth(ctx: Context): Spec | Error {
  const utility = ctx.utility

  const struct = utility.struct
  const getprop = struct.getprop
  const setprop = struct.setprop
  const delprop = struct.delprop

  const client = ctx.client
  const spec = ctx.spec

  if (null == spec) {
    return ctx.error('auth_no_spec', 'Expected context spec property to be defined.')
  }

  const ${target(spec.where)} = spec.${target(spec.where)}
${cookieHelper(spec.where)}
  const options = client.options()

  // Public APIs that need no auth omit the options.auth block entirely.
  if (null == options.auth) {
    ${clear(spec.where)}
    return spec
  }

  const prefix = options.auth.prefix

  const apikey = getprop(options, OPTION_apikey, NOTFOUND)
`

  // HTTP Basic is header-only by definition: the scheme is
  // `Authorization: Basic base64(user:pass)`. It cannot be expressed as a
  // query parameter or a cookie, so the branch is emitted only where it
  // can mean something.
  const basicBlock = (spec.basic && 'header' === spec.where) ? `
  // True HTTP Basic Auth needs TWO credentials, base64-joined - a single
  // token in the header (the branch below) can never authenticate against
  // an API that actually checks \`Authorization: Basic base64(user:pass)\`.
  if (true === options.auth.basic) {
    const secret = getprop(options, OPTION_secret, NOTFOUND)
    const noApikey = NOTFOUND === apikey || null == apikey || '' === apikey
    const noSecret = NOTFOUND === secret || null == secret || '' === secret

    if (noApikey || noSecret) {
      delprop(headers, CRED_name)
    }
    else {
      const b64 = Buffer.from(apikey + ':' + secret).toString('base64')
      setprop(headers, CRED_name, prefix ? prefix + ' ' + b64 : b64)
    }

    return spec
  }
` : ''

  return head + preamble + basicBlock + `
  if (NOTFOUND === apikey || null == apikey || '' === apikey) {
    ${clear(spec.where)}
  }
  else {
${place(spec.where)}
  }

  return spec
}


export {
  prepareAuth
}
`
}


function target(where: string): string {
  return 'query' === where ? 'query' : 'headers'
}


// A cookie has no header of its own: place() writes it into `cookie` as
// `CRED_name=value`, so clear() must free that slot, not CRED_name.
function clear(where: string): string {
  if ('query' === where) {
    return 'delprop(query, CRED_name)'
  }

  if ('cookie' === where) {
    return 'cookieSet(headers, null)'
  }

  return 'delprop(headers, CRED_name)'
}


function cookieHelper(where: string): string {
  if ('cookie' !== where) {
    return ''
  }

  return `
  function cookieSet(headers: any, value: any) {
    const existing = getprop(headers, COOKIE_header, '')
    const kept: string[] = []

    if ('string' === typeof existing && '' !== existing) {
      for (const part of existing.split(';')) {
        const piece = part.trim()
        if ('' === piece || piece === CRED_name || piece.startsWith(CRED_name + '=')) {
          continue
        }
        kept.push(piece)
      }
    }

    if (null != value) {
      kept.push(CRED_name + '=' + value)
    }

    if (0 === kept.length) {
      delprop(headers, COOKIE_header)
    }
    else {
      setprop(headers, COOKIE_header, kept.join('; '))
    }
  }
`
}


function place(where: string): string {
  if ('query' === where) {
    return `    setprop(query, CRED_name, apikey)`
  }

  if ('cookie' === where) {
    return `    cookieSet(headers, apikey)`
  }

  return `    // A raw credential (empty prefix, e.g. an apiKey scheme) must go in
    // as-is; only a non-empty prefix (Bearer/Basic/OAuth) is space-joined.
    setprop(headers, CRED_name, prefix ? prefix + ' ' + apikey : apikey)`
}


function jsstr(s: string): string {
  return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}


export {
  PrepareAuth
}
