# VENDORED: @voxgig/omni sdk-20260908-1556-0 (ruby/lib/voxgig_omni.rb)
# Source: https://github.com/voxgig/omni @ 274708cc2d12b21707d975543953f845f8444be0  [tag: sdk-20260911-2013-0]
# License: MIT (c) voxgig - see repository LICENSE. Do not edit: resync from upstream.
# voxgig_omni - shared multi-language test runner.

require_relative 'util'
require_relative 'runner'

module VoxgigOmni
  module_function

  def make_runner(specref, provider = nil)
    Runner.make_runner(specref, provider)
  end
end
