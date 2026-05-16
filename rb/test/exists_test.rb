# PlaystationStoreApi2 SDK exists test

require "minitest/autorun"
require_relative "../PlaystationStoreApi2_sdk"

class ExistsTest < Minitest::Test
  def test_create_test_sdk
    testsdk = PlaystationStoreApi2SDK.test(nil, nil)
    assert !testsdk.nil?
  end
end
