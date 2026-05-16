<?php
declare(strict_types=1);

// PlaystationStoreApi2 SDK utility: prepare_body

class PlaystationStoreApi2PrepareBody
{
    public static function call(PlaystationStoreApi2Context $ctx): mixed
    {
        if ($ctx->op->input === 'data') {
            return ($ctx->utility->transform_request)($ctx);
        }
        return null;
    }
}
