# PlaystationStoreApi2 SDK error

class PlaystationStoreApi2Error < StandardError
  attr_accessor :is_sdk_error, :sdk, :code, :msg, :ctx, :result, :spec, :status

  def initialize(code = "", msg = "", ctx = nil)
    super(msg)
    @is_sdk_error = true
    @sdk = "PlaystationStoreApi2"
    @code = code
    @msg = msg
    @ctx = ctx
    @result = nil
    @spec = nil
    # make_error promotes the HTTP status here so a consumer can branch on
    # `err.status` without reaching into `err.result`. Ruby needs the
    # accessor declared: unlike Python or Lua, assigning an undeclared
    # attribute is a NoMethodError, not a new field.
    @status = -1
  end

  def error
    @msg
  end

  def to_s
    @msg
  end
end
