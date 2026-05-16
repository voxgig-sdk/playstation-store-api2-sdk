-- ProjectName SDK exists test

local sdk = require("playstation-store-api2_sdk")

describe("PlaystationStoreApi2SDK", function()
  it("should create test SDK", function()
    local testsdk = sdk.test(nil, nil)
    assert.is_not_nil(testsdk)
  end)
end)
