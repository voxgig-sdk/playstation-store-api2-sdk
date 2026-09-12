# VENDORED: @voxgig/omni 0.1.0 (python/voxgig_omni/__init__.py)
# Source: https://github.com/voxgig/omni @ 274708cc2d12b21707d975543953f845f8444be0  [tag: sdk-20260911-2013-0]
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
