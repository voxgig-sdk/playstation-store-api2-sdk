# VENDORED: @voxgig/omni 0.1.0 (python/voxgig_omni/runner.py)
# Source: https://github.com/voxgig/omni @ 274708cc2d12b21707d975543953f845f8444be0  [tag: sdk-20260911-2013-0]
# License: MIT (c) voxgig - see repository LICENSE. Do not edit: resync from upstream.
"""Omni: the shared multi-language test runner.

Port of the canonical TypeScript implementation
(typescript/src/Runner.ts). Behaviour must match, case for case.
"""

import json
import re
from typing import Any, Callable, Optional

from .util import (
    ABSENT,
    EXISTSMARK,
    NULLMARK,
    UNDEFMARK,
    clone,
    deepequal,
    getpath,
    islist,
    ismap,
    isnode,
    isnum,
    pathify,
    stringify,
    walk,
)

# The newest spec format version this runner understands. A spec with no
# OMNI block is version 0: the original, lenient format, frozen forever.
# Version 1 turns on strict entry validation (see checkentry).
SPECVERSION = 1

# Capability strings this runner supports beyond the version baseline. A
# spec's OMNI.requires list is checked against this: an unknown capability
# refuses the spec loudly at load time, instead of a lagging port silently
# mis-running it. (Empty today; future format features mint a string here.)
CAPABILITIES: list = []

# The complete set of fields an entry may carry. Under version 1 anything
# else is an error: an unrecognised key is almost always a typo'd
# assertion, and a typo'd assertion is a test that silently stopped
# testing.
ENTRYFIELDS = ['in', 'args', 'ctx', 'out', 'err', 'match', 'client', 'id', 'doc']


class OmniError(AssertionError):
    """A test failure (or a malformed spec).

    Distinct from errors raised by the subject under test, which are
    candidates for an `err` expectation.
    """

    def __init__(self, message: str, entry: Any = None):
        super().__init__(message)
        self.entry = entry


def loadspec(specref: Any) -> Any:
    """Load a spec: a path to a JSON file, or an already-parsed object."""
    if isinstance(specref, str):
        with open(specref, encoding='utf-8') as spechandle:
            return json.load(spechandle)
    return specref


def resolveversion(alltests: Any) -> int:
    """Read the spec's format version from its optional top-level OMNI
    block, and refuse a spec this runner cannot faithfully run: a version
    newer than SPECVERSION, or a required capability not in CAPABILITIES.
    """
    if not ismap(alltests) or 'OMNI' not in alltests:
        return 0

    meta = alltests['OMNI']
    version = meta.get('version') if ismap(meta) else None

    if not ismap(meta) or not isnum(version) or version % 1 != 0:
        raise OmniError('omni: malformed OMNI version block')

    if version < 0 or version > SPECVERSION:
        raise OmniError('omni: unsupported spec version: ' + stringify(version))

    if 'requires' in meta:
        requires = meta['requires']
        if not islist(requires):
            raise OmniError('omni: malformed OMNI requires list')
        for cap in requires:
            if not isinstance(cap, str) or cap not in CAPABILITIES:
                raise OmniError('omni: spec requires unsupported capability: ' + stringify(cap))

    return int(version)


def checkentry(flags: dict, index: int, entry: Any) -> None:
    """Strict entry validation, applied when the spec declares version 1
    or later. The lenient format converts each of these mistakes into a
    silent pass or a dead field; here they fail with the entry named.
    """
    if not ismap(entry):
        raise fail(flags, index, entry, 'entry is not a map')

    for key in entry.keys():
        if key not in ENTRYFIELDS:
            raise fail(flags, index, entry, 'unknown entry field: ' + str(key))

    argsources = 0
    for key in ('in', 'args', 'ctx'):
        if key in entry:
            argsources += 1
    if argsources > 1:
        raise fail(flags, index, entry, 'entry has more than one of in, args, ctx')

    if entry.get('err') is not None and 'out' in entry:
        raise fail(flags, index, entry, 'entry has both err and out')

    if 'id' in entry and not isinstance(entry['id'], str):
        raise fail(flags, index, entry, 'entry id is not a string')


def checkset(flags: dict, testspec: Any, normalset: list) -> None:
    """Validate a version-1 group up front, against the AUTHORED entries -
    null-normalisation would otherwise rewrite an authored null (e.g.
    id: null) into a sentinel string and hide it from validation. A
    malformed spec is a spec error, not a test result, so it fails before
    any subject runs.
    """
    origset = testspec['set'] if ismap(testspec) and islist(testspec.get('set')) else normalset

    if len(origset) == 0 and (testspec.get('empty') if ismap(testspec) else None) is not True:
        raise OmniError('omni: empty test set: ' + str(flags['name']))

    for index, entry in enumerate(origset):
        checkentry(flags, index, entry)


