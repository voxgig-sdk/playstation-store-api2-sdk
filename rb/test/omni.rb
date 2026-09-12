# The corpus test runner: vendored voxgig_omni driven through its NATIVE
# API (`make_runner(specref, provider)`), presented to the corpus tests in
# the struct-runner shape they already use (`R[:spec]`, `R[:runset]`,
# `R[:runsetflags]`, `R[:client]`). No compat shim is vendored: the
# adapter below IS the whole bridge, per language, per the vendor-tag
# rollout (docs/design/vendor-tag-rollout.md, Decision 4). It is the
# ruby peer of tm/ts/test/omni.ts and tm/py/test/omni.py.
#
# Four local decisions, all required:
#
# 1. SPEC PATH. omni's own spec resolution expects the caller to hand it
#    a usable path. A relative path is absolutized against THIS file's
#    directory (test/), so the existing '../../.sdk/test/test.json'
#    constant keeps working verbatim wherever the suite is run from.
#
# 2. PROVIDER DELEGATION. Corpus-driven contexts get `ctx.client` set to
#    the runner's provider (omni overwrites it on any ctx/args entry). A
#    five-hook provider object HIDES the live SDK from the generated
#    utilities that reach through it - prepare_auth via
#    client.options_map, fetcher via client.mode, feature_add via
#    client.features. So the provider here is a READ-THROUGH view of the
#    live SDK instance: a Hash subclass holding the omni hooks whose
#    method calls fall through to the SDK - the ruby spelling of ts's
#    prototype delegation. (Upstream omni#56 tracks giving the stock
#    provider the same shape.)
#
# 3. UNDEF-ARGUMENT ENTRIES. Entries with no `in`, `args` or `ctx` mean
#    "call the subject the way this port always has". omni's generic rule
#    is `args = [clone(entry.in)]`, one nil - but ruby's retired struct
#    runner passed `[VoxgigStruct::UNDEF]`, the port's own absence
#    sentinel, and subjects like pathify branch on it. `undefargs` below
#    ports the correction from upstream omni's ruby compat shim
#    (voxgig/omni ruby compat/struct.rb), rewriting those entries to an
#    explicit `args` of one sentinel - in memory, for this port only.
#    `wrapsubject` is the same shim's other half: a subject RESULT of
#    UNDEF (getelem's default alt) is translated to omni's ABSENT so the
#    two absence models never meet.
#
# 4. MATCH-VISIBLE CONTEXTS. The SDK's context is a CLASS INSTANCE, not
#    the plain map ts contexts are, and omni's `match` walks the entry's
#    ctx with map access - against a bare instance every `match: {ctx:
#    ...}` assertion would read ABSENT. `ObjView` wraps the live context
#    as a Hash subclass whose map face mirrors the instance's attributes
#    (snake_case attributes answering to the corpus's camelCase keys), so
#    omni's clone-at-match-time takes a faithful snapshot of the
#    POST-EXECUTION context while subjects keep ordinary method access to
#    the live object.
#
# THE VENDORED RUBY PORT LACKS THE omni#54 RUNNER FIXES the TypeScript
# port has at this tag (upstream voxgig/omni#64 landed them for js/go/py
# only). Vendored files are resynced, never edited, so each gap is
# covered HERE instead:
#
# a. `match()` clones its base and the vendored clone()/jsonstr() have no
#    cycle guard. Ruby's live cycles all pass through objects, not plain
#    Hashes, so the raw objects are inert to both walks - the exposure is
#    the map-face views this resolver introduces. ObjView therefore
#    HIDES the cycle edges (`client`/`utility` on every view, `ctx` on
#    error views - runner/SDK bookkeeping the corpus never asserts on)
#    and carries its wrapping ancestry, so a repeated object stays
#    unwrapped and every clone/jsonstr walk terminates.
#
# b. `errify`/`errmessage` collapse non-Exception throwables. Ruby can
#    only raise Exceptions, so that gap cannot fire here; the provider
#    still declares its own `errify` so `match: {err: {code: ...}}` can
#    see an SDK error's code, which the stock {name,message} shape drops.

require 'json'

require_relative 'vendor/omni/voxgig_omni'

