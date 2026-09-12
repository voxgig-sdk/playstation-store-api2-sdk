
import {
  Content,
  File,
  cmp,
} from '@voxgig/sdkgen'


const Gitignore = cmp(async function Gitignore(_props: any) {
  File({ name: '.gitignore' }, () => {
    Content(`# Composer (the package root only: test/vendor/ is the vendored
# omni test runner, generated output that a checkout must carry, and an
# unanchored vendor/ silently kept it out of every commit and so out of CI)
/vendor/
composer.phar

# PHPUnit
.phpunit.cache/
.phpunit.result.cache

# Coverage
coverage/

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
