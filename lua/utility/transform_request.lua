-- PlaystationStoreApi2 SDK utility: transform_request

local vs = require("utility.struct.struct")
local helpers = require("core.helpers")

-- `$action` selects the point (see make_point_util); it is never an API
-- field, so the body is a copy without it. The caller's table is left
-- untouched.
local function strip_action(reqdata)
  if not vs.ismap(reqdata) or reqdata["$action"] == nil then
    return reqdata
  end
  local body = {}
  for k, v in pairs(reqdata) do
    if k ~= "$action" then
      body[k] = v
    end
  end
  return body
end

local function transform_request_util(ctx)
  local spec = ctx.spec
  local point = ctx.point

  if spec ~= nil then
    spec.step = "reqform"
  end

  local transform = helpers.to_map(vs.getprop(point, "transform"))
  if transform == nil then
    return strip_action(ctx.reqdata)
  end

  local reqform = vs.getprop(transform, "req")
  if reqform == nil then
    return strip_action(ctx.reqdata)
  end

  local reqdata = vs.transform({
    reqdata = ctx.reqdata,
  }, reqform)

  return strip_action(reqdata)
end

return transform_request_util
