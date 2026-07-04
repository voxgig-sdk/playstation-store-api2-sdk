<?php
declare(strict_types=1);

// Typed models for the PlaystationStoreApi2 SDK.
//
// GENERATED from the API model: main.kit.entity.<e>.fields[] and per-op
// params (op.<name>.points[].args.params[]). Field/param types come from the
// canonical type sentinels via @voxgig/sdkgen canonToType (source of truth:
// @voxgig/apidef VALID_CANON). Do not edit by hand.
//
// These are documentation-grade value objects (PHP 8 typed properties),
// registered on the composer classmap autoload. The SDK boundary exchanges
// assoc-arrays; these classes name the shapes for tooling and typed callers.

/** Container entity data model. */
class Container
{
    public ?int $age_limit = null;
    public ?array $attribute = null;
    public ?string $container_type = null;
    public ?int $content_origin = null;
    public ?bool $dob_required = null;
    public ?string $id = null;
    public ?array $image = null;
    public ?array $link = null;
}

/** Request payload for Container#list. */
class ContainerListMatch
{
    public string $age_limit;
    public string $container_id;
    public string $country;
    public string $language;
}

