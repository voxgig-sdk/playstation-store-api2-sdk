<?php
declare(strict_types=1);

// PlaystationStoreApi2 SDK utility registration

require_once __DIR__ . '/../core/UtilityType.php';
require_once __DIR__ . '/Clean.php';
require_once __DIR__ . '/Done.php';
require_once __DIR__ . '/MakeError.php';
require_once __DIR__ . '/FeatureAdd.php';
require_once __DIR__ . '/FeatureHook.php';
require_once __DIR__ . '/FeatureInit.php';
require_once __DIR__ . '/Fetcher.php';
require_once __DIR__ . '/MakeFetchDef.php';
require_once __DIR__ . '/MakeContext.php';
require_once __DIR__ . '/MakeOptions.php';
require_once __DIR__ . '/MakeRequest.php';
require_once __DIR__ . '/MakeResponse.php';
require_once __DIR__ . '/MakeResult.php';
require_once __DIR__ . '/MakePoint.php';
require_once __DIR__ . '/MakeSpec.php';
require_once __DIR__ . '/MakeUrl.php';
require_once __DIR__ . '/Param.php';
require_once __DIR__ . '/PrepareAuth.php';
require_once __DIR__ . '/PrepareBody.php';
require_once __DIR__ . '/PrepareHeaders.php';
require_once __DIR__ . '/PrepareMethod.php';
require_once __DIR__ . '/PrepareParams.php';
require_once __DIR__ . '/PreparePath.php';
require_once __DIR__ . '/PrepareQuery.php';
require_once __DIR__ . '/ResultBasic.php';
require_once __DIR__ . '/ResultBody.php';
require_once __DIR__ . '/ResultHeaders.php';
require_once __DIR__ . '/TransformRequest.php';
require_once __DIR__ . '/TransformResponse.php';

PlaystationStoreApi2Utility::setRegistrar(function (PlaystationStoreApi2Utility $u): void {
    $u->clean = [PlaystationStoreApi2Clean::class, 'call'];
    $u->done = [PlaystationStoreApi2Done::class, 'call'];
    $u->make_error = [PlaystationStoreApi2MakeError::class, 'call'];
    $u->feature_add = [PlaystationStoreApi2FeatureAdd::class, 'call'];
    $u->feature_hook = [PlaystationStoreApi2FeatureHook::class, 'call'];
    $u->feature_init = [PlaystationStoreApi2FeatureInit::class, 'call'];
    $u->fetcher = [PlaystationStoreApi2Fetcher::class, 'call'];
    $u->make_fetch_def = [PlaystationStoreApi2MakeFetchDef::class, 'call'];
    $u->make_context = [PlaystationStoreApi2MakeContext::class, 'call'];
    $u->make_options = [PlaystationStoreApi2MakeOptions::class, 'call'];
    $u->make_request = [PlaystationStoreApi2MakeRequest::class, 'call'];
    $u->make_response = [PlaystationStoreApi2MakeResponse::class, 'call'];
    $u->make_result = [PlaystationStoreApi2MakeResult::class, 'call'];
    $u->make_point = [PlaystationStoreApi2MakePoint::class, 'call'];
    $u->make_spec = [PlaystationStoreApi2MakeSpec::class, 'call'];
    $u->make_url = [PlaystationStoreApi2MakeUrl::class, 'call'];
    $u->param = [PlaystationStoreApi2Param::class, 'call'];
    $u->prepare_auth = [PlaystationStoreApi2PrepareAuth::class, 'call'];
    $u->prepare_body = [PlaystationStoreApi2PrepareBody::class, 'call'];
    $u->prepare_headers = [PlaystationStoreApi2PrepareHeaders::class, 'call'];
    $u->prepare_method = [PlaystationStoreApi2PrepareMethod::class, 'call'];
    $u->prepare_params = [PlaystationStoreApi2PrepareParams::class, 'call'];
    $u->prepare_path = [PlaystationStoreApi2PreparePath::class, 'call'];
    $u->prepare_query = [PlaystationStoreApi2PrepareQuery::class, 'call'];
    $u->result_basic = [PlaystationStoreApi2ResultBasic::class, 'call'];
    $u->result_body = [PlaystationStoreApi2ResultBody::class, 'call'];
    $u->result_headers = [PlaystationStoreApi2ResultHeaders::class, 'call'];
    $u->transform_request = [PlaystationStoreApi2TransformRequest::class, 'call'];
    $u->transform_response = [PlaystationStoreApi2TransformResponse::class, 'call'];
});
