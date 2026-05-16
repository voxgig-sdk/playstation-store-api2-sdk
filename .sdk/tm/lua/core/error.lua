-- PlaystationStoreApi2 SDK error

local PlaystationStoreApi2Error = {}
PlaystationStoreApi2Error.__index = PlaystationStoreApi2Error


function PlaystationStoreApi2Error.new(code, msg, ctx)
  local self = setmetatable({}, PlaystationStoreApi2Error)
  self.is_sdk_error = true
  self.sdk = "PlaystationStoreApi2"
  self.code = code or ""
  self.msg = msg or ""
  self.ctx = ctx
  self.result = nil
  self.spec = nil
  return self
end


function PlaystationStoreApi2Error:error()
  return self.msg
end


function PlaystationStoreApi2Error:__tostring()
  return self.msg
end


return PlaystationStoreApi2Error