def resolvespec(name: Optional[str], alltests: Any) -> Any:
    """Find `primary.<name>`, then `<name>`, then the whole spec."""
    if name is None:
        return alltests

    primary = alltests.get('primary') if ismap(alltests) else None
    if ismap(primary) and primary.get(name) is not None:
        return primary[name]

    if ismap(alltests) and alltests.get(name) is not None:
        return alltests[name]

    return alltests


def resolveclients(provider: Any, spec: Any, store: Any) -> dict:
    """Build the named clients declared by the spec's DEF.client block."""
    clients: dict = {}

    defclient = spec.get('DEF', {}).get('client') if ismap(spec) else None
    if not ismap(defclient):
        return clients

    # A spec may define clients that a given test run never references.
    clientmaker = provider.get('client')
    if clientmaker is None:
        return clients

    for clientname, cdef in defclient.items():
        copts = clone((cdef.get('test', {}).get('options') if ismap(cdef) else None) or {})

        injector = provider.get('inject')
        if ismap(store) and injector is not None:
            injector(copts, store)

        clients[clientname] = clientmaker(copts)

    return clients


def resolvesubject(name: Optional[str], provider: Any) -> Optional[Callable]:
    if name is None or provider.get('subject') is None:
        return None
    return provider['subject'](name) or None


def resolveflags(flags: Optional[dict]) -> dict:
    out = {} if flags is None else dict(flags)
    out['null'] = True if out.get('null') is None else bool(out['null'])
    return out


def resolveentry(entry: dict, flags: dict) -> dict:
    """An entry with no `out` expects a null (or absent) result."""
    if entry.get('out') is None and flags['null']:
        entry['out'] = NULLMARK
    return entry


def resolvetestpack(name, entry, subject, provider, clients) -> dict:
    testpack = {'client': provider, 'subject': subject}

    if entry.get('client') is not None:
        client = clients.get(entry['client'])
        if client is None:
            raise OmniError('omni: unknown client: ' + str(entry['client']), entry)
        testpack['client'] = client
        testpack['subject'] = resolvesubject(name, client) or subject

    return testpack


def resolveargs(entry: dict, testpack: dict, provider: Any) -> list:
    """Build the argument list: `ctx`, `args`, or `in`."""
    if 'ctx' in entry:
        args = [entry['ctx']]
    elif 'args' in entry:
        args = entry['args']
    else:
        args = [clone(entry.get('in'))]

    if ('ctx' in entry or 'args' in entry) and len(args) > 0:
        first = args[0]
        if ismap(first):
            first = clone(first)
            contextify = provider.get('contextify')
            if contextify is not None:
                first = contextify(first)
            args[0] = first
            entry['ctx'] = first
            if ismap(first):
                first['client'] = testpack['client']

    return args


def fixjson(val: Any, flags: Optional[dict] = None) -> Any:
    """Nulls become NULLMARK, errors become {name,message}. Always a copy."""
    donull = True if flags is None or flags.get('null') is None else bool(flags['null'])
    return fixjsonval(val, donull)


def fixjsonval(val: Any, donull: bool) -> Any:
    if val is None or val is ABSENT:
        return NULLMARK if donull else None

    if isinstance(val, BaseException):
        return errify(val)

    if islist(val):
        return [fixjsonval(entry, donull) for entry in val]

    if ismap(val):
        return {key: fixjsonval(subval, donull) for key, subval in val.items()}

    return val


def errify(err: Any) -> dict:
    """The JSON form of an error: always at least {name,message}.

    An exception's own attributes survive into the base, so a library whose
    errors carry a ``code`` can assert on it with ``match: {err: {code}}``
    rather than pattern-matching prose. Ports whose subjects report failure
    as a bare message string have nothing to carry; ``Provider.errify``
    overrides this function entirely and is how they reach the same place.
    """
    if isinstance(err, BaseException):
        out = {key: val for key, val in vars(err).items() if not key.startswith('_')}
        out['name'] = type(err).__name__
        out['message'] = str(err)
        return out
    # An error-SHAPED plain map ({name, message, ...}) carries its fields
    # into the base the same way an exception's attributes do - collapsing
    # it to str(err) fails both the `err` check and every match.err leaf.
    if isinstance(err, dict):
        out = {'name': 'Error'}
        out.update(err)
        return out
    return {'name': 'Error', 'message': str(err)}


