# The corpus test runner: vendored voxgig_omni driven through its NATIVE
# API (`makeRunner(specref, provider)`), presented to the corpus tests in
# the struct-runner shape they already use (`R["spec"]`, `R["runset"]`,
# `R["runsetflags"]`, `R["client"]`). No compat shim is vendored: the
# adapter below IS the whole bridge, per language, per the vendor-tag
# rollout (docs/design/vendor-tag-rollout.md, Decision 4). It is the
# python peer of tm/ts/test/omni.ts.
#
# Four local decisions, all required:
#
# 1. SPEC PATH. omni's own spec resolution expects the caller to hand it a
#    usable path. A relative path is absolutized against THIS module's
#    directory (test/), so the existing '../../.sdk/test/test.json'
#    constant keeps working verbatim wherever the suite is run from.
#
# 2. PROVIDER DELEGATION. Corpus-driven contexts get `ctx.client` set to
#    the runner's provider (omni overwrites it on any ctx/args map entry).
#    A five-hook provider object HIDES the live SDK from the generated
#    utilities that reach through it - prepare_auth via
#    client.options_map(), fetcher via client.mode, feature_add appending
#    to client.features. So the provider here is a READ-THROUGH view of
#    the live SDK instance: a dict subclass holding the omni hooks whose
#    attribute access falls through to the SDK, the python spelling of
#    ts's prototype delegation. (Upstream omni#56 tracks giving the stock
#    provider the same shape.)
#
# 3. ZERO-ARGUMENT ENTRIES. Entries with no `in`, `args` or `ctx` mean
#    "call the subject with NO argument". omni's generic rule is
#    `args = [clone(entry.in)]`, which passes one None where python must
#    pass nothing - typify() is 1073741824 where typify(None) is 4194432.
#    `zeroargs` below ports the correction from upstream omni's python
#    compat shim (voxgig/omni python compat/struct.py), rewriting those
#    entries to an explicit empty `args` in memory, for this port only.
#
# 4. MATCH-VISIBLE CONTEXTS. The SDK's context is a CLASS INSTANCE, not
#    the plain map ts contexts are, and omni's `match` walks the entry's
#    ctx with map access - against a bare instance every `match: {ctx:
#    ...}` assertion would read ABSENT. `CtxView` wraps the live context
#    as a dict subclass whose map face mirrors the instance's attributes
#    (snake_case attributes answering to the corpus's camelCase keys), so
#    omni's clone-at-match-time takes a faithful snapshot of the
#    POST-EXECUTION context while subjects keep ordinary attribute access
#    to the live object.

import os

from projectname_sdk.core.spec import PlaystationStoreApi2Spec
from projectname_sdk.core.result import PlaystationStoreApi2Result
from projectname_sdk.core.response import PlaystationStoreApi2Response
from projectname_sdk.core.error import PlaystationStoreApi2Error
from projectname_sdk.utility.voxgig_struct import voxgig_struct as vs

from test.voxgig_omni import (
    EXISTSMARK,
    NULLMARK,
    UNDEFMARK,
    OmniError,
    islist,
    ismap,
    nullmodifier,
)
from test.voxgig_omni import makeRunner as omni_make_runner


_TEST_DIR = os.path.dirname(os.path.abspath(__file__))


# Attribute names the map face of a context view does not mirror. Both
# reach the client, and the client's root context reaches the client
# again - a cycle omni's guardless clone would follow forever. Subjects
# still reach both through the attribute face; the corpus never matches
# on either.
_CTX_HIDE = ('client', 'utility')


def _camel(name):
    """`status_text` -> `statusText`: the corpus speaks camelCase, the SDK
    is snake_case, and the map face is the corpus-facing side."""
    parts = name.split('_')
    return parts[0] + ''.join(p[:1].upper() + p[1:] for p in parts[1:])


def _is_plain(val):
    return val is None or isinstance(
        val, (str, int, float, bool, dict, list, tuple))