module PlaystationStoreApi2Omni
  TEST_DIR = File.expand_path(__dir__)

  NULLMARK = VoxgigOmni::NULLMARK
  UNDEFMARK = VoxgigOmni::UNDEFMARK
  EXISTSMARK = VoxgigOmni::EXISTSMARK
  ABSENT = VoxgigOmni::ABSENT
  OmniError = VoxgigOmni::OmniError

  # Attribute names the map face of a view does not mirror. client and
  # utility both reach the SDK, whose root context reaches the client
  # again - the cycle omni's guardless clone would follow forever; an
  # error's ctx is the same cycle one hop in (generated make_error
  # attaches the live context to every error it raises). Subjects still
  # reach all three through the method face; the corpus never asserts on
  # any of them.
  VIEW_HIDE = %w[client utility].freeze
  VIEW_HIDE_ERR = %w[client utility ctx].freeze

  # Ruby cannot name an attribute `alias`, so the Spec object spells it
  # `alias_map` - but the corpus speaks the wire name.
  VIEW_ALIAS = { 'alias' => 'alias_map' }.freeze
  VIEW_ALIAS_BACK = { 'alias_map' => 'alias' }.freeze

  module_function

  def camelize(name)
    return VIEW_ALIAS_BACK[name] if VIEW_ALIAS_BACK.key?(name)

    parts = name.split('_')
    parts[0] + parts[1..].map { |p| p.empty? ? p : p[0].upcase + p[1..] }.join
  end

  def underscore(name)
    name.gsub(/([A-Z])/) { '_' + Regexp.last_match(1).downcase }
  end

  def plainval?(val)
    val.nil? || val.is_a?(::String) || val.is_a?(::Numeric) ||
      val.is_a?(::TrueClass) || val.is_a?(::FalseClass) ||
      val.is_a?(::Symbol) || val.is_a?(::Hash) || val.is_a?(::Array) ||
      val.is_a?(::Proc) || val.is_a?(::Method) || val.equal?(ABSENT)
  end

  # A live map view of one object, for omni's match phase.
  #
  # Hash SUBCLASS, because omni's ismap() is an is_a?(Hash) check and its
  # clone() materialises maps via each: cloning a view yields a plain
  # deep snapshot of the object's attributes at that moment - match runs
  # after the subject, so the snapshot carries the mutations the corpus
  # asserts on. Method calls (and assignment) fall through to the live
  # object, so test subjects use the view exactly as they would the
  # object itself.
  #
  # nil-valued attributes are OMITTED from the map face: ruby's "not set"
  # is nil where ts's is undefined, and mirroring nil as a present key
  # would let `__EXISTS__` accept an unset field.
  #
  # `seen` carries the wrapping ancestry so a cyclic reach terminates: a
  # repeated object stays unwrapped, which match reads as ABSENT - no
  # corpus case matches into a cycle.
  class ObjView < ::Hash
    def initialize(target, seen = nil)
      super()
      @view_target = target
      @view_seen = seen || {}.freeze
    end

    def view_target
      @view_target
    end

    # --- method face: the live object ---

    def method_missing(name, *args, &blk)
      t = @view_target
      return t.send(name, *args, &blk) if t.respond_to?(name)

      super
    end

    def respond_to_missing?(name, include_private = false)
      @view_target.respond_to?(name, include_private) || super
    end

    # --- map face: what omni walks ---

    def view_names
      t = @view_target
      hide = t.is_a?(::Exception) ? VIEW_HIDE_ERR : VIEW_HIDE
      t.instance_variables.map { |iv| iv.to_s[1..] }
        .reject { |n| n.start_with?('_') || hide.include?(n) }
        .reject { |n| t.instance_variable_get("@#{n}").nil? }
    end

    def view_wrap(name)
      t = @view_target
      seen = @view_seen
      val = t.instance_variable_get("@#{name}")

      # A view held INSIDE the object graph must continue THIS
      # traversal's ancestry, not restart its own - a restarted chain
      # never terminates on the cycle it re-enters.
      if val.is_a?(ObjView)
        tgt = val.view_target
        return tgt if seen.key?(tgt.object_id)

        return ObjView.new(tgt, seen.merge(t.object_id => true).freeze)
      end
      return val if PlaystationStoreApi2Omni.plainval?(val) || seen.key?(val.object_id)

      ObjView.new(val, seen.merge(t.object_id => true).freeze)
    end

    def view_attrname(key)
      t = @view_target
      key = key.to_s
      name = VIEW_ALIAS[key] || key
      return name if t.instance_variable_defined?("@#{name}")

      snake = PlaystationStoreApi2Omni.underscore(name)
      return snake if t.instance_variable_defined?("@#{snake}")

      nil
    end

    def keys
      out = view_names.map { |n| PlaystationStoreApi2Omni.camelize(n) }
      out << 'message' if @view_target.is_a?(::Exception) && !out.include?('message')
      out
    end

    def each
      keys.each { |k| yield [k, self[k]] }
      self
    end

    def length
      keys.length
    end
    alias size length

    def empty?
      keys.empty?
    end

    def key?(key)
      return true if 'message' == key.to_s && @view_target.is_a?(::Exception)

      !view_attrname(key).nil?
    end
    alias has_key? key?
    alias include? key?
    alias member? key?

    def [](key)
      t = @view_target
      return t.message if 'message' == key.to_s && t.is_a?(::Exception) &&
                          !t.instance_variable_defined?('@message')

      name = view_attrname(key)
      name.nil? ? nil : view_wrap(name)
    end

    def []=(key, val)
      # omni's runner writes `first['client'] = testpack[:client]` into a
      # ctx entry's first argument - route it to the live object, which
      # is where prepare_auth and friends will read it back.
      t = @view_target
      name = view_attrname(key) || PlaystationStoreApi2Omni.underscore(key.to_s)
      setter = "#{name}="
      if t.respond_to?(setter)
        t.send(setter, val)
      else
        t.instance_variable_set("@#{name}", val)
      end
      val
    end

    def to_s
      "#<ObjView #{@view_target.class}>"
    end
    alias inspect to_s
  end

  # An omni provider that is also the live SDK.
  #
  # omni reads a provider as a mapping (`provider[:subject]`), while
  # corpus code reaches through the runpack's client as an SDK
  # (`client.options_map`, `client.features`). The Hash half holds the
  # hooks; every other method resolves against the live SDK instance,
  # and attribute assignment lands on it too.
  class SdkProvider < ::Hash
    def method_missing(name, *args, &blk)
      sdk = self[:sdk]
      return sdk.send(name, *args, &blk) if !sdk.nil? && sdk.respond_to?(name)

      super
    end

    def respond_to_missing?(name, include_private = false)
      sdk = self[:sdk]
      (!sdk.nil? && sdk.respond_to?(name, include_private)) || super
    end
  end

  # The corpus spells an entity as `{"name" => ...}`; resolve_op wants an
  # object with get_name. Nothing else is read from it.
  class EntityRef
    def initialize(name)
      @name = name
    end

    def get_name
      @name
    end
  end

  # The sdkgen corpus writes contexts as pure JSON, and the ruby context
  # constructor only adopts spec/result/response given as INSTANCES - so
  # the JSON forms are materialised here, exactly as the retired inline
  # runner's make_ctx_from_map did.
  def enrich(ctxmap, ctx)
    spec_map = ctxmap['spec']
    ctx.spec = PlaystationStoreApi2Spec.new(spec_map) if spec_map.is_a?(::Hash)

    res_map = ctxmap['result']
    if res_map.is_a?(::Hash)
      ctx.result = PlaystationStoreApi2Result.new(res_map)
      err_map = res_map['err']
      if err_map.is_a?(::Hash) && err_map['message'].is_a?(::String) &&
         !err_map['message'].empty?
        ctx.result.err = PlaystationStoreApi2Error.new('', err_map['message'])
      end
    end

    resp_map = ctxmap['response']
    if resp_map.is_a?(::Hash)
      ctx.response = PlaystationStoreApi2Response.new(resp_map)
      unless resp_map['body'].nil?
        body_copy = resp_map['body']
        ctx.response.json_func = -> { body_copy }
      end
      headers = resp_map['headers']
      if headers.is_a?(::Hash)
        lower = {}
        headers.each { |k, v| lower[k.downcase] = v }
        ctx.response.headers = lower
      end
    end

    ctx
  end

  # The omni hooks for an SDK subject - what upstream's compat shim
  # called structprovider, inlined here because this resolver is the one
  # consumer.
  def sdkhooks(sdk)
    utility = sdk.get_utility

    subject = lambda do |name|
      # A subject resolves from the utility (the corpus's camelCase name
      # in ruby's snake_case spelling), or from the struct utilities.
      snake = underscore(name.to_s)
      found = utility.respond_to?(snake) ? utility.send(snake) : nil
      if found.nil? && VoxgigStruct.respond_to?(name)
        found = VoxgigStruct.method(name)
      end
      wrapsubject(found)
    end

    client = lambda do |options|
      # A DEF.client entry becomes another SDK instance - rewrapped with
      # the same delegating shape, not a plain hook object.
      sdkprovider(sdk.class.test(nil, options))
    end

    contextify = lambda do |val|
      ctxmap = val.is_a?(::Hash) ? val.dup : {}
      ent = ctxmap['entity']
      if ent.is_a?(::Hash) && ent['name'].is_a?(::String)
        ctxmap['entity'] = EntityRef.new(ent['name'])
      end
      ctx = utility.make_context.call(ctxmap, nil)
      enrich(ctxmap, ctx)
      ctx.utility = utility
      ctx.options = sdk.options_map if ctx.options.nil?
      ObjView.new(ctx)
    end

    inject = lambda do |options, store|
      VoxgigStruct.respond_to?(:inject) ?
        VoxgigStruct.inject(options, store) : options
    end

    errify = ->(err) { PlaystationStoreApi2Omni.errify(err) }

    {
      subject: subject,
      client: client,
      contextify: contextify,
      inject: inject,
      errify: errify,
      sdk: sdk,
    }
  end

  # The JSON form of an error, with the error's own attributes carried
  # along - the ruby peer of the vendored python port's errify, which the
  # vendored ruby runner lacks (it keeps only {name,message}, dropping
  # the `code` the corpus asserts refusals by). Used as the provider's
  # errify hook (match.err), and by subjects that answer WITH an error
  # value (makePoint).
  def errify(err)
    return { 'name' => 'Error', 'message' => err.to_s } unless err.is_a?(::Exception)

    out = {}
    err.instance_variables.each do |iv|
      name = iv.to_s[1..]
      next if name.start_with?('_') || VIEW_HIDE_ERR.include?(name)

      val = err.instance_variable_get(iv)
      out[name] = val unless val.nil?
    end
    out['name'] = err.class.name
    out['message'] = err.message
    out
  end

  def sdkprovider(sdk)
    provider = SdkProvider.new
    sdkhooks(sdk).each { |k, v| provider[k] = v }
    provider
  end

  # Replace struct's absence sentinel with omni's, at any depth (from
  # upstream omni's ruby compat shim).
  def absentify(val)
    return ABSENT if val.equal?(VoxgigStruct::UNDEF)
    return val.map { |entry| absentify(entry) } if val.is_a?(::Array)

    if val.instance_of?(::Hash)
      out = {}
      val.each { |key, subval| out[key] = absentify(subval) }
      return out
    end

    val
  end

  # A subject whose result speaks omni's absence model.
  def wrapsubject(subject)
    return subject if subject.nil? || !subject.respond_to?(:call)

    ->(*args) { absentify(subject.call(*args)) }
  end

  # Restore ruby's UNDEF-argument reading for entries carrying none of
  # `in`, `args`, `ctx` (see decision 3 above). Rewritten in memory, for
  # this port only - the corpus on disk is untouched.
  ARGKEYS = %w[in args ctx].freeze

  def noargs?(entry)
    entry.is_a?(::Hash) && (entry.keys & ARGKEYS).empty?
  end

  def undefargs(testspec)
    return testspec unless testspec.is_a?(::Hash) && testspec['set'].is_a?(::Array)
    return testspec unless testspec['set'].any? { |entry| noargs?(entry) }

    patched = testspec['set'].map do |entry|
      if noargs?(entry)
        entry = entry.dup
        entry['args'] = [VoxgigStruct::UNDEF]
      end
      entry
    end

    out = testspec.dup
    out['set'] = patched
    out
  end

  # The suites write flags with string keys (`{ 'null' => false }`); the
  # vendored runner reads them as symbols. Translate (from the upstream
  # compat shim).
  def normflags(flags)
    return {} if flags.nil?
    return flags unless flags.is_a?(::Hash)

    out = {}
    flags.each { |key, val| out[key.is_a?(::String) ? key.to_sym : key] = val }
    out
  end

  # struct's make_runner(testfile, client) signature, backed by vendored
  # omni. Also accepts an already-parsed spec object (omni's own
  # capability), which keeps smoke tests free of fixture files.
  def make_runner(testfile, client)
    specref =
      if testfile.is_a?(::String) && !File.absolute_path?(testfile)
        File.join(TEST_DIR, testfile)
      else
        testfile
      end

    provider = sdkprovider(client)
    runner = VoxgigOmni.make_runner(specref, provider)

    lambda do |name = nil, store = nil|
      runpack = runner.call(name, store.nil? ? {} : store)

      omniflags = runpack[:runsetflags]
      runsetflags = lambda do |testspec, flags = nil, testsubject = nil|
        omniflags.call(undefargs(testspec), normflags(flags),
                       wrapsubject(testsubject))
      end
      runset = ->(testspec, testsubject = nil) { runsetflags.call(testspec, {}, testsubject) }

      {
        spec: runpack[:spec],
        runset: runset,
        runsetflags: runsetflags,
        subject: runpack[:subject],
        client: provider,
      }
    end
  end

  # Convert NULLMARK sentinels back into real nulls.
  def null_modifier(val, key, parent, *rest)
    VoxgigOmni::Runner.nullmodifier(val, key, parent, *rest)
  end
end
