<?php
declare(strict_types=1);

// The corpus test runner: vendored Voxgig\Omni driven through its NATIVE
// API (`Runner::makeRunner($specref, $provider)`), presented to the corpus
// tests in the struct-runner shape they already use (`$R['spec']`,
// `$R['runset']`, `$R['runsetflags']`, `$R['client']`). No compat shim is
// vendored: the adapter below IS the whole bridge, per language, per the
// vendor-tag rollout (docs/design/vendor-tag-rollout.md, Decision 4). It is
// the PHP peer of tm/py/test/omni.py and tm/go/test/omniresolver_test.go.
//
// PHP-specific decisions, each load-bearing:
//
// 1. SPEC PATH. omni expects a usable path; a relative one is absolutized
//    against THIS file's directory (test/), so the existing
//    '../../.sdk/test/test.json' constant works from any working directory.
//
// 2. CONTEXTS STAY MAPS ACROSS THE RUNNER - WITH REFERENCE SLOTS. omni
//    sets `entry.ctx` to the contextified args[0], and `match: {ctx: ...}`
//    reads THROUGH it with omni's own getpath, which walks PHP ARRAYS
//    only - a typed PlaystationStoreApi2Context there would make every ctx
//    assertion read "absent". So contextify returns the MAP, a subject
//    builds the typed context with `ctx_from_map` at the call site, runs
//    the utility, and writes the observable state back with `sync_ctx`
//    (go's maps-plus-sync idiom). PHP arrays are copy-on-write VALUE
//    types, so a plain map's post-execution writes would be invisible to
//    the copy `entry.ctx` holds - `ctxview` therefore makes every element
//    a REFERENCE into one shared frame: all the copies omni hands around
//    (args[0], entry.ctx, the subject's parameter) read and write the
//    same slots. Keys a sync may CREATE (spec/result/response) are
//    pre-seeded with omni's own Absent sentinel, which every match branch
//    already treats as "genuinely missing" - so `__EXISTS__` still fails
//    until the subject really produced the value.
//
// 3. NO-ARGUMENT ENTRIES. Corpus entries with no `in`, `args` or `ctx`
//    mean "call the subject with NO argument". PHP cannot spell that
//    against fixed-arity subjects (ArgumentCountError), so the upstream
//    php compat shim's correction is ported here: such entries are
//    rewritten IN MEMORY to `args: [Struct::undef()]` - the port's own
//    no-value sentinel, which typifies as T_noval, the canonical reading.
//
// 4. THE EMPTY-MAP COLLAPSE (struct lane only). PHP is the one port that
//    cannot tell `{}` from `[]` after `json_decode($json, true)`: both
//    become `[]`, and the vendored struct reads `[]` as an empty LIST.
//    The struct corpus carries hundreds of empty maps, so the struct-lane
//    loader (`makeStructRunner`) decodes with objects preserved, converts
//    to omni's array model, and keeps an empty map as a MARKER string
//    resolved at the last boundary: to a real `stdClass` inside subject
//    arguments, to `[]` everywhere the comparison looks (ported from
//    upstream omni's php compat shim). The SDK lane (`makeRunner`) keeps
//    omni's plain decode - the generated utilities speak arrays, exactly
//    what the retired inline engine fed them.
//
// 5. THE VENDORED PHP PORT LACKS THE omni#54 RUNNER FIXES the TypeScript
//    port has at this tag (omni#57 tracks porting them): jsonstr has no
//    cycle guard and match clones its base. Both only bite on CYCLIC
//    values, and this port's clone/fixjson walk ARRAYS only, passing
//    objects through by reference - so decision 2 (JSON-only maps in
//    entries, typed state kept out of them) is also what keeps every
//    value the runner clones or stringifies acyclic. The errify half
//    (non-Error throwables) cannot arise: PHP only throws \Throwable.

require_once __DIR__ . '/vendor/omni/Runner.php';
require_once __DIR__ . '/../utility/struct/Struct.php';

