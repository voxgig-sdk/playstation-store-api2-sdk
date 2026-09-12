<?php
declare(strict_types=1);

// Smoke tests for the vendored omni runner itself: a runner that cannot
// FAIL a bad entry would turn every corpus suite vacuously green, so pin
// the failure paths, not just the happy one. (PHP peer of ts's
// test/omni.test.ts and py's test_omni_smoke.py.)

require_once __DIR__ . '/../playstationstoreapi2_sdk.php';
require_once __DIR__ . '/Omni.php';

use PHPUnit\Framework\TestCase;
use Voxgig\Omni\OmniError;

class OmniSmokeTest extends TestCase
{
    // A minimal in-memory spec: no fixture file, no OMNI block (lenient
    // v0, like the shared corpus).
    private const SPEC = [
        'primary' => [
            'smoke' => [
                'basic' => [
                    'set' => [
                        ['in' => 1, 'out' => 2],
                        ['in' => 41, 'out' => 42],
                    ],
                ],
                'bad' => [
                    'set' => [
                        ['in' => 1, 'out' => 999],
                    ],
                ],
                'err' => [
                    'set' => [
                        ['in' => 0, 'err' => 'zero refused'],
                    ],
                ],
            ],
        ],
    ];

    private static function inc()
    {
        return function ($n) {
            if (0 === $n) {
                throw new \Exception('smoke: zero refused');
            }
            return $n + 1;
        };
    }

    private static function pack(): array
    {
        $runner = PlaystationStoreApi2Omni::makeRunner(self::SPEC, PlaystationStoreApi2SDK::test(null, null));
        return $runner('smoke');
    }

    public function test_runset_passes_a_correct_subject(): void
    {
        $R = self::pack();
        $R['runset']($R['spec']['basic'], self::inc());
        $this->assertTrue(true);
    }

    public function test_runset_fails_a_wrong_result_with_omnierror(): void
    {
        $R = self::pack();
        try {
            $R['runset']($R['spec']['bad'], self::inc());
        } catch (OmniError $err) {
            $this->assertStringContainsString('result mismatch', $err->getMessage());
            return;
        }
        $this->fail('a wrong result did not raise OmniError');
    }

    public function test_expected_error_matched_and_missing_error_fails(): void
    {
        $R = self::pack();

        // The expected error occurs: passes.
        $R['runset']($R['spec']['err'], self::inc());

        // The expected error does NOT occur: must fail.
        try {
            $R['runset']($R['spec']['err'], function ($n) { return $n; });
        } catch (OmniError $err) {
            $this->assertStringContainsString('expected error did not occur', $err->getMessage());
            return;
        }
        $this->fail('a missing expected error did not raise OmniError');
    }
}
