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

    public static function call(PlaystationStoreApi2Context $ctx): string
    {
        return self::METHOD_MAP[$ctx->op->name] ?? 'GET';
    }
}