use Voxgig\Omni\Absent;
use Voxgig\Omni\OmniError;
use Voxgig\Omni\Runner as OmniRunner;
use Voxgig\Omni\Util as OmniUtil;
use Voxgig\Struct\Struct;

final class PlaystationStoreApi2Omni
{
    public const NULLMARK = OmniUtil::NULLMARK;
    public const UNDEFMARK = OmniUtil::UNDEFMARK;
    public const EXISTSMARK = OmniUtil::EXISTSMARK;

    /** Stands in for an empty map between the struct-lane load and the call boundary. */
    public const EMPTYMAPMARK = '__STRUCTCOMPAT_EMPTYMAP__';

    /** The entry keys that supply an argument list. */
    private const ARGKEYS = ['in', 'args', 'ctx'];

    /** ctx keys `sync_ctx` may create, pre-seeded as reference slots. */
    private const SYNCKEYS = ['spec', 'result', 'response'];

    // ------------------------------------------------------------------
    // The SDK (primary/feature) lane.
    // ------------------------------------------------------------------

    /**
     * struct's makeRunner($testfile, $client) signature, backed by
     * vendored omni. Also accepts an already-parsed spec value (omni's
     * own capability), which keeps smoke tests free of fixture files.
     */
    public static function makeRunner($testfile, $client): callable
    {
        $provider = self::sdkprovider($client);
        $runner = OmniRunner::makeRunner(self::specref($testfile), $provider);
        return self::structshape($runner, $provider, Struct::undef());
    }

    /** An omni provider over the live SDK instance. */
    private static function sdkprovider($client): array
    {
        $provider = [];

        // A subject resolves from the utility (camelCase or the php
        // spelling) - the corpus tests pass explicit subjects, so this is
        // only the fallback omni's own resolution path uses.
        $provider['subject'] = function (string $name) use ($client) {
            $utility = $client->get_utility();
            $found = $utility->{$name} ?? null;
            if (null === $found) {
                $found = $utility->{self::snake($name)} ?? null;
            }
            return $found;
        };

        // A DEF.client entry becomes another SDK instance - rewrapped
        // with the same provider shape, so `entry.client` selection keeps
        // working and ctx_from_map can unwrap it. `defbuilt` marks it: only
        // a DEF-built client may override a call site's own (a subject that
        // constructed a special DEF.setup client must keep it, and the BASE
        // provider is on every ctx entry).
        $provider['client'] = function ($options) use ($client) {
            $cls = get_class($client);
            $def = self::sdkprovider($cls::test(null, is_array($options) ? $options : []));
            $def['defbuilt'] = true;
            return $def;
        };

        // Corpus contexts stay maps; see decision 2 above.
        $provider['contextify'] = function ($val) {
            return self::ctxview(is_array($val) ? $val : []);
        };

        // Client options may reference the runner store. The vendored
        // runner discards the return, so inject through the reference.
        $provider['inject'] = function (&$options, $store) {
            $options = Struct::inject($options, $store);
            return $options;
        };

        $provider['sdk'] = $client;

        return $provider;
    }

    // ------------------------------------------------------------------
    // The struct-corpus lane.
    // ------------------------------------------------------------------

    /**
     * The struct corpus driven through the same vendored omni, with the
     * php-only empty-map preservation (decision 4). Subjects are wrapped
     * so results speak omni's value model (objects become maps, the
     * struct no-value sentinel becomes omni's Absent).
     */
    public static function makeStructRunner($testfile, $client): callable
    {
        $provider = self::sdkprovider($client);
        $runner = OmniRunner::makeRunner(self::loadstructspec(self::specref($testfile)), $provider);
        return self::structshape($runner, $provider, Struct::undef(), true);
    }

