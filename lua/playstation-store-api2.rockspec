package = "voxgig-sdk-playstation-store-api2"
version = "0.0.1-1"
source = {
  -- git+https (GitHub dropped git:// in 2022); pin the install to the release
  -- tag pushed by `make publish`, and point at the lua/ subdir of the monorepo.
  url = "git+https://github.com/voxgig-sdk/playstation-store-api2-sdk.git",
  tag = "lua/v0.0.1",
  dir = "playstation-store-api2-sdk/lua"
}
description = {
  summary = "Unofficial generated Lua SDK for the PlayStation Store public API. Not affiliated with or endorsed by the upstream API provider.",
  homepage = "https://github.com/voxgig-sdk/playstation-store-api2-sdk",
  issues_url = "https://github.com/voxgig-sdk/playstation-store-api2-sdk/issues",
  license = "MIT",
  labels = { "voxgig", "sdk", "generated-sdk", "openapi", "api-client", "playstation-store-api2" }
}
dependencies = {
  "lua >= 5.3",
  "dkjson >= 2.5",
}
build = {
  type = "builtin",
  modules = {
    ["playstation-store-api2_sdk"] = "playstation-store-api2_sdk.lua",
    ["config"] = "config.lua",
    ["features"] = "features.lua",
  }
}
