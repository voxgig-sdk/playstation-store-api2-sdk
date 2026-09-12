<?php
// VENDORED: @voxgig/omni sdk-20260908-1556-0 (php/src/Runner.php)
// Source: https://github.com/voxgig/omni @ 274708cc2d12b21707d975543953f845f8444be0  [tag: sdk-20260911-2013-0]
// License: MIT (c) voxgig - see repository LICENSE. Do not edit: resync from upstream.

/**
 * Omni: the shared multi-language test runner.
 *
 * Port of the canonical TypeScript implementation
 * (typescript/src/Runner.ts). Behaviour must match, case for case.
 */

declare(strict_types=1);

namespace Voxgig\Omni;

require_once __DIR__ . '/Util.php';

/**
 * A test failure (or a malformed spec). Distinct from errors thrown by the
 * subject under test, which are candidates for an `err` expectation.
 */
class OmniError extends \Exception
{
    public $entry;

    public function __construct(string $message, $entry = null)
    {
        parent::__construct($message);
        $this->entry = $entry;
    }
}

final class Runner
{
    public const NULLMARK = Util::NULLMARK;
    public const UNDEFMARK = Util::UNDEFMARK;
    public const EXISTSMARK = Util::EXISTSMARK;

    /**
     * The newest spec format version this runner understands. A spec with
     * no OMNI block is version 0: the original, lenient format, frozen
     * forever. Version 1 turns on strict entry validation (see checkentry).
     */
    public const SPECVERSION = 1;

    /**
     * Capability strings this runner supports beyond the version baseline.
     * A spec's OMNI.requires list is checked against this: an unknown
     * capability refuses the spec loudly at load time, instead of a
     * lagging port silently mis-running it. (Empty today; future format
     * features mint a string here.)
     */
    public const CAPABILITIES = [];

    /**
     * The complete set of fields an entry may carry. Under version 1
     * anything else is an error: an unrecognised key is almost always a
     * typo'd assertion, and a typo'd assertion is a test that silently
     * stopped testing.
     */
    private const ENTRYFIELDS = ['in', 'args', 'ctx', 'out', 'err', 'match', 'client', 'id', 'doc'];

    /** Load a spec: a path to a JSON file, or an already-parsed value. */
    public static function loadspec($specref)
    {
        if (is_string($specref)) {
            $text = file_get_contents($specref);
            if (false === $text) {
                throw new OmniError('omni: cannot read spec: ' . $specref);
            }
            return json_decode($text, true, 512, JSON_THROW_ON_ERROR);
        }
        return $specref;
    }

    /**
     * Read the spec's format version from its optional top-level OMNI
     * block, and refuse a spec this runner cannot faithfully run: a
     * version newer than SPECVERSION, or a required capability not in
     * CAPABILITIES.
     */
    public static function resolveversion($alltests): int
    {
        if (!Util::ismap($alltests) || !array_key_exists('OMNI', $alltests)) {
            return 0;
        }

        $meta = $alltests['OMNI'];
        $version = Util::ismap($meta) ? ($meta['version'] ?? null) : null;

        if (!Util::ismap($meta) || !Util::isnum($version) || 0.0 !== fmod((float) $version, 1.0)) {
            throw new OmniError('omni: malformed OMNI version block');
        }

        if ($version < 0 || self::SPECVERSION < $version) {
            throw new OmniError('omni: unsupported spec version: ' . Util::stringify($version));
        }

        if (array_key_exists('requires', $meta)) {
            $requires = $meta['requires'];
            if (!Util::islist($requires)) {
                throw new OmniError('omni: malformed OMNI requires list');
            }
            foreach ($requires as $cap) {
                if (!is_string($cap) || !in_array($cap, self::CAPABILITIES, true)) {
                    throw new OmniError('omni: spec requires unsupported capability: ' . Util::stringify($cap));
                }
            }
        }

        return (int) $version;
    }

