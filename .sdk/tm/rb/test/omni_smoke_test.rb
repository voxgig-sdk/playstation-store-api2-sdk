# Smoke tests for the vendored omni runner itself: a runner that cannot
# FAIL a bad entry would turn every corpus suite vacuously green, so pin
# the failure paths, not just the happy one. (Ruby peer of ts's
# test/omni.test.ts and py's test_omni_smoke.py.)

require "minitest/autorun"
require_relative "../PlaystationStoreApi2_sdk"
require_relative "omni"

class OmniSmokeTest < Minitest::Test
  # A minimal in-memory spec: no fixture file, no OMNI block (lenient v0,
  # like the shared corpus).
  SMOKE_SPEC = {
    "primary" => {
      "smoke" => {
        "basic" => {
          "set" => [
            { "in" => 1, "out" => 2 },
            { "in" => 41, "out" => 42 },
          ],
        },
        "bad" => {
          "set" => [
            { "in" => 1, "out" => 999 },
          ],
        },
        "err" => {
          "set" => [
            { "in" => 0, "err" => "zero refused" },
          ],
        },
      },
    },
  }.freeze

  INC = lambda do |n|
    raise "smoke: zero refused" if 0 == n

    n + 1
  end

  def smoke_pack
    runner = PlaystationStoreApi2Omni.make_runner(SMOKE_SPEC, PlaystationStoreApi2SDK.test(nil, nil))
    runner.call("smoke")
  end

  def test_runset_passes_a_correct_subject
    pack = smoke_pack
    pack[:runset].call(pack[:spec]["basic"], INC)
  end

  def test_runset_fails_a_wrong_result_with_omnierror
    pack = smoke_pack
    caught = assert_raises(PlaystationStoreApi2Omni::OmniError) do
      pack[:runset].call(pack[:spec]["bad"], INC)
    end
    assert_includes caught.message, "result mismatch"
  end

  def test_expected_error_matched_and_missing_error_fails
    pack = smoke_pack

    # The expected error occurs: passes.
    pack[:runset].call(pack[:spec]["err"], INC)

    # The expected error does NOT occur: must fail.
    caught = assert_raises(PlaystationStoreApi2Omni::OmniError) do
      pack[:runset].call(pack[:spec]["err"], ->(n) { n })
    end
    assert_includes caught.message, "expected error did not occur"
  end
end
