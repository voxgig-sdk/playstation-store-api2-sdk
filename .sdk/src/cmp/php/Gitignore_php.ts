
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

# composer install writes composer.lock, and a generated SDK is a LIBRARY, not
# an application: Composer's own guidance is that a library does not commit its
# lock file, because the versions it would pin are the ones a consumer has to be
# free to resolve.
#
# Leaving it untracked-but-not-ignored was worse than untidy. A fleet-wide test
# run calls composer install in every repo, so all of them then read as dirty —
# and the pre-flight "is any repo dirty" check exists because pub-regen wipes
# uncommitted work. 609 dirty repos hide the one that is really carrying
# something.
composer.lock

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
