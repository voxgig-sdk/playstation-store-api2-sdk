# Smoke tests for the vendored omni runner itself: a runner that cannot
# FAIL a bad entry would turn every corpus suite vacuously green, so pin
# the failure paths, not just the happy one. (Python peer of ts's
# test/omni.test.ts.)

import unittest

from playstationstoreapi2_sdk import PlaystationStoreApi2SDK

from test.omni import OmniError, makeRunner


# A minimal in-memory spec: no fixture file, no OMNI block (lenient v0,
# like the shared corpus).
SPEC = {
    'primary': {
        'smoke': {
            'basic': {
                'set': [
                    {'in': 1, 'out': 2},
                    {'in': 41, 'out': 42},
                ],
            },
            'bad': {
                'set': [
                    {'in': 1, 'out': 999},
                ],
            },
            'err': {
                'set': [
                    {'in': 0, 'err': 'zero refused'},
                ],
            },
        },
    },
}


def inc(n):
    if 0 == n:
        raise ValueError('smoke: zero refused')
    return n + 1


class TestOmniSmoke(unittest.TestCase):

    def _pack(self):
        runner = makeRunner(SPEC, PlaystationStoreApi2SDK.test(None, None))
        return runner('smoke')

    def test_runset_passes_a_correct_subject(self):
        R = self._pack()
        R['runset'](R['spec']['basic'], inc)

    def test_runset_fails_a_wrong_result_with_omnierror(self):
        R = self._pack()
        with self.assertRaises(OmniError) as caught:
            R['runset'](R['spec']['bad'], inc)
        self.assertIn('result mismatch', str(caught.exception))

    def test_expected_error_matched_and_missing_error_fails(self):
        R = self._pack()

        # The expected error occurs: passes.
        R['runset'](R['spec']['err'], inc)

        # The expected error does NOT occur: must fail.
        with self.assertRaises(OmniError) as caught:
            R['runset'](R['spec']['err'], lambda n: n)
        self.assertIn('expected error did not occur', str(caught.exception))


if __name__ == '__main__':
    unittest.main()
