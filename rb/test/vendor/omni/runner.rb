# VENDORED: @voxgig/omni sdk-20260908-1556-0 (ruby/lib/voxgig_omni/runner.rb)
# Source: https://github.com/voxgig/omni @ 274708cc2d12b21707d975543953f845f8444be0  [tag: sdk-20260911-2013-0]
# License: MIT (c) voxgig - see repository LICENSE. Do not edit: resync from upstream.
# Omni: the shared multi-language test runner.
#
# Port of the canonical TypeScript implementation
# (typescript/src/Runner.ts). Behaviour must match, case for case.

require 'json'

require_relative 'util'

module VoxgigOmni
  # The newest spec format version this runner understands. A spec with no
  # OMNI block is version 0: the original, lenient format, frozen forever.
  # Version 1 turns on strict entry validation (see checkentry).
  SPECVERSION = 1

  # Capability strings this runner supports beyond the version baseline. A
  # spec's OMNI.requires list is checked against this: an unknown capability
  # refuses the spec loudly at load time, instead of a lagging port silently
  # mis-running it. (Empty today; future format features mint a string here.)
  CAPABILITIES = []

  # A test failure (or a malformed spec). Distinct from errors raised by
  # the subject under test, which are candidates for an `err` expectation.
  class OmniError < StandardError
    attr_reader :entry

    def initialize(message, entry = nil)
      super(message)
      @entry = entry
    end
  end

  module Runner
    module_function

    U = VoxgigOmni::Util

    # The complete set of fields an entry may carry. Under version 1
    # anything else is an error: an unrecognised key is almost always a
    # typo'd assertion, and a typo'd assertion is a test that silently
    # stopped testing.
    ENTRYFIELDS = %w[in args ctx out err match client id doc]

    # Load a spec: a path to a JSON file, or an already-parsed object.
    def loadspec(specref)
      return JSON.parse(File.read(specref)) if specref.is_a?(String)

      specref
    end

    # Read the spec's format version from its optional top-level OMNI
    # block, and refuse a spec this runner cannot faithfully run: a version
    # newer than SPECVERSION, or a required capability not in CAPABILITIES.
    def resolveversion(alltests)
      return 0 unless U.ismap(alltests) && alltests.key?('OMNI')

      meta = alltests['OMNI']
      version = U.ismap(meta) ? meta['version'] : nil

      if !U.ismap(meta) || !U.isnum(version) || version % 1 != 0
        raise OmniError, 'omni: malformed OMNI version block'
      end

      if version.negative? || SPECVERSION < version
        raise OmniError, 'omni: unsupported spec version: ' + U.stringify(version)
      end

      if meta.key?('requires')
        requires = meta['requires']
        raise OmniError, 'omni: malformed OMNI requires list' unless U.islist(requires)

        requires.each do |cap|
          unless cap.is_a?(String) && CAPABILITIES.include?(cap)
            raise OmniError, 'omni: spec requires unsupported capability: ' + U.stringify(cap)
          end
        end
      end

      version
    end

    # Strict entry validation, applied when the spec declares version 1 or
    # later. The lenient format converts each of these mistakes into a
    # silent pass or a dead field; here they fail with the entry named.
    def checkentry(flags, index, entry)
      raise fail(flags, index, entry, 'entry is not a map') unless U.ismap(entry)

      entry.each_key do |key|
        raise fail(flags, index, entry, 'unknown entry field: ' + key.to_s) unless ENTRYFIELDS.include?(key)
      end

      argsources = %w[in args ctx].count { |key| entry.key?(key) }
      raise fail(flags, index, entry, 'entry has more than one of in, args, ctx') if argsources > 1

      raise fail(flags, index, entry, 'entry has both err and out') if !entry['err'].nil? && entry.key?('out')

      raise fail(flags, index, entry, 'entry id is not a string') if entry.key?('id') && !entry['id'].is_a?(String)
    end

    # Validate a version-1 group up front, against the AUTHORED entries -
    # null-normalisation would otherwise rewrite an authored null (e.g.
    # id: null) into a sentinel string and hide it from validation. A
    # malformed spec is a spec error, not a test result, so it fails
    # before any subject runs.
    def checkset(flags, testspec, normalset)
      origset = U.ismap(testspec) && U.islist(testspec['set']) ? testspec['set'] : normalset

      if origset.empty? && (U.ismap(testspec) ? testspec['empty'] : nil) != true
        raise OmniError, 'omni: empty test set: ' + flags[:name].to_s
      end

      origset.each_with_index do |entry, index|
        checkentry(flags, index, entry)
      end
    end

    # Find `primary.<name>`, then `<name>`, then the whole spec.
    def resolvespec(name, alltests)
      return alltests if name.nil?

      primary = U.ismap(alltests) ? alltests['primary'] : nil
      return primary[name] if U.ismap(primary) && !primary[name].nil?

      return alltests[name] if U.ismap(alltests) && !alltests[name].nil?

      alltests
    end

    # Build the named clients declared by the spec's DEF.client block.
    def resolveclients(provider, spec, store)
      clients = {}

      defclient = U.ismap(spec) && U.ismap(spec['DEF']) ? spec['DEF']['client'] : nil
      return clients unless U.ismap(defclient)

      # A spec may define clients that a given test run never references.
      clientmaker = provider[:client]
      return clients if clientmaker.nil?

      defclient.each do |clientname, cdef|
        copts = U.clone((U.ismap(cdef) && U.ismap(cdef['test']) ? cdef['test']['options'] : nil) || {})

        injector = provider[:inject]
        injector.call(copts, store) if U.ismap(store) && !injector.nil?

        clients[clientname] = clientmaker.call(copts)
      end

      clients
    end

    def resolvesubject(name, provider)
      return nil if name.nil? || provider[:subject].nil?

      provider[:subject].call(name)
    end

    def resolveflags(flags)
      out = flags.nil? ? {} : flags.dup
      out[:null] = out[:null].nil? ? true : !!out[:null]
      out
    end

    # An entry with no `out` expects a null (or absent) result.
    def resolveentry(entry, flags)
      entry['out'] = NULLMARK if entry['out'].nil? && flags[:null]
      entry
    end

    def resolvetestpack(name, entry, subject, provider, clients)
      testpack = { client: provider, subject: subject }

      unless entry['client'].nil?
        client = clients[entry['client']]
        raise OmniError.new('omni: unknown client: ' + entry['client'].to_s, entry) if client.nil?

        testpack[:client] = client
        testpack[:subject] = resolvesubject(name, client) || subject
      end

      testpack
    end

    # Build the argument list: `ctx`, `args`, or `in`.
    def resolveargs(entry, testpack, provider)
      args = if entry.key?('ctx')
               [entry['ctx']]
             elsif entry.key?('args')
               entry['args']
             else
               [U.clone(entry['in'])]
             end

      if (entry.key?('ctx') || entry.key?('args')) && !args.empty?
        first = args[0]
        if U.ismap(first)
          first = U.clone(first)
          contextify = provider[:contextify]
          first = contextify.call(first) unless contextify.nil?
          args[0] = first
          entry['ctx'] = first
          first['client'] = testpack[:client] if U.ismap(first)
        end
      end

      args
    end

    # Nulls become NULLMARK, errors become {name,message}. Always a copy.
    def fixjson(val, flags = nil)
      donull = flags.nil? || flags[:null].nil? ? true : !!flags[:null]
      fixjsonval(val, donull)
    end

    def fixjsonval(val, donull)
      return donull ? NULLMARK : nil if val.nil? || val.equal?(ABSENT)

      return errify(val) if val.is_a?(Exception)

      return val.map { |entry| fixjsonval(entry, donull) } if U.islist(val)

      if U.ismap(val)
        out = {}
        val.each { |key, subval| out[key] = fixjsonval(subval, donull) }
        return out
      end

      val
    end

    # The JSON form of an error: always at least {name,message}.
    # An exception collapses to {name, message} here. A library whose errors
    # carry a `code` reaches `match: {err: {code}}` through
    # `Provider.errify`, which replaces this entirely.
    def errify(err)
      return { 'name' => 'Error', 'message' => err.to_s } unless err.is_a?(Exception)

      { 'name' => err.class.name, 'message' => err.message }
    end

    # The error base a `match.err` sees: the provider's own, when it has one.
    def errbase(err, provider)
      hook = provider.is_a?(Hash) ? provider[:errify] : nil
      hook.nil? ? errify(err) : hook.call(err)
    end

    def errmessage(err)
      err.is_a?(Exception) ? err.message : err.to_s
    end

    # The label of one entry, for failure messages.
    def entryref(flags, index, entry)
      label = flags[:name] || 'set'
      entryid = U.ismap(entry) && !entry['id'].nil? ? ' (' + entry['id'].to_s + ')' : ''
      "#{label}[#{index}]#{entryid}"
    end

    def fail(flags, index, entry, reason, expected = nil, actual = nil)
      msg = 'omni: ' + entryref(flags, index, entry) + ': ' + reason
      msg += "\n  expected: " + expected unless expected.nil?
      msg += "\n  actual:   " + actual unless actual.nil?
      msg += "\n  entry:    " + U.stringify(entrysummary(entry))
      OmniError.new(msg, entry)
    end

    # The spec-defined part of an entry (drop runner bookkeeping).
    def entrysummary(entry)
      return entry unless U.ismap(entry)

      out = {}
      entry.each { |key, val| out[key] = val unless %w[res thrown ctx].include?(key) }
      out
    end

    def checkresult(flags, index, entry, args, res)
      matched = false

      unless entry['err'].nil?
        raise fail(flags, index, entry, 'expected error did not occur',
                   U.stringify(entry['err']), U.stringify(res))
      end

      unless entry['match'].nil?
        match(flags, index, entry, entry['match'],
              { 'in' => entry['in'], 'args' => args, 'out' => entry['res'], 'ctx' => entry['ctx'] })
        matched = true
      end

      out = entry['out']

      return if U.deepequal(res, out)

      # NOTE: a match with no explicit out is a complete check on its own.
      return if matched && (out == NULLMARK || out.nil?)

      raise fail(flags, index, entry, 'result mismatch', U.stringify(out), U.stringify(res))
    end

    def handleerror(flags, index, entry, err, provider = nil)
      entry['thrown'] = err

      entryerr = entry['err']

      unless entryerr.nil?
        if entryerr == true || matchval(entryerr, errmessage(err))
          unless entry['match'].nil?
            match(flags, index, entry, entry['match'],
                  { 'in' => entry['in'], 'out' => entry['res'], 'ctx' => entry['ctx'],
                    'err' => errbase(err, provider) })
          end
          return
        end

        raise fail(flags, index, entry, 'error mismatch', U.stringify(entryerr), errmessage(err))
      end

      raise fail(flags, index, entry, 'unexpected error', nil, errmessage(err))
    end

    # Check that every leaf of `check` is present, and matches, in `base`.
    def match(flags, index, entry, check, base)
      cbase = U.clone(base)

      at = ->(path) { path.empty? ? '<root>' : U.pathify(path) }

      apply = lambda do |_key, val, _parent, path|
        # An empty container in the check is a structural placeholder: walk
        # visits no leaves inside {} or [], so it asserts nothing about the
        # base. (struct's corpus relies on this "map is here, contents
        # unchecked" behaviour, so omni stays a faithful drop-in.)
        unless U.isnode(val)
          baseval = U.getpath(cbase, path)

          # The sentinels are tested BEFORE the identity check below.
          # Otherwise a subject returning the literal string "__UNDEF__"
          # satisfies an assertion that the key is absent - two mutually
          # exclusive states passing one check. A sentinel that accepts its
          # own literal is not a sentinel. (NULLMARK still accepts NULLMARK:
          # under the default null flag a real null has already been
          # normalised to it, so the two are genuinely indistinguishable
          # here - that one needs a raw-value escape, not an ordering
          # change.)

          # Explicitly absent: satisfied only by a genuinely missing key,
          # never by a present null (the distinction the sentinels exist
          # to keep).
          if val == UNDEFMARK
            next val if baseval.equal?(ABSENT)

            raise fail(flags, index, entry, 'expected absent at ' + at.call(path),
                       'absent', U.stringify(baseval))
          end

          # Explicitly null: satisfied only by a present null.
          if val == NULLMARK
            next val if baseval.nil? || baseval == NULLMARK

            raise fail(flags, index, entry, 'expected null at ' + at.call(path),
                       'null', U.stringify(baseval))
          end

          # Explicitly present: any present value, including null.
          if val == EXISTSMARK
            next val unless baseval.equal?(ABSENT)

            raise fail(flags, index, entry, 'expected present at ' + at.call(path),
                       'present', 'absent')
          end

          # Identical values match. This sits below the sentinel branches on
          # purpose - see the note above.
          next val if U.deepequal(baseval, val)

          # A concrete expectation never matches a missing key - a match leaf
          # against an absent value must fail, not substring-match the
          # stringified absent value.
          if baseval.equal?(ABSENT)
            raise fail(flags, index, entry, 'match failed at ' + at.call(path),
                       U.stringify(val), 'absent')
          end

          unless matchval(val, baseval)
            raise fail(flags, index, entry, 'match failed at ' + at.call(path),
                       U.stringify(val), U.stringify(baseval))
          end
        end

        val
      end

      U.walk(U.clone(check), apply)
    end

    # Match one leaf: /regex/ or case-insensitive substring for strings.
    def matchval(check, base)
      return true if U.deepequal(check, base)

      want = check
      want = nil if want == UNDEFMARK || want == NULLMARK

      return base.nil? || base.equal?(ABSENT) || base == NULLMARK if want.nil?

      if want.is_a?(String)
        # An empty want is not a wildcard: the empty string is a substring of
        # everything, so `match:{out:""}` (or `err:""`) would accept any value.
        return base == '' if want == ''

        basestr = U.stringify(base)

        rem = want.match(%r{^/(.+)/$}m)
        return !Regexp.new(rem[1]).match(basestr).nil? if rem

        return basestr.downcase.include?(want.downcase)
      end

      return true if want.is_a?(Proc) || want.is_a?(Method)

      U.deepequal(want, base)
    end

    # Convert NULLMARK sentinels back into real nulls.
    def nullmodifier(val, key, parent, *_rest)
      if val == NULLMARK
        parent[key] = nil
      elsif val.is_a?(String)
        parent[key] = val.gsub(NULLMARK, 'null')
      end
    end

    # Make a runner for a spec file (or spec object) and a provider.
    def make_runner(specref, provider = nil)
      alltests = loadspec(specref)
      specversion = resolveversion(alltests)
      useprovider = provider || {}

      lambda do |name = nil, store = nil|
        spec = resolvespec(name, alltests)
        clients = resolveclients(useprovider, spec, store.nil? ? {} : store)
        defsubject = resolvesubject(name, useprovider)

        runsetflags = lambda do |testspec, flags, testsubject = nil|
          useflags = resolveflags(flags)
          useflags[:name] = useflags[:name] || name || 'set'

          subject = testsubject || defsubject
          raise OmniError, 'omni: no test subject for: ' + useflags[:name].to_s if subject.nil?

          testspecmap = fixjson(testspec, useflags)

          unless U.ismap(testspecmap) && U.islist(testspecmap['set'])
            raise OmniError, 'omni: test spec has no set: ' + useflags[:name].to_s
          end

          testset = testspecmap['set']

          checkset(useflags, testspec, testset) if 1 <= specversion

          testset.each_with_index do |entry, index|
            begin
              entry = resolveentry(entry, useflags)

              testpack = resolvetestpack(name, entry, subject, useprovider, clients)
              args = resolveargs(entry, testpack, useprovider)

              res = testpack[:subject].call(*args)
              res = fixjson(res, useflags)
              entry['res'] = res

              checkresult(useflags, index, entry, args, res)
            rescue OmniError
              raise
            rescue StandardError => e
              handleerror(useflags, index, entry, e, useprovider)
            end
          end
        end

        runset = ->(testspec, testsubject = nil) { runsetflags.call(testspec, {}, testsubject) }

        {
          spec: spec,
          runset: runset,
          runsetflags: runsetflags,
          subject: defsubject,
          client: useprovider
        }
      end
    end
  end
end
