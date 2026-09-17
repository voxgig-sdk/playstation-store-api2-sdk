# VENDORED: @voxgig/omni sdk-20260917-1242-0 (ruby/lib/voxgig_omni.rb)
# Source: https://github.com/voxgig/omni @ b9e6085d185e174be84f9e6123be807ccd9fcb4e  [tag: sdk-20260917-1242-0]
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
