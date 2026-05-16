<?php
declare(strict_types=1);

// PlaystationStoreApi2 SDK utility: make_response

class PlaystationStoreApi2MakeResponse
{
    public static function call(PlaystationStoreApi2Context $ctx): array
    {
        if (isset($ctx->out['response'])) {
            return [$ctx->out['response'], null];
        }
        $utility = $ctx->utility;
        $spec = $ctx->spec;
        $result = $ctx->result;
        $response = $ctx->response;

        if (!$spec) {
            return [null, $ctx->make_error('response_no_spec', 'Expected context spec property to be defined.')];
        }
        if (!$response) {
            return [null, $ctx->make_error('response_no_response', 'Expected context response property to be defined.')];
        }
        if (!$result) {
            return [null, $ctx->make_error('response_no_result', 'Expected context result property to be defined.')];
        }

        $spec->step = 'response';
        ($utility->result_basic)($ctx);
        ($utility->result_headers)($ctx);
        ($utility->result_body)($ctx);
        ($utility->transform_response)($ctx);

        if ($result->err === null) {
            $result->ok = true;
        }
        if ($ctx->ctrl->explain) {
            $ctx->ctrl->explain['result'] = $result;
        }

        return [$response, null];
    }
}
