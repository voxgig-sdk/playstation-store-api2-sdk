<?php
declare(strict_types=1);

// PlaystationStoreApi2 SDK utility: make_context

require_once __DIR__ . '/../core/Context.php';

class PlaystationStoreApi2MakeContext
{
    public static function call(array $ctxmap, ?PlaystationStoreApi2Context $basectx): PlaystationStoreApi2Context
    {
        return new PlaystationStoreApi2Context($ctxmap, $basectx);
    }
}
