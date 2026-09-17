import {
  Content,
  File,
  cmp,
  entitySpecMap,
  optionSpec,
  rawStringLiteral,
} from '@voxgig/sdkgen'


import {
  Model,
} from '@voxgig/apidef'


// THE GENERATED SCHEMA MODULE: the model's schemas, as data the SDK can run.
//
// The php peer of src/cmp/ts/Schema_ts.ts. Same two exports, same source —
// OPTSPEC from `main.kit.optspec` plus each feature's own `config.options`,
// ENTITYSPEC from the entity field sentinels — built by the shared helpers,
// so what php validates against and what ts validates against cannot drift.
//
// EMBEDDED AS JSON, DECODED ON FIRST USE, the mechanism config.php already
// uses for the model above the size threshold, and SINGLE-quoted for the
// reason recorded there: a double-quoted php string would interpolate a `$`,
// and the spec is made almost entirely of `$SENTINEL` strings.
//
// The round-trip is exact because the spec holds only strings and booleans —
// pinned by "strings and booleans only, so the JSON round-trip is lossless"
// in ts/test/optspec.test.ts.
const Schema = cmp(async function Schema(props: any) {
  const ctx$ = props.ctx$
  const target = props.target

  const model: Model = ctx$.model

  const optspec = optionSpec(model, target.name)
  const entityspec = entitySpecMap(model, target.name) || {}

  File({ name: 'schema.' + target.ext }, () => {
    Content(`<?php
declare(strict_types=1);

// ${model.const.Name} ${target.Name} SDK: generated schemas. Do not edit.
//
// Generated from the model: \`main.kit.optspec\` and each feature's
// \`config.options\` for OPTSPEC; entity \`fields[].type\` for ENTITYSPEC.

class ${model.const.Name}Schema
{
    private const OPTSPEC_DATA = ${rawStringLiteral(JSON.stringify(optspec))};

    private const ENTITYSPEC_DATA = ${rawStringLiteral(JSON.stringify(entityspec))};

    // A UNION, not ?array. schema_decode hands back an empty stdClass for an
    // EMPTY map - that is the whole point of decoding without the assoc flag,
    // since php cannot otherwise tell an empty map from an empty list - and
    // the entity specs are empty for a project with no entities, and whenever
    // the validate feature is inactive, which is the default. Typed ?array,
    // the first call to entityspec() threw a TypeError instead of handing
    // back the empty map every other target returns.
    private static array|\\stdClass|null $optspec = null;

    private static array|\\stdClass|null $entityspec = null;

    // Decoded ONCE, on first use. The spec is read on every client
    // construction and never mutated, so decoding per call would be pure
    // waste — and sharing the array is safe for the same reason:
    // make_options validates AGAINST it and writes into the options, never
    // into the spec. (php arrays are copy-on-write, so a caller that did
    // write would get its own copy rather than corrupt this one.)
    public static function optspec(): array|\\stdClass
    {
        if (self::$optspec === null) {
            self::$optspec = self::schema_decode(json_decode(self::OPTSPEC_DATA));
        }
        return self::$optspec;
    }

    public static function entityspec(): array|\\stdClass
    {
        if (self::$entityspec === null) {
            self::$entityspec = self::schema_decode(json_decode(self::ENTITYSPEC_DATA));
        }
        return self::$entityspec;
    }

    /**
     * Decode WITHOUT the assoc flag, then convert — for the one reason
     * config.php decodes the same way.
     *
     * php has a single array type, so json_decode with the assoc flag
     * renders an empty object and an empty list identically. Struct tells a
     * map from a list, so every empty map in the spec — utility, a feature's
     * rates, the OPEN-only entity template — arrived as an empty LIST and
     * was rejected with "Expected map, but found no value". Decoding to
     * stdClass keeps the distinction long enough to preserve it.
     *
     * config.php patches its two known empty maps by hand afterwards; the
     * spec has too many to enumerate and would gain one whenever a feature
     * declares a map option, so this restores every one of them by shape.
     */
    private static function schema_decode(mixed $v): mixed
    {
        if ($v instanceof \\stdClass) {
            $vars = get_object_vars($v);
            if (count($vars) === 0) {
                return (object)[];
            }
            $out = [];
            foreach ($vars as $k => $c) {
                $out[$k] = self::schema_decode($c);
            }
            return $out;
        }
        if (is_array($v)) {
            return array_map([self::class, 'schema_decode'], $v);
        }
        return $v;
    }
}
`)
  })
})


export {
  Schema
}
