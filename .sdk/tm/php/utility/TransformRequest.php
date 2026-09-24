<?php
declare(strict_types=1);

// PlaystationStoreApi2 SDK utility: transform_request

require_once __DIR__ . '/../core/Helpers.php';

class PlaystationStoreApi2TransformRequest
{
    public static function call(PlaystationStoreApi2Context $ctx): mixed
    {
        $spec = $ctx->spec;
        $point = $ctx->point;
        if ($spec) {
            $spec->step = 'reqform';
        }
        $transform = PlaystationStoreApi2Helpers::to_map(\Voxgig\Struct\Struct::getprop($point, 'transform'));
        if (!$transform) {
            return self::strip_action($ctx->reqdata);
        }
        $reqform = \Voxgig\Struct\Struct::getprop($transform, 'req');
        if (!$reqform) {
            return self::strip_action($ctx->reqdata);
        }
        return self::strip_action(\Voxgig\Struct\Struct::transform(['reqdata' => $ctx->reqdata], $reqform));
    }

    // `$action` selects the point (see MakePoint); it is never an API field,
    // so the body is a copy without it. Arrays are values, so the unset
    // never reaches the caller's copy.
    private static function strip_action(mixed $reqdata): mixed
    {
        if (!is_array($reqdata) || !array_key_exists('$action', $reqdata)) {
            return $reqdata;
        }
        unset($reqdata['$action']);
        return $reqdata;
    }
}