    /**
     * Strict entry validation, applied when the spec declares version 1 or
     * later. The lenient format converts each of these mistakes into a
     * silent pass or a dead field; here they fail with the entry named.
     */
    public static function checkentry(array $flags, int $index, $entry): void
    {
        if (!Util::ismap($entry)) {
            throw self::fail($flags, $index, $entry, 'entry is not a map');
        }

        foreach (array_keys($entry) as $key) {
            if (!in_array($key, self::ENTRYFIELDS, true)) {
                throw self::fail($flags, $index, $entry, 'unknown entry field: ' . $key);
            }
        }

        $argsources = 0;
        foreach (['in', 'args', 'ctx'] as $key) {
            if (array_key_exists($key, $entry)) {
                $argsources++;
            }
        }
        if (1 < $argsources) {
            throw self::fail($flags, $index, $entry, 'entry has more than one of in, args, ctx');
        }

        if (null !== ($entry['err'] ?? null) && array_key_exists('out', $entry)) {
            throw self::fail($flags, $index, $entry, 'entry has both err and out');
        }

        if (array_key_exists('id', $entry) && !is_string($entry['id'])) {
            throw self::fail($flags, $index, $entry, 'entry id is not a string');
        }
    }

    /**
     * Validate a version-1 group up front, against the AUTHORED entries -
     * null-normalisation would otherwise rewrite an authored null (e.g.
     * id: null) into a sentinel string and hide it from validation. A
     * malformed spec is a spec error, not a test result, so it fails
     * before any subject runs.
     */
    public static function checkset(array $flags, $testspec, array $normalset): void
    {
        $origset = Util::ismap($testspec) && Util::islist($testspec['set'] ?? null)
            ? $testspec['set'] : $normalset;

        if (0 === count($origset) && true !== (Util::ismap($testspec) ? ($testspec['empty'] ?? null) : null)) {
            throw new OmniError('omni: empty test set: ' . $flags['name']);
        }

        foreach ($origset as $index => $entry) {
            self::checkentry($flags, $index, $entry);
        }
    }

    /** Find `primary.<name>`, then `<name>`, then the whole spec. */
    public static function resolvespec(?string $name, $alltests)
    {
        if (null === $name) {
            return $alltests;
        }

        $primary = Util::ismap($alltests) ? ($alltests['primary'] ?? null) : null;
        if (Util::ismap($primary) && null !== ($primary[$name] ?? null)) {
            return $primary[$name];
        }

        if (is_array($alltests) && null !== ($alltests[$name] ?? null)) {
            return $alltests[$name];
        }

        return $alltests;
    }

    /** Build the named clients declared by the spec's DEF.client block. */
    public static function resolveclients(array $provider, $spec, $store): array
    {
        $clients = [];

        $defclient = Util::ismap($spec) && Util::ismap($spec['DEF'] ?? null)
            ? ($spec['DEF']['client'] ?? null) : null;
        if (!Util::ismap($defclient)) {
            return $clients;
        }

        // A spec may define clients that a given test run never references.
        $clientmaker = $provider['client'] ?? null;
        if (null === $clientmaker) {
            return $clients;
        }

        foreach ($defclient as $clientname => $cdef) {
            $copts = Util::clone(
                (Util::ismap($cdef) && Util::ismap($cdef['test'] ?? null)
                    ? ($cdef['test']['options'] ?? null) : null) ?? []
            );

            $injector = $provider['inject'] ?? null;
            if (is_array($store) && null !== $injector) {
                $injector($copts, $store);
            }

            $clients[$clientname] = $clientmaker($copts);
        }

        return $clients;
    }

    public static function resolvesubject(?string $name, array $provider)
    {
        if (null === $name || null === ($provider['subject'] ?? null)) {
            return null;
        }
        return $provider['subject']($name) ?: null;
    }

    public static function resolveflags(?array $flags): array
    {
        $out = null === $flags ? [] : $flags;
        $out['null'] = !isset($out['null']) ? true : (bool) $out['null'];
        return $out;
    }

    /** An entry with no `out` expects a null (or absent) result. */
    public static function resolveentry(array $entry, array $flags): array
    {
        if (null === ($entry['out'] ?? null) && $flags['null']) {
            $entry['out'] = Util::NULLMARK;
        }
        return $entry;
    }

    public static function resolvetestpack(?string $name, array $entry, $subject, array $provider, array $clients): array
    {
        $testpack = ['client' => $provider, 'subject' => $subject];

        if (null !== ($entry['client'] ?? null)) {
            $client = $clients[$entry['client']] ?? null;
            if (null === $client) {
                throw new OmniError('omni: unknown client: ' . $entry['client'], $entry);
            }
            $testpack['client'] = $client;
            $testpack['subject'] = self::resolvesubject($name, $client) ?: $subject;
        }

        return $testpack;
    }

