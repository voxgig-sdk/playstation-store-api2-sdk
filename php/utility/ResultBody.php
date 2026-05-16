<?php
declare(strict_types=1);

// PlaystationStoreApi2 SDK utility: result_body

class PlaystationStoreApi2ResultBody
{
    public static function call(PlaystationStoreApi2Context $ctx): ?PlaystationStoreApi2Result
    {
        $response = $ctx->response;
        $result = $ctx->result;
        if ($result && $response && $response->json_func && $response->body) {
            $result->body = ($response->json_func)();
        }
        return $result;
    }
}
