# PlaystationStoreApi2 SDK utility registration
require_relative '../core/utility_type'
require_relative 'clean'
require_relative 'done'
require_relative 'make_error'
require_relative 'feature_add'
require_relative 'feature_hook'
require_relative 'feature_init'
require_relative 'fetcher'
require_relative 'make_fetch_def'
require_relative 'make_context'
require_relative 'make_options'
require_relative 'make_request'
require_relative 'make_response'
require_relative 'make_result'
require_relative 'make_point'
require_relative 'make_spec'
require_relative 'make_url'
require_relative 'param'
require_relative 'prepare_auth'
require_relative 'prepare_body'
require_relative 'prepare_headers'
require_relative 'prepare_method'
require_relative 'prepare_params'
require_relative 'prepare_path'
require_relative 'prepare_query'
require_relative 'result_basic'
require_relative 'result_body'
require_relative 'result_headers'
require_relative 'transform_request'
require_relative 'transform_response'

PlaystationStoreApi2Utility.registrar = ->(u) {
  u.clean = PlaystationStoreApi2Utilities::Clean
  u.done = PlaystationStoreApi2Utilities::Done
  u.make_error = PlaystationStoreApi2Utilities::MakeError
  u.feature_add = PlaystationStoreApi2Utilities::FeatureAdd
  u.feature_hook = PlaystationStoreApi2Utilities::FeatureHook
  u.feature_init = PlaystationStoreApi2Utilities::FeatureInit
  u.fetcher = PlaystationStoreApi2Utilities::Fetcher
  u.make_fetch_def = PlaystationStoreApi2Utilities::MakeFetchDef
  u.make_context = PlaystationStoreApi2Utilities::MakeContext
  u.make_options = PlaystationStoreApi2Utilities::MakeOptions
  u.make_request = PlaystationStoreApi2Utilities::MakeRequest
  u.make_response = PlaystationStoreApi2Utilities::MakeResponse
  u.make_result = PlaystationStoreApi2Utilities::MakeResult
  u.make_point = PlaystationStoreApi2Utilities::MakePoint
  u.make_spec = PlaystationStoreApi2Utilities::MakeSpec
  u.make_url = PlaystationStoreApi2Utilities::MakeUrl
  u.param = PlaystationStoreApi2Utilities::Param
  u.prepare_auth = PlaystationStoreApi2Utilities::PrepareAuth
  u.prepare_body = PlaystationStoreApi2Utilities::PrepareBody
  u.prepare_headers = PlaystationStoreApi2Utilities::PrepareHeaders
  u.prepare_method = PlaystationStoreApi2Utilities::PrepareMethod
  u.prepare_params = PlaystationStoreApi2Utilities::PrepareParams
  u.prepare_path = PlaystationStoreApi2Utilities::PreparePath
  u.prepare_query = PlaystationStoreApi2Utilities::PrepareQuery
  u.result_basic = PlaystationStoreApi2Utilities::ResultBasic
  u.result_body = PlaystationStoreApi2Utilities::ResultBody
  u.result_headers = PlaystationStoreApi2Utilities::ResultHeaders
  u.transform_request = PlaystationStoreApi2Utilities::TransformRequest
  u.transform_response = PlaystationStoreApi2Utilities::TransformResponse
}