def errbase(err: Any, provider: Any) -> dict:
    """The error base a ``match.err`` sees: the provider's own, when it has one."""
    hook = provider.get('errify') if isinstance(provider, dict) else None
    return hook(err) if hook is not None else errify(err)


def errmessage(err: Any) -> str:
    if isinstance(err, dict) and isinstance(err.get('message'), str):
        return err['message']
    return str(err)


def entryref(flags: dict, index: int, entry: Any) -> str:
    """The label of one entry, for failure messages."""
    label = flags.get('name') or 'set'
    entryid = ''
    if ismap(entry) and entry.get('id') is not None:
        entryid = ' (' + str(entry['id']) + ')'
    return '%s[%d]%s' % (label, index, entryid)


def fail(flags, index, entry, reason, expected=None, actual=None) -> OmniError:
    msg = 'omni: ' + entryref(flags, index, entry) + ': ' + reason
    if expected is not None:
        msg += '\n  expected: ' + expected
    if actual is not None:
        msg += '\n  actual:   ' + actual
    msg += '\n  entry:    ' + stringify(entrysummary(entry))
    return OmniError(msg, entry)


def entrysummary(entry: Any) -> Any:
    """The spec-defined part of an entry (drop runner bookkeeping)."""
    if not ismap(entry):
        return entry
    return {key: val for key, val in entry.items() if key not in ('res', 'thrown', 'ctx')}


def checkresult(flags: dict, index: int, entry: dict, args: list, res: Any) -> None:
    matched = False

    if entry.get('err') is not None:
        raise fail(
            flags,
            index,
            entry,
            'expected error did not occur',
            stringify(entry['err']),
            stringify(res),
        )

    if entry.get('match') is not None:
        match(
            flags,
            index,
            entry,
            entry['match'],
            {
                'in': entry.get('in'),
                'args': args,
                'out': entry.get('res'),
                'ctx': entry.get('ctx'),
            },
        )
        matched = True

    out = entry.get('out')

    if deepequal(res, out):
        return

    # NOTE: a match with no explicit out is a complete check on its own.
    if matched and (out == NULLMARK or out is None):
        return

    raise fail(flags, index, entry, 'result mismatch', stringify(out), stringify(res))


def handleerror(
    flags: dict, index: int, entry: dict, err: BaseException, provider: Any = None
) -> None:
    entry['thrown'] = err

    entryerr = entry.get('err')

    if entryerr is not None:
        if entryerr is True or matchval(entryerr, errmessage(err)):
            if entry.get('match') is not None:
                match(
                    flags,
                    index,
                    entry,
                    entry['match'],
                    {
                        'in': entry.get('in'),
                        'out': entry.get('res'),
                        'ctx': entry.get('ctx'),
                        'err': errbase(err, provider),
                    },
                )
            return

        raise fail(flags, index, entry, 'error mismatch', stringify(entryerr), errmessage(err))

    raise fail(flags, index, entry, 'unexpected error', None, errmessage(err))


def match(flags: dict, index: int, entry: dict, check: Any, base: Any) -> None:
    """Check that every leaf of `check` is present, and matches, in `base`."""
    # Read the base DIRECTLY. The clone bought nothing - the walk below
    # only reads, via getpath - and it blows the stack on a cyclic base. A
    # port driving entries with live objects rather than pure JSON produces
    # those routinely (voxgig/sdkgen's corpus matches a live client context
    # whose root context reaches the client again).
    cbase = base

    def at(path):
        return '<root>' if len(path) == 0 else pathify(path)

    def apply(_key, val, _parent, path):
        # An empty container in the check is a structural placeholder: walk
        # visits no leaves inside {} or [], so it asserts nothing about the
        # base. (struct's corpus relies on this "map is here, contents
        # unchecked" behaviour, so omni stays a faithful drop-in.)
        if not isnode(val):
            baseval = getpath(cbase, path)

            # The sentinels are tested BEFORE the identity check below.
            # Otherwise a subject returning the literal string "__UNDEF__"
            # satisfies an assertion that the key is absent - two mutually
            # exclusive states passing one check. A sentinel that accepts
            # its own literal is not a sentinel. (NULLMARK still accepts
            # NULLMARK: under the default null flag a real null has already
            # been normalised to it, so the two are genuinely
            # indistinguishable here - that one needs a raw-value escape,
            # not an ordering change.)

            # Explicitly absent: satisfied only by a genuinely missing key,
            # never by a present null (the distinction the sentinels exist
            # to keep).
            if val == UNDEFMARK:
                if baseval is ABSENT:
                    return val
                raise fail(flags, index, entry, 'expected absent at ' + at(path),
                           'absent', stringify(baseval))

            # Explicitly null: satisfied only by a present null.
            if val == NULLMARK:
                if baseval is None or baseval == NULLMARK:
                    return val
                raise fail(flags, index, entry, 'expected null at ' + at(path),
                           'null', stringify(baseval))

            # Explicitly present: any present value, including null.
            if val == EXISTSMARK:
                if baseval is not ABSENT:
                    return val
                raise fail(flags, index, entry, 'expected present at ' + at(path),
                           'present', 'absent')

            # Identical values match. This sits below the sentinel branches
            # on purpose - see the note above.
            if baseval is val:
                return val

            # A concrete expectation never matches a missing key - a match leaf
            # against an absent value must fail, not substring-match "None".
            if baseval is ABSENT:
                raise fail(flags, index, entry, 'match failed at ' + at(path),
                           stringify(val), 'absent')

            if not matchval(val, baseval):
                raise fail(flags, index, entry, 'match failed at ' + at(path),
                           stringify(val), stringify(baseval))

        return val

    walk(clone(check), apply)


