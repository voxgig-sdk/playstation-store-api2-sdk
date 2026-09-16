# PlaystationStoreApi2 SDK feature factory

require_relative 'feature/base_feature'
require_relative 'feature/ratelimit_feature'
require_relative 'feature/retry_feature'
require_relative 'feature/test_feature'
require_relative 'feature/timeout_feature'


module PlaystationStoreApi2Features
  def self.make_feature(name)
    case name
    when "base"
      PlaystationStoreApi2BaseFeature.new
    when "ratelimit"
      PlaystationStoreApi2RatelimitFeature.new
    when "retry"
      PlaystationStoreApi2RetryFeature.new
    when "test"
      PlaystationStoreApi2TestFeature.new
    when "timeout"
      PlaystationStoreApi2TimeoutFeature.new
    else
      PlaystationStoreApi2BaseFeature.new
    end
  end
end
