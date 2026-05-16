package = "voxgig-sdk-playstation-store-api2"
version = "0.0-1"
source = {
  url = "git://github.com/voxgig-sdk/playstation-store-api2-sdk.git"
}
description = {
  summary = "PlaystationStoreApi2 SDK for Lua",
  license = "MIT"
}
dependencies = {
  "lua >= 5.3",
  "dkjson >= 2.5",
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