    /** Present an omni runner in the struct-runner shape. */
    private static function structshape(callable $runner, array $provider, $sentinel, bool $structlane = false): callable
    {
        return function (?string $name = null, $store = null) use ($runner, $provider, $sentinel, $structlane): array {
            $runpack = $runner($name, null === $store ? [] : $store);

            $omniflags = $runpack['runsetflags'];

            $runsetflags = function ($testspec, ?array $flags = [], $testsubject = null) use ($omniflags, $sentinel, $structlane): void {
                if ($structlane) {
                    $testspec = self::emptymaps($testspec);
                    $testsubject = self::wrapsubject($testsubject, $sentinel);
                }
                $omniflags(
                    self::undefargs($testspec, $sentinel),
                    $flags ?? [],
                    $testsubject
                );
            };

            $runset = function ($testspec, $testsubject = null) use ($runsetflags): void {
                $runsetflags($testspec, [], $testsubject);
            };

            return [
                'spec' => $runpack['spec'],
                'runset' => $runset,
                'runsetflags' => $runsetflags,
                'subject' => $runpack['subject'],
                'client' => $provider,
            ];
        };
    }

    /** A relative spec path is resolved against THIS directory (test/). */
    private static function specref($testfile)
    {
        if (!is_string($testfile)) {
            return $testfile;
        }
        if (1 === preg_match('/^(\/|[A-Za-z]:[\/\\\\])/', $testfile)) {
            return $testfile;
        }
        return __DIR__ . DIRECTORY_SEPARATOR . $testfile;
    }

    // ------------------------------------------------------------------
    // Context machinery (decision 2).
    // ------------------------------------------------------------------

    /**
     * The backing frames of every live ctx view. A frame must OUTLIVE the
     * function that builds its view: `return` dissolves a reference whose
     * only other holder is a dying local (the refcount falls to one and
     * PHP drops the is_ref flag), which silently turns the view back into
     * an ordinary value array. Holding the frame here keeps each slot's
     * refcount above one, so the reference elements survive the return -
     * and every later copy.
     */
    private static array $frames = [];

    /**
     * A ctx map whose elements are references into one shared frame, so
     * every copy the runner hands around (args[0], entry.ctx, the
     * subject's parameter) reads and writes the same slots.
     */
    public static function ctxview(array $map): array
    {
        foreach (self::SYNCKEYS as $k) {
            if (!array_key_exists($k, $map)) {
                $map[$k] = Absent::mark();
            }
        }

        $fi = count(self::$frames);
        self::$frames[$fi] = $map;

        $view = [];
        foreach (array_keys(self::$frames[$fi]) as $k) {
            $view[$k] = &self::$frames[$fi][$k];
        }
        return $view;
    }

