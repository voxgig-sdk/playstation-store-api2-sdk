# PlaystationStoreApi2 SDK feature factory

require_relative 'feature/base_feature'
require_relative 'feature/test_feature'


module PlaystationStoreApi2Features
  def self.make_feature(name)
    case name
    when "base"
      PlaystationStoreApi2BaseFeature.new
    when "test"
      PlaystationStoreApi2TestFeature.new
    else
      PlaystationStoreApi2BaseFeature.new
    end
  end
end
