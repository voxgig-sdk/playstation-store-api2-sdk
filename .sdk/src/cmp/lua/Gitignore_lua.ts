
import {
  Content,
  File,
  cmp,
} from '@voxgig/sdkgen'


const Gitignore = cmp(async function Gitignore(_props: any) {
  File({ name: '.gitignore' }, () => {
    Content(`# Compiled Lua
*.luac

# Native libraries built by LuaRocks
*.so
*.dylib
*.dll

# The sekreto transport helper the secrets feature's plugin kinds run,
# compiled by \`make build\` from feature/secrets/native/sekretonet.c
feature/secrets/native/sekreto-net

# LuaRocks
.luarocks/
lua_modules/
*.rock

# Coverage
luacov.stats.out
luacov.report.out

# IDE / OS
.idea/
.vscode/
.DS_Store
`)
  })
})


export {
  Gitignore
}
