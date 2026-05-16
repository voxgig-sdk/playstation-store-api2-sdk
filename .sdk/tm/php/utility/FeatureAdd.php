<?php
declare(strict_types=1);

// PlaystationStoreApi2 SDK utility: feature_add

class PlaystationStoreApi2FeatureAdd
{
    public static function call(PlaystationStoreApi2Context $ctx, mixed $f): void
    {
        $ctx->client->features[] = $f;
    }
}
