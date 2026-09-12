-- PlaystationStoreApi2 SDK feature plugin definitions
--
-- The sekreto plugin DEFINITIONS the model selected per feature, required
-- below from the modules the catalogue's active `plugin.def` entries
-- declare. Handed to each feature (secrets builds its Sekreto with them):
-- a provider kind not listed here is unknown to this SDK - the four
-- built-in kinds (env, memory, dotenv, file) come with the core and never
-- appear here.


local FEATURE_PLUGINS = {
}


-- The definitions list for one feature's chain; empty when the model
-- selected no plugin group for it.
return function(name)
  return FEATURE_PLUGINS[name] or {}
end