    /**
     * Build the typed context a generated utility takes from the ctx MAP
     * omni handed the subject. The map's `client` entry - the provider,
     * or a DEF-built one - resolves back to the live SDK it wraps. (The
     * engine half of the retired inline runner did this as
     * make_ctx_from_map.)
     */
    public static function ctx_from_map($ctxmap, $client, $utility)
    {
        if (!is_array($ctxmap)) {
            $ctxmap = [];
        }

        // Only a DEF-built client overrides the caller's: the base
        // provider is on every ctx entry, and a call site that
        // constructed a special client (a DEF.setup options set) keeps it.
        $mapclient = $ctxmap['client'] ?? null;
        if (is_array($mapclient) && true === ($mapclient['defbuilt'] ?? null)
            && is_object($mapclient['sdk'] ?? null)) {
            $client = $mapclient['sdk'];
            $utility = $client->get_utility();
        }

        // The typed constructors want plain data: drop the runner's
        // bookkeeping (the provider array, unset Absent slots).
        $clean = [];
        foreach ($ctxmap as $k => $v) {
            if ('client' === $k || 'utility' === $k || $v instanceof Absent) {
                continue;
            }
            $clean[$k] = $v;
        }

        $ctx = new PlaystationStoreApi2Context($clean, null);

        $ctx->client = $client;
        $ctx->utility = $utility;

        if ($ctx->options === null) {
            $ctx->options = $client->options_map();
        }

        if (isset($clean['spec']) && is_array($clean['spec'])) {
            $ctx->spec = new PlaystationStoreApi2Spec($clean['spec']);
        }

        if (isset($clean['result']) && is_array($clean['result'])) {
            $ctx->result = new PlaystationStoreApi2Result($clean['result']);
            if (isset($clean['result']['err']) && is_array($clean['result']['err'])) {
                $msg = $clean['result']['err']['message'] ?? '';
                $ctx->result->err = new PlaystationStoreApi2Error('', is_string($msg) ? $msg : '');
            }
        }

        if (isset($clean['response']) && is_array($clean['response'])) {
            $ctx->response = new PlaystationStoreApi2Response($clean['response']);
            if (isset($clean['response']['body'])) {
                $body_copy = $clean['response']['body'];
                $ctx->response->json_func = function () use ($body_copy) { return $body_copy; };
                $ctx->response->body = $body_copy;
            }
            if (isset($clean['response']['headers']) && is_array($clean['response']['headers'])) {
                $lower_headers = [];
                foreach ($clean['response']['headers'] as $k => $v) {
                    $lower_headers[strtolower((string) $k)] = $v;
                }
                $ctx->response->headers = $lower_headers;
            }
        }

        return $ctx;
    }

    /**
     * Write the OBSERVABLE state of a typed context back into the ctx map
     * the entry holds - where a `match: {ctx: ...}` assertion reads. The
     * subject mutated the typed context; the map is what the runner can
     * walk. Writes land in the shared frame through the view's reference
     * slots. (The retired engine did this per section, by hand, as
     * "update entry ctx for match".)
     */
    public static function sync_ctx(array $ctxmap, $ctx): void
    {
        if (null === $ctx) {
            return;
        }

        if ($ctx->spec !== null) {
            $spec = [
                'base' => $ctx->spec->base,
                'prefix' => $ctx->spec->prefix,
                'suffix' => $ctx->spec->suffix,
                'path' => $ctx->spec->path,
                'method' => $ctx->spec->method,
                'params' => $ctx->spec->params,
                'query' => $ctx->spec->query,
                'headers' => $ctx->spec->headers,
                'step' => $ctx->spec->step,
                'alias' => $ctx->spec->alias_map,
            ];
            if ($ctx->spec->body !== null) {
                $spec['body'] = $ctx->spec->body;
            }
            if (is_string($ctx->spec->url ?? null) && '' !== $ctx->spec->url) {
                $spec['url'] = $ctx->spec->url;
            }
            $ctxmap['spec'] = $spec;
        }

        if ($ctx->result !== null) {
            $res = [
                'ok' => $ctx->result->ok,
                'status' => $ctx->result->status,
                'statusText' => $ctx->result->status_text,
                'headers' => $ctx->result->headers,
            ];
            if ($ctx->result->body !== null) {
                $res['body'] = $ctx->result->body;
            }
            if ($ctx->result->err !== null) {
                $res['err'] = ['message' => ($ctx->result->err instanceof \Throwable)
                    ? $ctx->result->err->getMessage() : (string) $ctx->result->err];
            }
            if ($ctx->result->resdata !== null) {
                $res['resdata'] = $ctx->result->resdata;
            }
            $ctxmap['result'] = $res;
        }

        if ($ctx->response !== null) {
            $ctxmap['response'] = 'exists';
        }
    }

    /** A corpus argument shaped {"message","code"} as an SDK error value. */
    public static function err_from_map($m): ?PlaystationStoreApi2Error
    {
        if (!is_array($m)) {
            return null;
        }
        $msg = $m['message'] ?? '';
        if (!is_string($msg) || '' === $msg) {
            return null;
        }
        $code = $m['code'] ?? '';
        return new PlaystationStoreApi2Error(is_string($code) ? $code : '', $msg);
    }

