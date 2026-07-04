// Typed models for the PlaystationStoreApi2 SDK.
//
// GENERATED from the API model: main.kit.entity.<e>.fields[] and per-op
// params (op.<name>.points[].args.params[]). Field/param types come from the
// canonical type sentinels via @voxgig/sdkgen canonToType (source of truth:
// @voxgig/apidef VALID_CANON). Do not edit by hand.

export interface Container {
  age_limit?: number
  attribute?: Record<string, any>
  container_type?: string
  content_origin?: number
  dob_required?: boolean
  id?: string
  image?: any[]
  link?: any[]
}

export interface ContainerListMatch {
  age_limit: string
  container_id: string
  country: string
  language: string
}

