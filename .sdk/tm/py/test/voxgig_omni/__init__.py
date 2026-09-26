# VENDORED: @voxgig/omni 0.1.0 (python/voxgig_omni/__init__.py)
# Source: https://github.com/voxgig/omni @ b909ff51fc644e4955c850e30cc65e74be076df2  [tag: sdk-20260925-1316-0]
# License: MIT (c) voxgig - see repository LICENSE. Do not edit: resync from upstream.
"""voxgig_omni - shared multi-language test runner."""

from .runner import (
    CAPABILITIES,
    EXISTSMARK,
    NULLMARK,
    SPECVERSION,
    UNDEFMARK,
    OmniError,
    errify,
    fixjson,
    loadspec,
    makeRunner,
    match,
    matchval,
    nullmodifier,
    resolvespec,
)
from .util import (
    ABSENT,
    clone,
    deepequal,
    getpath,
    islist,
    ismap,
    isnode,
    jsonstr,
    pathify,
    stringify,
    walk,
)

__all__ = [
    'ABSENT',
    'CAPABILITIES',
    'EXISTSMARK',
    'NULLMARK',
    'SPECVERSION',
    'UNDEFMARK',
    'OmniError',
    'clone',
    'deepequal',
    'errify',
    'fixjson',
    'getpath',
    'islist',
    'ismap',
    'isnode',
    'jsonstr',
    'loadspec',
    'makeRunner',
    'match',
    'matchval',
    'nullmodifier',
    'pathify',
    'resolvespec',
    'stringify',
    'walk',
]
