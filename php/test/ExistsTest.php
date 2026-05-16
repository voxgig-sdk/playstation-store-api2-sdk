<?php
declare(strict_types=1);

// PlaystationStoreApi2 SDK exists test

require_once __DIR__ . '/../playstationstoreapi2_sdk.php';

use PHPUnit\Framework\TestCase;

class ExistsTest extends TestCase
{
    public function test_create_test_sdk(): void
    {
        $testsdk = PlaystationStoreApi2SDK::test(null, null);
        $this->assertNotNull($testsdk);
    }
}
