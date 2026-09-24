-- PlaystationStoreApi2 SDK control

local Control = {}
Control.__index = Control


function Control.new(opts)
  opts = opts or {}
  local self = setmetatable({}, Control)
  self.throw_err = opts.throw_err
  self.err = nil
  self.explain = opts.explain
  -- Per-call feature inputs (audit actor, paging cursor/page).
  self.actor = opts.actor
  self.paging = opts.paging
  return self
end


return Control
