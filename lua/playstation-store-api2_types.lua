-- Typed models for the PlaystationStoreApi2 SDK (LuaLS annotations).
--
-- GENERATED from the API model: main.kit.entity.<e>.fields[] and per-op
-- params (op.<name>.points[].args.params[]). Field/param types come from the
-- canonical type sentinels via @voxgig/sdkgen canonToType (source of truth:
-- @voxgig/apidef VALID_CANON). Annotations only — no runtime effect. Do not
-- edit by hand.

---@class Container
---@field age_limit? number
---@field attribute? table
---@field container_type? string
---@field content_origin? number
---@field dob_required? boolean
---@field id? string
---@field image? table
---@field link? table

---@class ContainerListMatch
---@field age_limit string
---@field container_id string
---@field country string
---@field language string

local M = {}

return M
