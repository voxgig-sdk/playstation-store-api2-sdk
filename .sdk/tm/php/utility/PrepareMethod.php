<?php
declare(strict_types=1);

// PlaystationStoreApi2 SDK utility: prepare_method

class PlaystationStoreApi2PrepareMethod
{
    private const METHOD_MAP = [
        'create' => 'POST',
        'update' => 'PUT',
        'load' => 'GET',
        'list' => 'GET',
        'remove' => 'DELETE',
        'patch' => 'PATCH',
    ];

    public static function call(PlaystationStoreApi2Context $ctx): ?string
    {
        // The API definition is authoritative: a POST-only or PATCH-based API
        // exposes `update` as POST or PATCH, not the PUT the op name implies.
        // Only fall back to the op-name convention when the point has no method.
        $point = $ctx->point;
        if ($point) {
            $method = \Voxgig\Struct\Struct::getprop($point, 'method');
            if (is_string($method) && '' !== $method) {
                return strtoupper($method);
            }
        }

        // No default: an op name outside the convention resolves to no method,
        // exactly as the ts reference (`methodMap[key]` is undefined there).
        // The silent-pass inline runner hid a stray 'GET' fallback here; the
        // shared corpus (prepareMethod, opname "bad" -> null) pins it now.
        return self::METHOD_MAP[$ctx->op->name] ?? null;
    }
}
