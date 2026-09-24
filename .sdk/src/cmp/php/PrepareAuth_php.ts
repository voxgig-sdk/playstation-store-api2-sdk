
import {
  Content,
  File,
  Folder,
  cmp,
  isHttpBasicAuth,
  resolveAuthIn,
  resolveAuthName,
  resolveAuthPrefix,
} from '@voxgig/sdkgen'


import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'


const PrepareAuth = cmp(async function PrepareAuth(props: any) {
  const { target } = props
  const { model } = props.ctx$

  Folder({ name: 'utility' }, () => {
    File({ name: 'PrepareAuth.' + target.ext }, () => {
      Content(render({
        Name: model.const.Name,
        active: authSwitchedOn(model),
        where: resolveAuthIn(model),
        name: resolveAuthName(model),
        basic: isHttpBasicAuth(model),
        prefix: resolveAuthPrefix(model),
      }))
    })
  })
})


function authSwitchedOn(model: any): boolean {
  const auth = getModelPath(model, `main.${KIT}.config.auth`,
    { only_active: false, required: false })
  return !(null != auth && false === auth.active)
}


type AuthSpec = {
  Name: string,
  active: boolean,
  where: string,
  name: string,
  basic: boolean,
  prefix: string,
}


function render(spec: AuthSpec): string {
  const Name = spec.Name

  const head = `<?php
declare(strict_types=1);

// ${Name} SDK utility: prepare_auth

`

  if (!spec.active) {
    return head + `// This SDK is configured with authentication off, so there is no
// credential to place. The class stays in the pipeline because make_spec
// calls prepare_auth unconditionally.
class ${Name}PrepareAuth
{
    public static function call(${Name}Context $ctx): array
    {
        $spec = $ctx->spec;
        if (!$spec) {
            return [null, $ctx->make_error('auth_no_spec', 'Expected context spec property to be defined.')];
        }

        return [$spec, null];
    }
}
`
  }

  const bag = bagVar(spec.where)

  return head + `class ${Name}PrepareAuth
{
${constants(spec)}
    public static function call(${Name}Context $ctx): array
    {
        $spec = $ctx->spec;
        if (!$spec) {
            return [null, $ctx->make_error('auth_no_spec', 'Expected context spec property to be defined.')];
        }

        $${bag} = &$spec->${bag};
        $options = $ctx->client->options_map();

        // Public APIs that need no auth omit the options.auth block entirely.
        if (!isset($options['auth']) || $options['auth'] === null) {
${suppressed(spec.where)}            return [$spec, null];
        }

        $apikey = \\Voxgig\\Struct\\Struct::getprop($options, self::OPTION_APIKEY, self::NOT_FOUND);
${basicBlock(spec)}${placeBlock(spec)}
        return [$spec, null];
    }
}
`
}


// The bag the credential lands in, per placement. Cookies ride the header
// bag because a cookie IS a header.
function bagVar(where: string): string {
  return 'query' === where ? 'query' : 'headers'
}


function credConst(where: string): string {
  return 'query' === where ? 'QUERY_AUTH' : 'cookie' === where ? 'COOKIE_AUTH' : 'HEADER_AUTH'
}


function constants(spec: AuthSpec): string {
  const name = 'header' === spec.where ? spec.name.toLowerCase() : spec.name

  const cookieConst = 'cookie' === spec.where ?
    `    private const HEADER_COOKIE = 'cookie';\n` : ''

  const secretConst = basicActive(spec) ?
    `    private const OPTION_SECRET = 'secret';\n` : ''

  return `    private const ${credConst(spec.where)} = ${phpstr(name)};
${cookieConst}    private const OPTION_APIKEY = 'apikey';
${secretConst}    private const NOT_FOUND = '__NOTFOUND__';
`
}


function suppressed(where: string): string {
  if ('cookie' === where) {
    // NOTHING TO CLEAR. The cookie header may carry the caller's own
    // cookies, and this SDK has not written a pair of its own into this
    // spec, so removing the header would throw away someone else's state.
    return ''
  }
  return `            unset($${bagVar(where)}[self::${credConst(where)}]);\n`
}


// HTTP Basic is header-only by definition: the scheme is
// `Authorization: Basic base64(user:pass)`. It cannot be expressed as a
// query parameter or a cookie, so the branch is emitted only where it can
// mean something.
function basicActive(spec: AuthSpec): boolean {
  return spec.basic && 'header' === spec.where
}


function basicBlock(spec: AuthSpec): string {
  if (!basicActive(spec)) {
    return ''
  }

  return `
        // True HTTP Basic Auth needs TWO credentials, base64-joined - a
        // single token in the header (the branch below) can never
        // authenticate against an API that actually checks
        // \`Authorization: Basic base64(user:pass)\`.
        if (true === (\\Voxgig\\Struct\\Struct::getpath($options, 'auth.basic') ?? false)) {
            $secret = \\Voxgig\\Struct\\Struct::getprop($options, self::OPTION_SECRET, self::NOT_FOUND);
            $apikey_val = is_string($apikey) && $apikey !== self::NOT_FOUND ? $apikey : '';
            $secret_val = is_string($secret) && $secret !== self::NOT_FOUND ? $secret : '';

            if ($apikey_val === '' || $secret_val === '') {
                unset($headers[self::HEADER_AUTH]);
            } else {
                $auth_prefix = \\Voxgig\\Struct\\Struct::getpath($options, 'auth.prefix') ?? '';
                $b64 = base64_encode("{$apikey_val}:{$secret_val}");
                $headers[self::HEADER_AUTH] = $auth_prefix === ''
                    ? $b64 : "{$auth_prefix} {$b64}";
            }

            return [$spec, null];
        }
`
}


function placeBlock(spec: AuthSpec): string {
  const missing = `(is_string($apikey) && ($apikey === self::NOT_FOUND || $apikey === ''))
            || $apikey === null`

  if ('cookie' === spec.where) {
    return `
        $missing = ${missing};

        if (!$missing) {
            // A COOKIE IS APPENDED, NEVER ASSIGNED: the header may already
            // carry the caller's own cookies, and one \`Cookie:\` header
            // holds all of them, separated by '; '.
            $apikey_val = is_string($apikey) ? $apikey : '';
            $existing = $headers[self::HEADER_COOKIE] ?? '';
            $pair = self::COOKIE_AUTH . '=' . $apikey_val;
            $headers[self::HEADER_COOKIE] = $existing === ''
                ? $pair : "{$existing}; {$pair}";
        }
`
  }

  if ('query' === spec.where) {
    return `
        if (
            ${missing}
        ) {
            unset($query[self::QUERY_AUTH]);
        } else {
            // NO PREFIX IN A QUERY STRING. \`?token=Bearer%20abc\` is not a
            // thing any API reads; the prefix is a header convention and is
            // dropped here deliberately rather than silently concatenated.
            $query[self::QUERY_AUTH] = is_string($apikey) ? $apikey : '';
        }
`
  }

  return `
        if (
            ${missing}
        ) {
            unset($headers[self::HEADER_AUTH]);
        } else {
            $auth_prefix = \\Voxgig\\Struct\\Struct::getpath($options, 'auth.prefix') ?? '';
            $apikey_val = is_string($apikey) ? $apikey : '';
            // Empty prefix (raw apiKey credential) must not add a leading space.
            $headers[self::HEADER_AUTH] = $auth_prefix === ''
                ? $apikey_val : "{$auth_prefix} {$apikey_val}";
        }
`
}


function phpstr(s: string): string {
  return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"
}


export {
  PrepareAuth,
  render,
}
