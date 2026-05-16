# PlaystationStoreApi2 SDK utility: make_context
require_relative '../core/context'
module PlaystationStoreApi2Utilities
  MakeContext = ->(ctxmap, basectx) {
    PlaystationStoreApi2Context.new(ctxmap, basectx)
  }
end