class ObjView(dict):
    """A live map view of one python object, for omni's match phase.

    dict-SUBCLASS, because omni's ismap() is an isinstance check and its
    clone() materialises maps via items(): cloning a view yields a plain
    deep snapshot of the object's public attributes at that moment -
    match runs after the subject, so the snapshot carries the mutations
    the corpus asserts on. Attribute access (and assignment) falls
    through to the live object, so test subjects use the view exactly as
    they would the object itself.

    None-valued attributes are OMITTED from the map face: python's "not
    set" is None where ts's is undefined, and mirroring None as a present
    key would let `__EXISTS__` accept an unset field.

    `seen` carries the wrapping ancestry so a cyclic reach (result.err
    holding the ctx that holds the result) terminates: a repeated object
    stays unwrapped, which match reads as ABSENT - no corpus case
    matches into a cycle.
    """

    def __init__(self, target, seen=None):
        super().__init__()
        object.__setattr__(self, '_target', target)
        object.__setattr__(self, '_seen', seen or frozenset())

    # --- attribute face: the live object ---

    def __getattr__(self, name):
        return getattr(object.__getattribute__(self, '_target'), name)

    def __setattr__(self, name, val):
        setattr(object.__getattribute__(self, '_target'), name, val)

    # --- map face: what omni walks ---

    def _names(self):
        target = object.__getattribute__(self, '_target')
        return [n for n in vars(target)
                if not n.startswith('_') and n not in _CTX_HIDE
                and getattr(target, n, None) is not None]

    def _wrapped(self, name):
        target = object.__getattribute__(self, '_target')
        seen = object.__getattribute__(self, '_seen')
        val = getattr(target, name)
        # A view held INSIDE the object graph (an error that captured the
        # ctx it was raised with holds the view the subject received) must
        # continue THIS traversal's ancestry, not restart its own - a
        # restarted chain never terminates on the cycle it re-enters.
        if isinstance(val, ObjView):
            tgt = object.__getattribute__(val, '_target')
            if id(tgt) in seen:
                return tgt
            return ObjView(tgt, seen | {id(target)})
        if _is_plain(val) or callable(val) or id(val) in seen:
            return val
        return ObjView(val, seen | {id(target)})

    def _attrname(self, key):
        target = object.__getattribute__(self, '_target')
        key = str(key)
        if hasattr(target, key):
            return key
        snake = ''.join(
            '_' + c.lower() if c.isupper() else c for c in key)
        return snake if hasattr(target, snake) else None

    def keys(self):
        return [_camel(n) for n in self._names()]

    def items(self):
        return [(_camel(n), self._wrapped(n)) for n in self._names()]

    def values(self):
        return [self._wrapped(n) for n in self._names()]

    def __iter__(self):
        return iter(self.keys())

    def __len__(self):
        return len(self._names())

    def __contains__(self, key):
        return self._attrname(key) is not None

    def __getitem__(self, key):
        name = self._attrname(key)
        if name is None:
            raise KeyError(key)
        return self._wrapped(name)

    def __setitem__(self, key, val):
        # omni's runner writes `first['client'] = testpack['client']` into
        # a ctx/args entry's first argument - route it to the live object,
        # which is where prepare_auth and friends will read it back.
        setattr(object.__getattribute__(self, '_target'), str(key), val)

    def get(self, key, default=None):
        name = self._attrname(key)
        return default if name is None else self._wrapped(name)


class SdkProvider(dict):
    """An omni provider that is also the live SDK.

    omni reads a provider as a mapping (`provider.get('subject')`), while
    corpus code reaches through the runpack's client as an SDK
    (`client._utility`, `client.options_map()`). The dict half holds the
    hooks; everything else resolves against the live SDK instance, and
    attribute assignment lands on it too.
    """

    def __getattr__(self, name):
        try:
            return self[name]
        except KeyError:
            pass
        try:
            return getattr(self['sdk'], name)
        except KeyError:
            raise AttributeError(name) from None

    def __setattr__(self, name, val):
        setattr(self['sdk'], name, val)


def _snake(name):
    """`makeContext` -> `make_context`: corpus subject names are
    camelCase, the SDK utility is snake_case."""
    return ''.join('_' + c.lower() if c.isupper() else c for c in name)


def _enrich(ctxmap, ctx):
    """The sdkgen corpus writes contexts as pure JSON, and the python
    context constructor only adopts spec/result/response given as
    INSTANCES - so the JSON forms are materialised here, exactly as the
    retired inline runner's _make_ctx_from_map did."""

    spec_map = ctxmap.get('spec')
    if isinstance(spec_map, dict):
        ctx.spec = PlaystationStoreApi2Spec(spec_map)

    res_map = ctxmap.get('result')
    if isinstance(res_map, dict):
        ctx.result = PlaystationStoreApi2Result(res_map)
        err_map = res_map.get('err')
        if isinstance(err_map, dict):
            msg = err_map.get('message', '')
            if msg != '':
                ctx.result.err = PlaystationStoreApi2Error('', msg)

    resp_map = ctxmap.get('response')
    if isinstance(resp_map, dict):
        ctx.response = PlaystationStoreApi2Response(resp_map)
        body = resp_map.get('body')
        if body is not None:
            body_copy = body
            ctx.response.json_func = lambda: body_copy
        headers = resp_map.get('headers')
        if isinstance(headers, dict):
            ctx.response.headers = {
                k.lower(): v for k, v in headers.items()}

    return ctx


