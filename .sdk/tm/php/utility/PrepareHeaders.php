<?php
declare(strict_types=1);

// PlaystationStoreApi2 SDK utility: prepare_headers

class PlaystationStoreApi2PrepareHeaders
{
    public static function call(PlaystationStoreApi2Context $ctx): array
    {
        $options = $ctx->client->options_map();
        $headers = \Voxgig\Struct\Struct::getprop($options, 'headers');
        if (!$headers) {
            return [];
        }
        $out = \Voxgig\Struct\Struct::clone($headers);
        return is_array($out) ? $out : [];
    }
}
