<?php
// VENDORED: @voxgig/omni sdk-20260908-1556-0 (php/src/Util.php)
// Source: https://github.com/voxgig/omni @ 274708cc2d12b21707d975543953f845f8444be0  [tag: sdk-20260911-2013-0]
// License: MIT (c) voxgig - see repository LICENSE. Do not edit: resync from upstream.

/**
 * Omni internal JSON utilities.
 *
 * This module is deliberately self-contained: the omni runner must be able
 * to test *any* library, including libraries that provide these same
 * operations, so it can never borrow them from the system under test.
 * Zero third-party dependencies, by design.
 *
 * NOTE: JSON is decoded into associative arrays, so an empty map and an
 * empty list are the same PHP value. This is the one place where the PHP
 * port cannot distinguish two spec values that other ports can.
 */

declare(strict_types=1);

namespace Voxgig\Omni;

/** PHP has no `undefined`, so absence needs its own marker. */
final class Absent
{
    private static ?Absent $instance = null;

    public static function mark(): Absent
    {
        if (null === self::$instance) {
            self::$instance = new Absent();
        }
        return self::$instance;
    }

    public function __toString(): string
    {
        return 'ABSENT';
    }
}

final class Util
{
    public const NULLMARK = '__NULL__';     // Value is JSON null.
    public const UNDEFMARK = '__UNDEF__';   // Value is not present.
    public const EXISTSMARK = '__EXISTS__'; // Value exists (not undefined).

    /** A map (JSON object)? */
    public static function ismap($val): bool
    {
        return is_array($val) && !array_is_list($val);
    }

    /** A list (JSON array)? */
    public static function islist($val): bool
    {
        return is_array($val) && array_is_list($val);
    }

    /** A container (map or list)? */
    public static function isnode($val): bool
    {
        return is_array($val);
    }

    /** A JSON number? Booleans are not numbers. */
    public static function isnum($val): bool
    {
        return (is_int($val) || is_float($val)) && !is_bool($val);
    }

    public static function isabsent($val): bool
    {
        return $val instanceof Absent;
    }

    /** Deep copy a JSON value. Other values pass through by reference. */
    public static function clone($val)
    {
        if (is_array($val)) {
            $out = [];
            foreach ($val as $key => $subval) {
                $out[$key] = self::clone($subval);
            }
            return $out;
        }

        return $val;
    }

    /** Read a value by path. Returns Absent when any step is missing. */
    public static function getpath($val, array $path)
    {
        $current = $val;

        foreach ($path as $part) {
            if (self::islist($current)) {
                if (!is_numeric($part)) {
                    return Absent::mark();
                }
                $index = (int) $part;
                if ($index < 0 || $index >= count($current)) {
                    return Absent::mark();
                }
                $current = $current[$index];
            } elseif (is_array($current)) {
                $key = (string) $part;
                if (!array_key_exists($key, $current)) {
                    return Absent::mark();
                }
                $current = $current[$key];
            } else {
                return Absent::mark();
            }
        }

        return $current;
    }

    /** Depth-first walk: children first, then the containing node. */
    public static function walk($val, callable $apply, $key = null, $parent = null, ?array $path = null)
    {
        $curpath = null === $path ? [] : $path;

        if (is_array($val)) {
            foreach (array_keys($val) as $childkey) {
                $childpath = $curpath;
                $childpath[] = $childkey;
                $val[$childkey] = self::walk($val[$childkey], $apply, $childkey, $val, $childpath);
            }
        }

        return $apply($key, $val, $parent, $curpath);
    }

    /** Deep structural equality: numbers by value, bools never numbers. */
    public static function deepequal($a, $b): bool
    {
        if (is_bool($a) || is_bool($b)) {
            return $a === $b;
        }

        if (self::isnum($a) && self::isnum($b)) {
            // NaN equals NaN: deepequal is structural, not IEEE (as canonical).
            return (float) $a === (float) $b
                || (is_nan((float) $a) && is_nan((float) $b));
        }

        if (self::isabsent($a) || self::isabsent($b)) {
            return $a === $b;
        }

        if (null === $a || null === $b) {
            return $a === $b;
        }

        if (is_array($a) && is_array($b)) {
            if (count($a) !== count($b)) {
                return false;
            }
            if (self::islist($a) !== self::islist($b) && 0 < count($a)) {
                return false;
            }
            foreach ($a as $key => $val) {
                if (!array_key_exists($key, $b)) {
                    return false;
                }
                if (!self::deepequal($val, $b[$key])) {
                    return false;
                }
            }
            return true;
        }

        if (is_array($a) !== is_array($b)) {
            return false;
        }

        return $a === $b;
    }

    /** Render a number the same way in every port: 5.0 prints as 5. */
    public static function numstr($val): string
    {
        if (is_float($val)) {
            if (is_nan($val) || is_infinite($val)) {
                return 'null';
            }
            if ($val === floor($val) && abs($val) < 9007199254740992.0) {
                return (string) (int) $val;
            }
            return rtrim(rtrim(sprintf('%.17g', $val), '0'), '.');
        }

        return (string) $val;
    }

    public static function quote($val): string
    {
        $out = '"';
        $text = (string) $val;
        $len = strlen($text);
        for ($i = 0; $i < $len; $i++) {
            $char = $text[$i];
            if ('"' === $char) {
                $out .= '\\"';
            } elseif ('\\' === $char) {
                $out .= '\\\\';
            } elseif ("\n" === $char) {
                $out .= '\\n';
            } elseif ("\r" === $char) {
                $out .= '\\r';
            } elseif ("\t" === $char) {
                $out .= '\\t';
            } elseif (ord($char) < 0x20) {
                $out .= sprintf('\\u%04x', ord($char));
            } else {
                $out .= $char;
            }
        }
        return $out . '"';
    }

    /** Compact JSON text with map keys sorted, identical in every port. */
    public static function jsonstr($val): string
    {
        if (self::isabsent($val)) {
            return 'undefined';
        }

        if (null === $val) {
            return 'null';
        }

        if (is_bool($val)) {
            return $val ? 'true' : 'false';
        }

        if (is_string($val)) {
            return self::quote($val);
        }

        if (self::isnum($val)) {
            return self::numstr($val);
        }

        if (self::islist($val)) {
            $parts = [];
            foreach ($val as $entry) {
                $parts[] = self::jsonstr($entry);
            }
            return '[' . implode(',', $parts) . ']';
        }

        if (is_array($val)) {
            $keys = array_map('strval', array_keys($val));
            sort($keys);
            $parts = [];
            foreach ($keys as $key) {
                $parts[] = self::quote($key) . ':' . self::jsonstr($val[$key]);
            }
            return '{' . implode(',', $parts) . '}';
        }

        if (is_callable($val)) {
            return '[Function]';
        }

        return self::quote((string) $val);
    }

    /** Strings verbatim, everything else as compact JSON. */
    public static function stringify($val): string
    {
        return is_string($val) ? $val : self::jsonstr($val);
    }

    /** Render a path as a dotted string. */
    public static function pathify(?array $path): string
    {
        return implode('.', array_map('strval', $path ?? []));
    }
}
