<?php
declare(strict_types=1);

// PlaystationStoreApi2 SDK utility: result_headers

class PlaystationStoreApi2ResultHeaders
{
    public static function call(PlaystationStoreApi2Context $ctx): ?PlaystationStoreApi2Result
    {
        $response = $ctx->response;
        $result = $ctx->result;
        if ($result) {
            if ($response && is_array($response->headers)) {
                $result->headers = $response->headers;
            } else {
                $result->headers = [];
            }
        }
        return $result;
    }
}