    /** (value, err) tuple convention -> value-or-throw, omni's shape. */
    public static function unwrap(array $pair)
    {
        [$val, $err] = $pair;
        if ($err !== null) {
            if ($err instanceof \Throwable) {
                throw $err;
            }
            throw new \Exception((string) $err);
        }
        return $val;
    }

    /** `makeContext` -> `make_context`: the SDK utility is snake_case. */
    private static function snake(string $name): string
    {
        return strtolower(preg_replace('/([a-z0-9])([A-Z])/', '$1_$2', $name) ?? $name);
    }

    // ------------------------------------------------------------------
    // No-argument entries (decision 3; ported from upstream omni's php
    // compat shim).
    // ------------------------------------------------------------------

    /**
     * Rewrite entries carrying none of `in`, `args`, `ctx` to an explicit
     * `args` of one no-value sentinel - in memory, for this port only.
     * The corpus on disk is untouched.
     */
    public static function undefargs($testspec, $sentinel)
    {
        if (null === $sentinel || !OmniUtil::ismap($testspec)) {
            return $testspec;
        }

        $set = $testspec['set'] ?? null;
        if (!OmniUtil::islist($set)) {
            return $testspec;
        }

        $found = false;
        foreach ($set as $entry) {
            if (self::noargs($entry)) {
                $found = true;
                break;
            }
        }
        if (!$found) {
            return $testspec;
        }

        $patched = [];
        foreach ($set as $entry) {
            if (self::noargs($entry)) {
                $entry['args'] = [$sentinel];
            }
            $patched[] = $entry;
        }

        $out = $testspec;
        $out['set'] = $patched;
        return $out;
    }

    /** An entry that supplies no argument list at all. */
    private static function noargs($entry): bool
    {
        if (!OmniUtil::ismap($entry) && self::EMPTYMAPMARK !== $entry) {
            return false;
        }
        if (self::EMPTYMAPMARK === $entry) {
            return true;
        }
        foreach (self::ARGKEYS as $key) {
            if (array_key_exists($key, $entry)) {
                return false;
            }
        }
        return true;
    }

    // ------------------------------------------------------------------
    // The struct lane's empty-map preservation (decision 4; ported from
    // upstream omni's php compat shim).
    // ------------------------------------------------------------------

    /** Load a struct-lane spec so that an empty map survives the decode. */
    public static function loadstructspec($specref)
    {
        if (!is_string($specref)) {
            return $specref;
        }
        $text = file_get_contents($specref);
        if (false === $text) {
            throw new OmniError('omni resolver: cannot read spec: ' . $specref);
        }
        return self::mapempty(json_decode($text, false, 512, JSON_THROW_ON_ERROR));
    }

    /** Objects to arrays; an empty object becomes the marker. */
    private static function mapempty($val)
    {
        if ($val instanceof \stdClass) {
            $vars = get_object_vars($val);
            if (0 === count($vars)) {
                return self::EMPTYMAPMARK;
            }
            $out = [];
            foreach ($vars as $key => $subval) {
                $out[$key] = self::mapempty($subval);
            }
            return $out;
        }

        if (is_array($val)) {
            $out = [];
            foreach ($val as $key => $subval) {
                $out[$key] = self::mapempty($subval);
            }
            return $out;
        }

        return $val;
    }

    /**
     * Resolve the marker per side: argument positions keep it (resolved
     * to a real stdClass inside the subject wrapper), everywhere else it
     * becomes `[]`, which is what the array-model comparison will see.
     */
    public static function emptymaps($testspec)
    {
        if (!OmniUtil::ismap($testspec)) {
            return $testspec;
        }

        $set = $testspec['set'] ?? null;
        if (!OmniUtil::islist($set)) {
            return $testspec;
        }

        $patched = [];
        foreach ($set as $entry) {
            // A whole entry may be the marker - a degenerate `{}` entry.
            if (self::EMPTYMAPMARK === $entry) {
                $entry = [];
            }

            if (OmniUtil::ismap($entry)) {
                foreach ($entry as $key => $val) {
                    if (in_array($key, self::ARGKEYS, true)) {
                        continue;
                    }
                    $entry[$key] = self::unmark($val);
                }
            }
            $patched[] = $entry;
        }

        $out = $testspec;
        $out['set'] = $patched;
        return $out;
    }

