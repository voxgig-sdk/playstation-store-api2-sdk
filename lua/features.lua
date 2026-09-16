-- PlaystationStoreApi2 SDK feature factory

local BaseFeature = require("feature.base_feature")
local RatelimitFeature = require("feature.ratelimit_feature")
local RetryFeature = require("feature.retry_feature")
local TestFeature = require("feature.test_feature")
local TimeoutFeature = require("feature.timeout_feature")


local features = {}

features.base = function()
  return BaseFeature.new()
end

features["ratelimit"] = function()
  return RatelimitFeature.new()
end

features["retry"] = function()
  return RetryFeature.new()
end

features["test"] = function()
  return TestFeature.new()
end

features["timeout"] = function()
  return TimeoutFeature.new()
end


return features
