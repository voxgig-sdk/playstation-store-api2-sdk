# PlaystationStoreApi2 SDK utility: feature_add
module PlaystationStoreApi2Utilities
  FeatureAdd = ->(ctx, f) {
    ctx.client.features << f
  }
end
