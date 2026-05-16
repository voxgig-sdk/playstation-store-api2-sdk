<?php
declare(strict_types=1);

// PlaystationStoreApi2 SDK feature factory

require_once __DIR__ . '/feature/BaseFeature.php';
require_once __DIR__ . '/feature/TestFeature.php';


class PlaystationStoreApi2Features
{
    public static function make_feature(string $name)
    {
        switch ($name) {
            case "base":
                return new PlaystationStoreApi2BaseFeature();
            case "test":
                return new PlaystationStoreApi2TestFeature();
            default:
                return new PlaystationStoreApi2BaseFeature();
        }
    }
}