    /** Build the argument list: `ctx`, `args`, or `in`. */
    public static function resolveargs(array &$entry, array $testpack, array $provider): array
    {
        if (array_key_exists('ctx', $entry)) {
            $args = [$entry['ctx']];
        } elseif (array_key_exists('args', $entry)) {
            $args = $entry['args'];
        } else {
            $args = [Util::clone($entry['in'] ?? null)];
        }

        if (array_key_exists('ctx', $entry) || array_key_exists('args', $entry)) {
            if (0 < count($args)) {
                $first = $args[0];
                if (Util::ismap($first)) {
                    $first = Util::clone($first);
                    $contextify = $provider['contextify'] ?? null;
                    if (null !== $contextify) {
                        $first = $contextify($first);
                    }
                    if (is_array($first)) {
                        $first['client'] = $testpack['client'];
                    }
                    $args[0] = $first;
                    $entry['ctx'] = $first;
                }
            }
        }

        return $args;
    }

    /** Nulls become NULLMARK, errors become {name,message}. Always a copy. */
    public static function fixjson($val, ?array $flags = null)
    {
        $donull = (null === $flags || !isset($flags['null'])) ? true : (bool) $flags['null'];
        return self::fixjsonval($val, $donull);
    }

    public static function fixjsonval($val, bool $donull)
    {
        if (null === $val || Util::isabsent($val)) {
            return $donull ? Util::NULLMARK : null;
        }

        if ($val instanceof \Throwable) {
            return self::errify($val);
        }

        if (is_array($val)) {
            $out = [];
            foreach ($val as $key => $subval) {
                $out[$key] = self::fixjsonval($subval, $donull);
            }
            return $out;
        }

        return $val;
    }

    /** The JSON form of an error: always at least {name,message}. */
    public static function errify($err): array
    {
        if ($err instanceof \Throwable) {
            return ['name' => (new \ReflectionClass($err))->getShortName(), 'message' => $err->getMessage()];
        }
        return ['name' => 'Error', 'message' => (string) $err];
    }

    // The error base a `match.err` sees: the provider's own, when it has one.
    // A library whose errors carry a `code` reaches
    // `match: {err: {code}}` through `Provider.errify`, which replaces
    // `errify` entirely rather than adding to it.
    public static function errbase($err, ?array $provider)
    {
        $hook = null === $provider ? null : ($provider['errify'] ?? null);
        return null === $hook ? self::errify($err) : $hook($err);
    }

    public static function errmessage($err): string
    {
        return $err instanceof \Throwable ? $err->getMessage() : (string) $err;
    }

    /** The label of one entry, for failure messages. */
    public static function entryref(array $flags, int $index, $entry): string
    {
        $label = $flags['name'] ?? 'set';
        $entryid = (is_array($entry) && null !== ($entry['id'] ?? null))
            ? ' (' . $entry['id'] . ')' : '';
        return $label . '[' . $index . ']' . $entryid;
    }

    public static function fail(array $flags, int $index, $entry, string $reason, ?string $expected = null, ?string $actual = null): OmniError
    {
        $msg = 'omni: ' . self::entryref($flags, $index, $entry) . ': ' . $reason;
        if (null !== $expected) {
            $msg .= "\n  expected: " . $expected;
        }
        if (null !== $actual) {
            $msg .= "\n  actual:   " . $actual;
        }
        $msg .= "\n  entry:    " . Util::stringify(self::entrysummary($entry));
        return new OmniError($msg, $entry);
    }

    /** The spec-defined part of an entry (drop runner bookkeeping). */
    public static function entrysummary($entry)
    {
        if (!is_array($entry)) {
            return $entry;
        }
        $out = [];
        foreach ($entry as $key => $val) {
            if (!in_array($key, ['res', 'thrown', 'ctx'], true)) {
                $out[$key] = $val;
            }
        }
        return $out;
    }

