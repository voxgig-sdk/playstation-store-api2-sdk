package core

var UtilityRegistrar func(u *Utility)

var NewBaseFeatureFunc func() Feature

var NewTestFeatureFunc func() Feature

var NewContainerEntityFunc func(client *PlaystationStoreApi2SDK, entopts map[string]any) PlaystationStoreApi2Entity

