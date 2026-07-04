# frozen_string_literal: true

# Typed models for the PlaystationStoreApi2 SDK.
#
# GENERATED from the API model: main.kit.entity.<e>.fields[] and per-op
# params (op.<name>.points[].args.params[]). Member types come from the
# canonical type sentinels via @voxgig/sdkgen canonToType (source of truth:
# @voxgig/apidef VALID_CANON). Ruby types are unenforced; these YARD
# annotations document the shapes. Do not edit by hand.

# Container entity data model.
#
# @!attribute [rw] age_limit
#   @return [Integer, nil]
#
# @!attribute [rw] attribute
#   @return [Hash, nil]
#
# @!attribute [rw] container_type
#   @return [String, nil]
#
# @!attribute [rw] content_origin
#   @return [Integer, nil]
#
# @!attribute [rw] dob_required
#   @return [Boolean, nil]
#
# @!attribute [rw] id
#   @return [String, nil]
#
# @!attribute [rw] image
#   @return [Array, nil]
#
# @!attribute [rw] link
#   @return [Array, nil]
Container = Struct.new(
  :age_limit,
  :attribute,
  :container_type,
  :content_origin,
  :dob_required,
  :id,
  :image,
  :link,
  keyword_init: true
)

# Request payload for Container#list.
#
# @!attribute [rw] age_limit
#   @return [String]
#
# @!attribute [rw] container_id
#   @return [String]
#
# @!attribute [rw] country
#   @return [String]
#
# @!attribute [rw] language
#   @return [String]
ContainerListMatch = Struct.new(
  :age_limit,
  :container_id,
  :country,
  :language,
  keyword_init: true
)

