# PlaystationStoreApi2 SDK utility: prepare_method
require_relative 'struct/voxgig_struct'
module PlaystationStoreApi2Utilities
  METHOD_MAP = { "create"=>"POST", "update"=>"PUT", "load"=>"GET", "list"=>"GET", "remove"=>"DELETE", "patch"=>"PATCH" }

  # The API definition is authoritative: a POST-only or PATCH-based API
  # exposes `update` as POST or PATCH, not the PUT the op name implies.
  # Only fall back to the op-name convention when the point has no method.
  PrepareMethod = ->(ctx) {
    method = VoxgigStruct.getprop(ctx.point, "method")
    next method.upcase if method.is_a?(String) && "" != method
    # No default: an op name outside the convention resolves to no method,
    # exactly as the ts reference (`methodMap[key]` is undefined there).
    # The silent-pass inline runner hid a stray "GET" fallback here; the
    # shared corpus (prepareMethod, opname "bad" -> null) pins it now.
    METHOD_MAP[ctx.op.name]
  }
end