    public static function checkresult(array $flags, int $index, array $entry, array $args, $res): void
    {
        $matched = false;

        if (null !== ($entry['err'] ?? null)) {
            throw self::fail(
                $flags,
                $index,
                $entry,
                'expected error did not occur',
                Util::stringify($entry['err']),
                Util::stringify($res)
            );
        }

        if (null !== ($entry['match'] ?? null)) {
            self::match($flags, $index, $entry, $entry['match'], [
                'in' => $entry['in'] ?? null,
                'args' => $args,
                'out' => $entry['res'] ?? null,
                'ctx' => $entry['ctx'] ?? null,
            ]);
            $matched = true;
        }

        $out = $entry['out'] ?? null;

        if (Util::deepequal($res, $out)) {
            return;
        }

        // NOTE: a match with no explicit out is a complete check on its own.
        if ($matched && (Util::NULLMARK === $out || null === $out)) {
            return;
        }

        throw self::fail($flags, $index, $entry, 'result mismatch', Util::stringify($out), Util::stringify($res));
    }

    public static function handleerror(array $flags, int $index, array $entry, \Throwable $err, ?array $provider = null): void
    {
        $entryerr = $entry['err'] ?? null;

        if (null !== $entryerr) {
            if (true === $entryerr || self::matchval($entryerr, self::errmessage($err))) {
                if (null !== ($entry['match'] ?? null)) {
                    self::match($flags, $index, $entry, $entry['match'], [
                        'in' => $entry['in'] ?? null,
                        'out' => $entry['res'] ?? null,
                        'ctx' => $entry['ctx'] ?? null,
                        'err' => self::errbase($err, $provider),
                    ]);
                }
                return;
            }

            throw self::fail($flags, $index, $entry, 'error mismatch', Util::stringify($entryerr), self::errmessage($err));
        }

        throw self::fail($flags, $index, $entry, 'unexpected error', null, self::errmessage($err));
    }

    /** Check that every leaf of `check` is present, and matches, in `base`. */
    public static function match(array $flags, int $index, array $entry, $check, $base): void
    {
        $cbase = Util::clone($base);

        $at = function (array $path): string {
            return 0 === count($path) ? '<root>' : Util::pathify($path);
        };

        Util::walk(Util::clone($check), function ($_key, $val, $_parent, $path) use ($flags, $index, $entry, $cbase, $at) {
            // An empty container in the check is a structural placeholder:
            // walk visits no leaves inside {} or [], so it asserts nothing
            // about the base. (struct's corpus relies on this "map is here,
            // contents unchecked" behaviour, so omni stays a faithful drop-in.)
            if (!Util::isnode($val)) {
                $baseval = Util::getpath($cbase, $path);

                // The sentinels are tested BEFORE the identity check below.
                // Otherwise a subject returning the literal string
                // "__UNDEF__" satisfies an assertion that the key is absent
                // - two mutually exclusive states passing one check. A
                // sentinel that accepts its own literal is not a sentinel.
                // (NULLMARK still accepts NULLMARK: under the default null
                // flag a real null has already been normalised to it, so the
                // two are genuinely indistinguishable here - that one needs a
                // raw-value escape, not an ordering change.)

                // Explicitly absent: satisfied only by a genuinely missing
                // key, never by a present null (the distinction the
                // sentinels exist to keep).
                if (Util::UNDEFMARK === $val) {
                    if (Util::isabsent($baseval)) {
                        return $val;
                    }
                    throw self::fail($flags, $index, $entry, 'expected absent at ' . $at($path), 'absent', Util::stringify($baseval));
                }

                // Explicitly null: satisfied only by a present null.
                if (Util::NULLMARK === $val) {
                    if (null === $baseval || Util::NULLMARK === $baseval) {
                        return $val;
                    }
                    throw self::fail($flags, $index, $entry, 'expected null at ' . $at($path), 'null', Util::stringify($baseval));
                }

                // Explicitly present: any present value, including null.
                if (Util::EXISTSMARK === $val) {
                    if (!Util::isabsent($baseval)) {
                        return $val;
                    }
                    throw self::fail($flags, $index, $entry, 'expected present at ' . $at($path), 'present', 'absent');
                }

                // Identical values match. This sits below the sentinel
                // branches on purpose - see the note above.
                if ($baseval === $val) {
                    return $val;
                }

                // A concrete expectation never matches a missing key - a
                // match leaf against an absent value must fail, not
                // substring-match the stringified absent value.
                if (Util::isabsent($baseval)) {
                    throw self::fail($flags, $index, $entry, 'match failed at ' . $at($path), Util::stringify($val), 'absent');
                }

                if (!self::matchval($val, $baseval)) {
                    throw self::fail($flags, $index, $entry, 'match failed at ' . $at($path), Util::stringify($val), Util::stringify($baseval));
                }
            }

            return $val;
        });
    }