class _EntityRef:
    """The corpus spells an entity as `{"name": ...}`; resolve_op wants
    an object with get_name(). Nothing else is read from it."""

    def __init__(self, name):
        self._name = name

    def get_name(self):
        return self._name


def _sdkhooks(sdk):
    """The omni hooks for an SDK subject - what upstream's compat shim
    called structprovider, inlined here because this resolver is the one
    consumer."""

    utility = sdk._utility
    struct_utils = vs.StructUtility()

    # `client.utility().struct` is how the struct corpus suite reaches the
    # struct utilities (mirrors ts). The python utility object does not
    # carry them natively, so the resolver attaches a StructUtility once.
    if getattr(utility, 'struct', None) is None:
        utility.struct = struct_utils

    def subject(name):
        # A subject resolves from the utility (camelCase or the python
        # spelling), or from the struct utilities.
        found = getattr(utility, name, None)
        if found is None:
            found = getattr(utility, _snake(name), None)
        if found is None:
            found = getattr(struct_utils, name, None)
        return found

    def client(options):
        # A DEF.client entry becomes another SDK instance - rewrapped
        # with the same delegating shape, not a plain hook object.
        return _sdkprovider(type(sdk).test(None, options))

    def contextify(val):
        # The SDK supplies its own context wrapper; the corpus JSON is
        # materialised into it, and the result is served through the
        # match-visible view (decision 4 above).
        ctxmap = dict(val) if isinstance(val, dict) else {}
        ent = ctxmap.get('entity')
        if isinstance(ent, dict) and isinstance(ent.get('name'), str):
            ctxmap['entity'] = _EntityRef(ent['name'])
        ctx = utility.make_context(ctxmap, None)
        _enrich(ctxmap, ctx)
        ctx.utility = utility
        if ctx.options is None:
            ctx.options = sdk.options_map()
        return CtxView(ctx)

    def inject(options, store):
        injector = getattr(struct_utils, 'inject', None)
        if callable(injector):
            return injector(options, store)
        return options

    return {
        'subject': subject,
        'client': client,
        'contextify': contextify,
        'inject': inject,
        'utility': lambda: sdk._utility,
        'tester': lambda options=None: type(sdk).test(None, options),
        'sdk': sdk,
    }


# The context view is just an ObjView rooted at a context; named so call
# sites read as what they hold.
CtxView = ObjView


def _sdkprovider(sdk):
    return SdkProvider(_sdkhooks(sdk))


def zeroargs(testspec):
    """Restore python's zero-argument reading for entries carrying none of
    `in`, `args`, `ctx` (see decision 3 above; ported from upstream omni's
    python compat shim). Rewritten in memory, for this port only - an
    authored `args: []` on disk would break the fixed-arity ports."""
    if not isinstance(testspec, dict) or not islist(testspec.get('set')):
        return testspec

    entries = testspec['set']
    if not any(
        isinstance(e, dict) and not ({'in', 'args', 'ctx'} & set(e.keys()))
        for e in entries
    ):
        return testspec

    patched = []
    for entry in entries:
        if isinstance(entry, dict) and not (
                {'in', 'args', 'ctx'} & set(entry.keys())):
            entry = dict(entry)
            entry['args'] = []
        patched.append(entry)

    testspec = dict(testspec)
    testspec['set'] = patched
    return testspec


def makeRunner(testfile, client):
    """struct's makeRunner(testfile, client) signature, backed by vendored
    omni. Also accepts an already-parsed spec object (omni's own
    capability), which keeps smoke tests free of fixture files."""
    if not isinstance(testfile, str):
        specref = testfile
    elif os.path.isabs(testfile):
        specref = testfile
    else:
        specref = os.path.join(_TEST_DIR, testfile)

    provider = _sdkprovider(client)
    runner = omni_make_runner(specref, provider)

    def structrunner(name=None, store=None):
        runpack = runner(name, store)

        omni_runset = runpack['runset']
        omni_runsetflags = runpack['runsetflags']

        def runset(testspec, testsubject=None):
            return omni_runset(zeroargs(testspec), testsubject)

        def runsetflags(testspec, flags=None, testsubject=None):
            return omni_runsetflags(zeroargs(testspec), flags, testsubject)

        return {
            'spec': runpack['spec'],
            'runset': runset,
            'runsetflags': runsetflags,
            'subject': runpack['subject'],
            'client': provider,
        }

    return structrunner


# struct's flag-modifier name, served from native omni.
nullModifier = nullmodifier


__all__ = [
    'EXISTSMARK',
    'NULLMARK',
    'UNDEFMARK',
    'OmniError',
    'CtxView',
    'SdkProvider',
    'makeRunner',
    'nullModifier',
    'zeroargs',
]
