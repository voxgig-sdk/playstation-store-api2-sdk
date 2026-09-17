
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


// WHERE THE CREDENTIAL GOES IS A FACT ABOUT THE API, so it is generated
// rather than templated.
//
// This was a static file in `tm/php/utility/` that hardcoded an
// `authorization` HEADER. apidef has always resolved the scheme's `in` and
// `name` into `main.kit.info.security` — joplin's says
// `in: "query", name: "token"` — and generation dropped both. The result
// was an SDK that sent a header the API does not read and never sent the
// query parameter it does, so it could not authenticate at all. Four repos
// in the cedar fleet shipped that way: joplin (`token`), pipedrive
// (`api_token`), trello (`key`), lm-umbrella (`apiKey`).
//
// A template cannot fix this, because the three placements need three
// different bodies and a template has to pick one. A component emits the
// branch this API actually uses and nothing else — no dead query code in a
// bearer-token SDK, and no runtime `if` on a value that is fixed at
// generation time.
//
// The php peer of cmp/ts/PrepareAuth_ts.ts.
const PrepareAuth = cmp(async function PrepareAuth(props: any) {
  const { target } = props
  const { model } = props.ctx$

  // FOLDER NESTING. Main_php opens NO folder around its children — it
  // writes `<sdk>_sdk.php`, `features.php` and (inside `Folder('.')`)
  // `config.php` straight into the target root, and each sibling component
  // opens its own single level (EntityTypes -> `types/`, Entity ->
  // `entity/`, Test -> `test/`). The template this replaces lived at
  // `tm/php/utility/PrepareAuth.php` and the blanket Copy puts `tm/php/*`
  // at the target root, so the generated file belongs at `utility/`, one
  // folder deep. (This is NOT the ts layout: there Main already opens
  // `src`, so PrepareAuth_ts must not open a second one.)
  Folder({ name: 'utility' }, () => {
    File({ name: 'PrepareAuth.' + target.ext }, () => {
      Content(render({
        Name: model.const.Name,
        active: authSwitchedOn(model),
        where: resolveAuthIn(model),
        name: resolveAuthName(model),
        basic: isHttpBasicAuth(model),
        // Read so the resolution is exercised here too, even though the
        // prefix is a RUNTIME option (`options.auth.prefix`, emitted by
        // Config_php) rather than something baked into this file.
        prefix: resolveAuthPrefix(model),
      }))
    })
  })
})


// NOT `isAuthActive`, AND THE DIFFERENCE IS LOAD-BEARING (the py port found
// this first; same reasoning, same fix, and php's own lane proves it here).
//
// `isAuthActive` is false whenever the SPEC declares no security scheme
// (`main.kit.info.auth: false`). That is a statement about the DEFINITION,
// not a ban on ever sending a credential: apidef writes it for every spec
// with no securitySchemes block, GitHub's official OpenAPI included, and
// those SDKs are still expected to honour an `apikey` the caller passes.
// The template placed the credential unconditionally, so they did.
//
// Gating the body on `isAuthActive` therefore does not trim dead code, it
// deletes working authentication. MEASURED, not assumed: with the wider gate
// this component emitted the no-op for generatedcompile's own fixture
// (`main: kit: info: { ... auth: false }`) and the php lane went red —
//
//   php: auth null beats an explicit apikey
//     FAIL: baseline broken: an ordinary apikey was not sent
//
// So the no-op is emitted only when the PROJECT says so:
// `config.auth.active: false`, an explicit per-SDK switch nobody sets by
// accident. A spec that is merely silent keeps the credential path it has
// always had.
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

  // AUTH SWITCHED OFF BY THE PROJECT (see authSwitchedOn for why only an
  // EXPLICIT switch counts). The SDK gets a prepare_auth that is honest
  // about it rather than one that deletes a header nobody set.
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


// The constant holding the credential's NAME, per placement. `HEADER_AUTH`
// keeps the name the template used, so a header SDK regenerates unchanged.
function credConst(where: string): string {
  return 'query' === where ? 'QUERY_AUTH' : 'cookie' === where ? 'COOKIE_AUTH' : 'HEADER_AUTH'
}


function constants(spec: AuthSpec): string {
  // A HEADER NAME GOES IN LOWERCASE, as every target's template has always
  // written it (`authorization`): request header names are case-insensitive,
  // and this SDK's own response headers are lowercased by the fetcher, so
  // lowercasing here keeps one spelling throughout — and keeps the default
  // byte-identical to the template this replaces. A query parameter and a
  // cookie name are CASE-SENSITIVE, so those go in verbatim.
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


// The `options.auth` block is absent (`auth: null`) — drop any stale
// credential the caller's own options put in the bag.
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
    // A MISSING CREDENTIAL CLEARS NOTHING HERE, for the reason `suppressed`
    // gives: the cookie header is shared with the caller's own cookies.
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


// A PHP single-quoted string literal: only the backslash and the quote
// itself need escaping, and single quotes never interpolate a `$name`.
function phpstr(s: string): string {
  return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"
}


export {
  PrepareAuth,
  // Exported so the emitted PHP can be exercised directly (tests, and a
  // one-line check of what a given placement renders) without standing up a
  // full generation run.
  render,
}
