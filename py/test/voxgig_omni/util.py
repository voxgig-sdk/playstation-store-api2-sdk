# VENDORED: @voxgig/omni 0.1.0 (python/voxgig_omni/util.py)
# Source: https://github.com/voxgig/omni @ 274708cc2d12b21707d975543953f845f8444be0  [tag: sdk-20260911-2013-0]
# License: MIT (c) voxgig - see repository LICENSE. Do not edit: resync from upstream.
"""Omni internal JSON utilities.

This module is deliberately self-contained: the omni runner must be able to
test *any* library, including libraries that provide these same operations,
so it can never borrow them from the system under test. Zero third-party
dependencies, by design.
"""

from typing import Any

NULLMARK = '__NULL__'  # Value is JSON null.
UNDEFMARK = '__UNDEF__'  # Value is not present (thus, undefined).
EXISTSMARK = '__EXISTS__'  # Value exists (not undefined).


class Absent:
    """Python has no `undefined`, so absence needs its own marker."""

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __repr__(self):
        return 'ABSENT'

    def __bool__(self):
        return False


ABSENT = Absent()


def ismap(val: Any) -> bool:
    """A map (JSON object)?"""
    return isinstance(val, dict)


def islist(val: Any) -> bool:
    """A list (JSON array)?"""
    return isinstance(val, (list, tuple))


def isnode(val: Any) -> bool:
    """A container (map or list)?"""
    return ismap(val) or islist(val)


def isnum(val: Any) -> bool:
    """A JSON number? Booleans are not numbers."""
    return isinstance(val, (int, float)) and not isinstance(val, bool)


def clone(val: Any) -> Any:
    """Deep copy a JSON value. Other values pass through by reference."""
    if islist(val):
        return [clone(entry) for entry in val]

    if ismap(val):
        return {key: clone(subval) for key, subval in val.items()}

    return val


def getpath(val: Any, path: list) -> Any:
    """Read a value by path. Returns ABSENT when any step is missing."""
    current = val

    for part in path:
        if islist(current):
            try:
                index = int(part)
            except (TypeError, ValueError):
                return ABSENT
            if index < 0 or index >= len(current):
                return ABSENT
            current = current[index]
        elif ismap(current):
            key = str(part)
            if key not in current:
                return ABSENT
            current = current[key]
        else:
            return ABSENT

    return current


def walk(val: Any, apply, key=None, parent=None, path=None) -> Any:
    """Depth-first walk: children first, then the containing node."""
    curpath = [] if path is None else path

    if isnode(val):
        if islist(val):
            for index in range(len(val)):
                val[index] = walk(val[index], apply, index, val, curpath + [index])
        else:
            for childkey in list(val.keys()):
                val[childkey] = walk(val[childkey], apply, childkey, val, curpath + [childkey])

    return apply(key, val, parent, curpath)


def deepequal(a: Any, b: Any) -> bool:
    """Deep structural equality: numbers by value, bools never numbers."""
    if a is b:
        return True

    if isinstance(a, bool) or isinstance(b, bool):
        return a is b

    if isnum(a) and isnum(b):
        # NaN equals NaN: deepequal is structural, not IEEE (as canonical).
        return a == b or (a != a and b != b)

    if a is None or b is None or a is ABSENT or b is ABSENT:
        return a is b

    if islist(a) and islist(b):
        if len(a) != len(b):
            return False
        return all(deepequal(a[i], b[i]) for i in range(len(a)))

    if ismap(a) and ismap(b):
        if len(a) != len(b):
            return False
        for key, val in a.items():
            if key not in b:
                return False
            if not deepequal(val, b[key]):
                return False
        return True

    if islist(a) != islist(b) or ismap(a) != ismap(b):
        return False

    return a == b


def numstr(val: Any) -> str:
    """Render a number the same way in every port: 5.0 prints as 5."""
    if isinstance(val, float):
        if val != val or val in (float('inf'), float('-inf')):
            return 'null'
        if val.is_integer() and abs(val) < 2**53:
            return str(int(val))
        return repr(val)
    return str(val)


def _quote(val: str) -> str:
    out = ['"']
    for char in val:
        if char == '"':
            out.append('\\"')
        elif char == '\\':
            out.append('\\\\')
        elif char == '\n':
            out.append('\\n')
        elif char == '\r':
            out.append('\\r')
        elif char == '\t':
            out.append('\\t')
        elif ord(char) < 0x20:
            out.append('\\u%04x' % ord(char))
        else:
            out.append(char)
    out.append('"')
    return ''.join(out)


def jsonstr(val: Any, seen: set | None = None) -> str:
    """Compact JSON text with map keys sorted, identical in every port.

    GUARDED against cycles: this renders FAILURE MESSAGES, and an entry
    carrying a live cyclic value recursed until the stack gave out. A
    cycle renders as "[Circular]". ``seen`` tracks the ANCESTORS of the
    current value, removed again on the way out, so a DAG still renders
    in full.
    """
    if val is ABSENT:
        return 'undefined'

    if val is None:
        return 'null'

    if isinstance(val, bool):
        return 'true' if val else 'false'

    if isinstance(val, str):
        return _quote(val)

    if isnum(val):
        return numstr(val)

    if islist(val) or ismap(val):
        seen = seen if seen is not None else set()
        if id(val) in seen:
            return '"[Circular]"'
        seen.add(id(val))
        if islist(val):
            out = '[' + ','.join(jsonstr(entry, seen) for entry in val) + ']'
        else:
            out = (
                '{'
                + ','.join(
                    _quote(str(key)) + ':' + jsonstr(val[key], seen)
                    for key in sorted(val.keys()))
                + '}'
            )
        seen.discard(id(val))
        return out

    if callable(val):
        return '[Function ' + getattr(val, '__name__', '') + ']'

    return _quote(str(val))


def stringify(val: Any) -> str:
    """Strings verbatim, everything else as compact JSON."""
    return val if isinstance(val, str) else jsonstr(val)


def pathify(path: list) -> str:
    """Render a path as a dotted string."""
    return '.'.join(str(part) for part in (path or []))


__all__ = [
    'ABSENT',
    'EXISTSMARK',
    'NULLMARK',
    'UNDEFMARK',
    'clone',
    'deepequal',
    'getpath',
    'islist',
    'ismap',
    'isnode',
    'isnum',
    'jsonstr',
    'numstr',
    'pathify',
    'stringify',
    'walk',
]
