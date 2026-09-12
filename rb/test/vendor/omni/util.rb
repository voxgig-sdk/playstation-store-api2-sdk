# VENDORED: @voxgig/omni sdk-20260908-1556-0 (ruby/lib/voxgig_omni/util.rb)
# Source: https://github.com/voxgig/omni @ 274708cc2d12b21707d975543953f845f8444be0  [tag: sdk-20260911-2013-0]
# License: MIT (c) voxgig - see repository LICENSE. Do not edit: resync from upstream.
# Omni internal JSON utilities.
#
# This module is deliberately self-contained: the omni runner must be able
# to test *any* library, including libraries that provide these same
# operations, so it can never borrow them from the system under test.
# Zero third-party dependencies, by design.

module VoxgigOmni
  NULLMARK = '__NULL__'     # Value is JSON null.
  UNDEFMARK = '__UNDEF__'   # Value is not present (thus, undefined).
  EXISTSMARK = '__EXISTS__' # Value exists (not undefined).

  # Ruby has no `undefined`, so absence needs its own marker.
  class AbsentClass
    def to_s
      'ABSENT'
    end

    def inspect
      'ABSENT'
    end
  end

  ABSENT = AbsentClass.new

  module Util
    module_function

    # A map (JSON object)?
    def ismap(val)
      val.is_a?(Hash)
    end

    # A list (JSON array)?
    def islist(val)
      val.is_a?(Array)
    end

    # A container (map or list)?
    def isnode(val)
      ismap(val) || islist(val)
    end

    # A JSON number? Booleans are not numbers.
    def isnum(val)
      val.is_a?(Numeric) && !val.is_a?(TrueClass) && !val.is_a?(FalseClass)
    end

    # Deep copy a JSON value. Other values pass through by reference.
    def clone(val)
      return val.map { |entry| clone(entry) } if islist(val)

      if ismap(val)
        out = {}
        val.each { |key, subval| out[key] = clone(subval) }
        return out
      end

      val
    end

    # Read a value by path. Returns ABSENT when any step is missing.
    def getpath(val, path)
      current = val

      path.each do |part|
        if islist(current)
          index = part.is_a?(Integer) ? part : Integer(part.to_s, exception: false)
          return ABSENT if index.nil? || index.negative? || index >= current.length

          current = current[index]
        elsif ismap(current)
          key = part.to_s
          return ABSENT unless current.key?(key)

          current = current[key]
        else
          return ABSENT
        end
      end

      current
    end

    # Depth-first walk: children first, then the containing node.
    def walk(val, apply, key = nil, parent = nil, path = nil)
      curpath = path || []

      if isnode(val)
        if islist(val)
          val.each_index do |index|
            val[index] = walk(val[index], apply, index, val, curpath + [index])
          end
        else
          val.keys.each do |childkey|
            val[childkey] = walk(val[childkey], apply, childkey, val, curpath + [childkey])
          end
        end
      end

      apply.call(key, val, parent, curpath)
    end

    # Deep structural equality: numbers by value, bools never numbers.
    def deepequal(a, b)
      return true if a.equal?(b)

      abool = a.is_a?(TrueClass) || a.is_a?(FalseClass)
      bbool = b.is_a?(TrueClass) || b.is_a?(FalseClass)
      return a == b if abool || bbool

      # NaN equals NaN: deepequal is structural, not IEEE (as canonical).
      if isnum(a) && isnum(b)
        return true if a.is_a?(Float) && a.nan? && b.is_a?(Float) && b.nan?

        return a == b
      end

      return a.equal?(b) if a.nil? || b.nil? || a.equal?(ABSENT) || b.equal?(ABSENT)

      if islist(a) && islist(b)
        return false if a.length != b.length

        return a.each_index.all? { |i| deepequal(a[i], b[i]) }
      end

      if ismap(a) && ismap(b)
        return false if a.length != b.length

        return a.all? { |key, val| b.key?(key) && deepequal(val, b[key]) }
      end

      return false if islist(a) != islist(b) || ismap(a) != ismap(b)

      a == b
    end

    # Render a number the same way in every port: 5.0 prints as 5.
    def numstr(val)
      if val.is_a?(Float)
        return 'null' if val.nan? || val.infinite?
        return val.to_i.to_s if val == val.to_i && val.abs < 2**53

        return val.to_s
      end

      val.to_s
    end

    def quote(val)
      out = +'"'
      val.to_s.each_char do |char|
        out << case char
               when '"' then '\\"'
               when '\\' then '\\\\'
               when "\n" then '\\n'
               when "\r" then '\\r'
               when "\t" then '\\t'
               else
                 char.ord < 0x20 ? format('\\u%04x', char.ord) : char
               end
      end
      out << '"'
      out
    end

    # Compact JSON text with map keys sorted, identical in every port.
    def jsonstr(val)
      return 'undefined' if val.equal?(ABSENT)
      return 'null' if val.nil?
      return val ? 'true' : 'false' if val.is_a?(TrueClass) || val.is_a?(FalseClass)
      return quote(val) if val.is_a?(String)
      return numstr(val) if isnum(val)
      return '[' + val.map { |entry| jsonstr(entry) }.join(',') + ']' if islist(val)

      if ismap(val)
        keys = val.keys.map(&:to_s).sort
        return '{' + keys.map { |key| quote(key) + ':' + jsonstr(val[key]) }.join(',') + '}'
      end

      return '[Function]' if val.is_a?(Proc) || val.is_a?(Method)

      quote(val.to_s)
    end

    # Strings verbatim, everything else as compact JSON.
    def stringify(val)
      val.is_a?(String) ? val : jsonstr(val)
    end

    # Render a path as a dotted string.
    def pathify(path)
      (path || []).map(&:to_s).join('.')
    end
  end
end
