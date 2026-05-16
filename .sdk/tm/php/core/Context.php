<?php
declare(strict_types=1);

// PlaystationStoreApi2 SDK context

require_once __DIR__ . '/Control.php';
require_once __DIR__ . '/Operation.php';
require_once __DIR__ . '/Spec.php';
require_once __DIR__ . '/Result.php';
require_once __DIR__ . '/Response.php';
require_once __DIR__ . '/Error.php';
require_once __DIR__ . '/Helpers.php';

class PlaystationStoreApi2Context
{
    public string $id;
    public array $out;
    public mixed $client;
    public ?PlaystationStoreApi2Utility $utility;
    public PlaystationStoreApi2Control $ctrl;
    public array $meta;
    public ?array $config;
    public ?array $entopts;
    public ?array $options;
    public mixed $entity;
    public ?array $shared;
    public array $opmap;
    public array $data;
    public array $reqdata;
    public array $match;
    public array $reqmatch;
    public ?array $point;
    public ?PlaystationStoreApi2Spec $spec;
    public ?PlaystationStoreApi2Result $result;
    public ?PlaystationStoreApi2Response $response;
    public PlaystationStoreApi2Operation $op;

    public function __construct(array $ctxmap = [], ?self $basectx = null)
    {
        $this->id = 'C' . random_int(10000000, 99999999);
        $this->out = [];

        $this->client = PlaystationStoreApi2Helpers::get_ctx_prop($ctxmap, 'client') ?? ($basectx ? $basectx->client : null);
        $this->utility = PlaystationStoreApi2Helpers::get_ctx_prop($ctxmap, 'utility') ?? ($basectx ? $basectx->utility : null);

        $this->ctrl = new PlaystationStoreApi2Control();
        $ctrl_raw = PlaystationStoreApi2Helpers::get_ctx_prop($ctxmap, 'ctrl');
        if (is_array($ctrl_raw)) {
            if (array_key_exists('throw', $ctrl_raw)) {
                $this->ctrl->throw_err = $ctrl_raw['throw'];
            }
            if (isset($ctrl_raw['explain']) && is_array($ctrl_raw['explain'])) {
                $this->ctrl->explain = $ctrl_raw['explain'];
            }
        } elseif ($basectx !== null && $basectx->ctrl !== null) {
            $this->ctrl = $basectx->ctrl;
        }

        $m = PlaystationStoreApi2Helpers::get_ctx_prop($ctxmap, 'meta');
        $this->meta = is_array($m) ? $m : ($basectx ? $basectx->meta ?? [] : []);

        $cfg = PlaystationStoreApi2Helpers::get_ctx_prop($ctxmap, 'config');
        $this->config = is_array($cfg) ? $cfg : ($basectx ? $basectx->config : null);

        $eo = PlaystationStoreApi2Helpers::get_ctx_prop($ctxmap, 'entopts');
        $this->entopts = is_array($eo) ? $eo : ($basectx ? $basectx->entopts : null);

        $o = PlaystationStoreApi2Helpers::get_ctx_prop($ctxmap, 'options');
        $this->options = is_array($o) ? $o : ($basectx ? $basectx->options : null);

        $e = PlaystationStoreApi2Helpers::get_ctx_prop($ctxmap, 'entity');
        $this->entity = $e ?? ($basectx ? $basectx->entity : null);

        $s = PlaystationStoreApi2Helpers::get_ctx_prop($ctxmap, 'shared');
        $this->shared = is_array($s) ? $s : ($basectx ? $basectx->shared : null);

        $om = PlaystationStoreApi2Helpers::get_ctx_prop($ctxmap, 'opmap');
        $this->opmap = is_array($om) ? $om : ($basectx ? $basectx->opmap ?? [] : []);

        $this->data = PlaystationStoreApi2Helpers::to_map(PlaystationStoreApi2Helpers::get_ctx_prop($ctxmap, 'data')) ?? [];
        $this->reqdata = PlaystationStoreApi2Helpers::to_map(PlaystationStoreApi2Helpers::get_ctx_prop($ctxmap, 'reqdata')) ?? [];
        $this->match = PlaystationStoreApi2Helpers::to_map(PlaystationStoreApi2Helpers::get_ctx_prop($ctxmap, 'match')) ?? [];
        $this->reqmatch = PlaystationStoreApi2Helpers::to_map(PlaystationStoreApi2Helpers::get_ctx_prop($ctxmap, 'reqmatch')) ?? [];

        $pt = PlaystationStoreApi2Helpers::get_ctx_prop($ctxmap, 'point');
        $this->point = is_array($pt) ? $pt : ($basectx ? $basectx->point : null);

        $sp = PlaystationStoreApi2Helpers::get_ctx_prop($ctxmap, 'spec');
        $this->spec = ($sp instanceof PlaystationStoreApi2Spec) ? $sp : ($basectx ? $basectx->spec : null);

        $r = PlaystationStoreApi2Helpers::get_ctx_prop($ctxmap, 'result');
        $this->result = ($r instanceof PlaystationStoreApi2Result) ? $r : ($basectx ? $basectx->result : null);

        $rp = PlaystationStoreApi2Helpers::get_ctx_prop($ctxmap, 'response');
        $this->response = ($rp instanceof PlaystationStoreApi2Response) ? $rp : ($basectx ? $basectx->response : null);

        $opname = PlaystationStoreApi2Helpers::get_ctx_prop($ctxmap, 'opname') ?? '';
        $this->op = $this->resolve_op($opname);
    }

    public function resolve_op(string $opname): PlaystationStoreApi2Operation
    {
        if (isset($this->opmap[$opname])) {
            return $this->opmap[$opname];
        }
        if ($opname === '') {
            return new PlaystationStoreApi2Operation([]);
        }

        $entname = (is_object($this->entity) && method_exists($this->entity, 'get_name'))
            ? $this->entity->get_name()
            : '_';
        $opcfg = \Voxgig\Struct\Struct::getpath($this->config, "entity.{$entname}.op.{$opname}");

        $input = ($opname === 'update' || $opname === 'create') ? 'data' : 'match';

        $points = [];
        if (is_array($opcfg)) {
            $t = \Voxgig\Struct\Struct::getprop($opcfg, 'points');
            if (is_array($t)) {
                $points = $t;
            }
        }

        $op = new PlaystationStoreApi2Operation([
            'entity' => $entname,
            'name' => $opname,
            'input' => $input,
            'points' => $points,
        ]);
        $this->opmap[$opname] = $op;
        return $op;
    }

    public function make_error(string $code, string $msg): PlaystationStoreApi2Error
    {
        return new PlaystationStoreApi2Error($code, $msg, $this);
    }
}