    /** Result side: the marker becomes `[]`. */
    public static function unmark($val)
    {
        if (self::EMPTYMAPMARK === $val) {
            return [];
        }

        if (is_array($val)) {
            $out = [];
            foreach ($val as $key => $subval) {
                $out[$key] = self::unmark($subval);
            }
            return $out;
        }

        return $val;
    }

    /** Argument side: the marker becomes a real empty map. */
    public static function argval($val)
    {
        if (self::EMPTYMAPMARK === $val) {
            return new \stdClass();
        }

        if (is_array($val)) {
            $out = [];
            foreach ($val as $key => $subval) {
                $out[$key] = self::argval($subval);
            }
            return $out;
        }

        return $val;
    }

    /**
     * The struct-lane OBJECT model: every map becomes a stdClass, lists
     * stay PHP arrays - exactly what the retired engine's object-mode
     * decode fed the struct utilities, so the subjects keep receiving the
     * value shapes they always have. (Results go the other way, through
     * structfix.)
     */
    public static function objmodel($val)
    {
        if (is_array($val)) {
            if (array_is_list($val)) {
                $out = [];
                foreach ($val as $subval) {
                    $out[] = self::objmodel($subval);
                }
                return $out;
            }
            $out = new \stdClass();
            foreach ($val as $key => $subval) {
                $out->{$key} = self::objmodel($subval);
            }
            return $out;
        }

        return $val;
    }

    /**
     * Normalise a struct result to omni's value model: objects become
     * maps, and the struct no-value sentinel becomes omni's Absent. The
     * sentinel is checked BEFORE the object walk (it is itself stdClass).
     */
    public static function structfix($val, $sentinel)
    {
        if (null !== $sentinel && $val === $sentinel) {
            return Absent::mark();
        }

        if (is_array($val)) {
            $out = [];
            foreach ($val as $key => $subval) {
                $out[$key] = self::structfix($subval, $sentinel);
            }
            return $out;
        }

        if (is_object($val) && !($val instanceof \Throwable)
            && !($val instanceof \Closure) && !OmniUtil::isabsent($val)) {
            $out = [];
            foreach (get_object_vars($val) as $key => $subval) {
                $out[$key] = self::structfix($subval, $sentinel);
            }
            return $out;
        }

        return $val;
    }

    /** A subject whose arguments and result speak the two value models. */
    public static function wrapsubject($subject, $sentinel)
    {
        if (null === $subject || !is_callable($subject)) {
            return $subject;
        }

        return function (...$args) use ($subject, $sentinel) {
            $args = self::objmodel(self::argval($args));
            return self::structfix($subject(...$args), $sentinel);
        };
    }

    /**
     * Convert NULLMARK sentinels back into real nulls. The struct port's
     * inject walks stdClass nodes as well as arrays, so the parent may be
     * either; extra trailing parameters match struct's five-argument
     * modifier convention.
     */
    public static function nullModifier($val, $key, &$parent = null, $state = null, $store = null): void
    {
        if (is_object($parent) && !($parent instanceof \ArrayAccess)) {
            if (OmniUtil::NULLMARK === $val) {
                $parent->{$key} = null;
            } elseif (is_string($val)) {
                $parent->{$key} = str_replace(OmniUtil::NULLMARK, 'null', $val);
            }
            return;
        }

        if (is_array($parent)) {
            OmniRunner::nullmodifier($val, $key, $parent);
        }
    }
}