    /** Match one leaf: /regex/ or case-insensitive substring for strings. */
    public static function matchval($check, $base): bool
    {
        if (Util::deepequal($check, $base)) {
            return true;
        }

        $want = $check;
        if (Util::UNDEFMARK === $want || Util::NULLMARK === $want) {
            $want = null;
        }

        if (null === $want) {
            return null === $base || Util::isabsent($base) || Util::NULLMARK === $base;
        }

        if (is_string($want)) {
            // An empty want is not a wildcard: the empty string is a substring
            // of everything, so `match:{out:""}` (or `err:""`) would accept any
            // value.
            if ('' === $want) {
                return '' === $base;
            }

            $basestr = Util::stringify($base);

            if (1 === preg_match('#^/(.+)/$#s', $want, $rem)) {
                return 1 === preg_match('#' . str_replace('#', '\\#', $rem[1]) . '#', $basestr);
            }

            return false !== stripos($basestr, $want);
        }

        if (is_callable($want)) {
            return true;
        }

        return Util::deepequal($want, $base);
    }

    /** Convert NULLMARK sentinels back into real nulls. */
    public static function nullmodifier($val, $key, &$parent): void
    {
        if (Util::NULLMARK === $val) {
            $parent[$key] = null;
        } elseif (is_string($val)) {
            $parent[$key] = str_replace(Util::NULLMARK, 'null', $val);
        }
    }

    /**
     * Make a runner for a spec file (or spec value) and a provider.
     *
     * Returns a callable: (?string $name, $store) => array with keys
     * spec, runset, runsetflags, subject, client.
     */
    public static function makeRunner($specref, ?array $provider = null): callable
    {
        $alltests = self::loadspec($specref);
        $specversion = self::resolveversion($alltests);
        $useprovider = $provider ?? [];

        return function (?string $name = null, $store = null) use ($alltests, $specversion, $useprovider): array {
            $spec = self::resolvespec($name, $alltests);
            $clients = self::resolveclients($useprovider, $spec, null === $store ? [] : $store);
            $defsubject = self::resolvesubject($name, $useprovider);

            $runsetflags = function ($testspec, ?array $flags, $testsubject = null) use ($name, $specversion, $useprovider, $clients, $defsubject): void {
                $useflags = self::resolveflags($flags);
                $useflags['name'] = $useflags['name'] ?? ($name ?? 'set');

                $subject = $testsubject ?: $defsubject;
                if (null === $subject) {
                    throw new OmniError('omni: no test subject for: ' . $useflags['name']);
                }

                $testspecmap = self::fixjson($testspec, $useflags);

                if (!Util::ismap($testspecmap) || !Util::islist($testspecmap['set'] ?? null)) {
                    throw new OmniError('omni: test spec has no set: ' . $useflags['name']);
                }

                $testset = $testspecmap['set'];

                if (1 <= $specversion) {
                    self::checkset($useflags, $testspec, $testset);
                }

                foreach ($testset as $index => $entry) {
                    try {
                        $entry = self::resolveentry($entry, $useflags);

                        $testpack = self::resolvetestpack($name, $entry, $subject, $useprovider, $clients);
                        $args = self::resolveargs($entry, $testpack, $useprovider);

                        $res = ($testpack['subject'])(...$args);
                        $res = self::fixjson($res, $useflags);
                        $entry['res'] = $res;

                        self::checkresult($useflags, $index, $entry, $args, $res);
                    } catch (OmniError $omnierr) {
                        throw $omnierr;
                    } catch (\Throwable $err) {
                        self::handleerror($useflags, $index, $entry, $err, $useprovider);
                    }
                }
            };

            $runset = function ($testspec, $testsubject = null) use ($runsetflags): void {
                $runsetflags($testspec, [], $testsubject);
            };

            return [
                'spec' => $spec,
                'runset' => $runset,
                'runsetflags' => $runsetflags,
                'subject' => $defsubject,
                'client' => $useprovider,
            ];
        };
    }
}
