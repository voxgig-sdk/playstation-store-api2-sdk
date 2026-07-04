# Typed models for the PlaystationStoreApi2 SDK.
#
# GENERATED from the API model: main.kit.entity.<e>.fields[] and per-op
# params (op.<name>.points[].args.params[]). Field/param types come from the
# canonical type sentinels via @voxgig/sdkgen canonToType (source of truth:
# @voxgig/apidef VALID_CANON). Do not edit by hand.

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Any


@dataclass
class Container:
    age_limit: Optional[int] = None
    attribute: Optional[dict] = None
    container_type: Optional[str] = None
    content_origin: Optional[int] = None
    dob_required: Optional[bool] = None
    id: Optional[str] = None
    image: Optional[list] = None
    link: Optional[list] = None


@dataclass
class ContainerListMatch:
    age_limit: str
    container_id: str
    country: str
    language: str

