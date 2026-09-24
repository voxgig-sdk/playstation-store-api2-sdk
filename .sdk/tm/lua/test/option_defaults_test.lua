-- PlaystationStoreApi2 SDK option defaults test
--
-- make_options validates the configured entity defaults once per Lua state
-- rather than per client: struct's lua getprop scans the parent to classify
-- it, which made validating n entities cost n^2 on every construction.

local sdk = require("project-name-_sdk")
local vs = require("utility.struct.struct")
local schema = require("schema")
local config = require("config_shared")()


local function configured()
  local names = {}
  for name, _ in pairs(config.options.entity or {}) do
    table.insert(names, name)
  end
  table.sort(names)
  return names
end


local function whole(user)
  local merged = vs.merge({ {}, vs.clone(config.options.entity or {}), vs.clone(user or {}) })
  local out = vs.validate({ entity = merged }, { entity = schema.OPTSPEC["entity"] })
  return out.entity
end


describe("make_options entity", function()

  it("matches validating the whole entity map at once", function()
    assert.are.same(whole(nil), sdk.test().options.entity)

    local name = configured()[1]
    if name ~= nil then
      local user = {
        [name] = { active = true, alias = { a = "b" } },
        not_configured = { active = true },
      }
      assert.are.same(whole(user), sdk.test(nil, { entity = user }).options.entity)
    end
  end)


  it("keeps each client's entity options its own", function()
    local name = configured()[1]
    if name == nil then
      return
    end
    local a = sdk.test()
    a.options.entity[name].active = true
    a.options.entity[name].alias.leak = true
    local b = sdk.test()
    assert.are.equal(false, b.options.entity[name].active)
    assert.is_nil(b.options.entity[name].alias.leak)
  end)


  it("validates the configured entity map at most once for many clients", function()
    local names = configured()
    local full = 0
    local validate = vs.validate
    vs.validate = function(data, spec, injdef)
      local ent = type(data) == "table" and data.entity or nil
      if type(ent) == "table" and 1 < #names then
        local all = true
        for _, name in ipairs(names) do
          if ent[name] == nil then
            all = false
            break
          end
        end
        if all then
          full = full + 1
        end
      end
      return validate(data, spec, injdef)
    end

    local ok, err = pcall(function()
      for _ = 1, 3 do
        sdk.test()
      end
    end)
    vs.validate = validate

    assert.is_true(ok, tostring(err))
    assert.is_true(full <= 1, "entity map validated " .. full .. " times for 3 clients")
  end)

end)
