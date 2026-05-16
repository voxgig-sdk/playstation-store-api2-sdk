<?php
declare(strict_types=1);

// PlaystationStoreApi2 SDK utility: prepare_params

class PlaystationStoreApi2PrepareParams
{
    public static function call(PlaystationStoreApi2Context $ctx): array
    {
        $utility = $ctx->utility;
        $point = $ctx->point;
        $params = [];
        if ($point) {
            $args = \Voxgig\Struct\Struct::getprop($point, 'args');
            if (is_array($args)) {
                $p = \Voxgig\Struct\Struct::getprop($args, 'params');
                if (is_array($p)) {
                    $params = $p;
                }
            }
        }
        $out = [];
        foreach ($params as $pd) {
            $val = ($utility->param)($ctx, $pd);
            if ($val !== null && is_array($pd)) {
                $name = \Voxgig\Struct\Struct::getprop($pd, 'name');
                if (is_string($name) && $name !== '') {
                    $out[$name] = $val;
                }
            }
        }
        return $out;
    }
}
