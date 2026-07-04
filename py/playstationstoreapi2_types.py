# Typed models for the PlaystationStoreApi2 SDK.
#
# GENERATED from the API model: main.kit.entity.<e>.fields[] and per-op
# params (op.<name>.points[].args.params[]). Field/param types come from the
# canonical type sentinels via @voxgig/sdkgen canonToType (source of truth:
# @voxgig/apidef VALID_CANON). Do not edit by hand.
#
# These are TypedDicts, not dataclasses: the SDK ops return/accept plain dicts
# at runtime, and a TypedDict IS a dict shape, so the types match the runtime.
# Optional (req:false) keys are modelled as TypedDict key-optionality
# (total=False), split into a required base + total=False subclass when a type
# has both required and optional keys.

from __future__ import annotations

from typing import TypedDict, Any


class Container(TypedDict, total=False):
    age_limit: int
    attribute: dict
    container_type: str
    content_origin: int
    dob_required: bool
    id: str
    image: list
    link: list


class ContainerListMatch(TypedDict):
    age_limit: str
    container_id: str
    country: str
    language: str
