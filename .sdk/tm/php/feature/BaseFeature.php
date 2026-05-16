<?php
declare(strict_types=1);

// PlaystationStoreApi2 SDK base feature

class PlaystationStoreApi2BaseFeature
{
    public string $version;
    public string $name;
    public bool $active;

    public function __construct()
    {
        $this->version = '0.0.1';
        $this->name = 'base';
        $this->active = true;
    }

    public function get_version(): string { return $this->version; }
    public function get_name(): string { return $this->name; }
    public function get_active(): bool { return $this->active; }

    public function init(PlaystationStoreApi2Context $ctx, array $options): void {}
    public function PostConstruct(PlaystationStoreApi2Context $ctx): void {}
    public function PostConstructEntity(PlaystationStoreApi2Context $ctx): void {}
    public function SetData(PlaystationStoreApi2Context $ctx): void {}
    public function GetData(PlaystationStoreApi2Context $ctx): void {}
    public function GetMatch(PlaystationStoreApi2Context $ctx): void {}
    public function SetMatch(PlaystationStoreApi2Context $ctx): void {}
    public function PrePoint(PlaystationStoreApi2Context $ctx): void {}
    public function PreSpec(PlaystationStoreApi2Context $ctx): void {}
    public function PreRequest(PlaystationStoreApi2Context $ctx): void {}
    public function PreResponse(PlaystationStoreApi2Context $ctx): void {}
    public function PreResult(PlaystationStoreApi2Context $ctx): void {}
    public function PreDone(PlaystationStoreApi2Context $ctx): void {}
    public function PreUnexpected(PlaystationStoreApi2Context $ctx): void {}
}