def matchval(check: Any, base: Any) -> bool:
    """Match one leaf: /regex/ or case-insensitive substring for strings."""
    if check is base:
        return True

    if deepequal(check, base):
        return True

    want = check
    if want == UNDEFMARK or want == NULLMARK:
        want = None

    if want is None:
        return base is None or base is ABSENT or base == NULLMARK

    if isinstance(want, str):
        # An empty want is not a wildcard: the empty string is a substring of
        # everything, so `match:{out:""}` (or `err:""`) would accept any value.
        if want == '':
            return base == ''

        basestr = stringify(base)

        rem = re.match(r'^/(.+)/$', want, re.DOTALL)
        if rem:
            return re.search(rem.group(1), basestr) is not None

        return want.lower() in basestr.lower()

    if callable(want):
        return True

    return deepequal(want, base)


def nullmodifier(val, key, parent, *_rest) -> None:
    """Convert NULLMARK sentinels back into real nulls."""
    if val == NULLMARK:
        parent[key] = None
    elif isinstance(val, str):
        parent[key] = val.replace(NULLMARK, 'null')


def makeRunner(specref: Any, provider: Any = None) -> Callable:
    """Make a runner for a spec file (or spec object) and a provider."""
    alltests = loadspec(specref)
    specversion = resolveversion(alltests)
    useprovider = provider or {}

    def runner(name: Optional[str] = None, store: Any = None) -> dict:
        spec = resolvespec(name, alltests)
        clients = resolveclients(useprovider, spec, {} if store is None else store)
        defsubject = resolvesubject(name, useprovider)

        def runsetflags(testspec: Any, flags: Optional[dict], testsubject: Callable = None) -> None:
            useflags = resolveflags(flags)
            useflags['name'] = useflags.get('name') or name or 'set'

            subject = testsubject or defsubject
            if subject is None:
                raise OmniError('omni: no test subject for: ' + str(useflags['name']))

            testspecmap = fixjson(testspec, useflags)

            if not ismap(testspecmap) or not islist(testspecmap.get('set')):
                raise OmniError('omni: test spec has no set: ' + str(useflags['name']))

            testset = testspecmap['set']

            if specversion >= 1:
                checkset(useflags, testspec, testset)

            for index, entry in enumerate(testset):
                try:
                    entry = resolveentry(entry, useflags)

                    testpack = resolvetestpack(name, entry, subject, useprovider, clients)
                    args = resolveargs(entry, testpack, useprovider)

                    res = testpack['subject'](*args)
                    res = fixjson(res, useflags)
                    entry['res'] = res

                    checkresult(useflags, index, entry, args, res)

                except OmniError:
                    raise
                except Exception as err:  # noqa: BLE001 - subject errors are data
                    handleerror(useflags, index, entry, err, useprovider)

        def runset(testspec: Any, testsubject: Callable = None) -> None:
            return runsetflags(testspec, {}, testsubject)

        return {
            'spec': spec,
            'runset': runset,
            'runsetflags': runsetflags,
            'subject': defsubject,
            'client': useprovider,
        }

    return runner


__all__ = [
    'CAPABILITIES',
    'EXISTSMARK',
    'NULLMARK',
    'SPECVERSION',
    'UNDEFMARK',
    'OmniError',
    'errify',
    'fixjson',
    'loadspec',
    'makeRunner',
    'match',
    'matchval',
    'nullmodifier',
    'resolvespec',
]
