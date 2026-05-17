package voxgigplaystationstoreapi2sdk

import (
	"github.com/voxgig-sdk/playstation-store-api2-sdk/go/core"
	"github.com/voxgig-sdk/playstation-store-api2-sdk/go/entity"
	"github.com/voxgig-sdk/playstation-store-api2-sdk/go/feature"
	_ "github.com/voxgig-sdk/playstation-store-api2-sdk/go/utility"
)

// Type aliases preserve external API.
type PlaystationStoreApi2SDK = core.PlaystationStoreApi2SDK
type Context = core.Context
type Utility = core.Utility
type Feature = core.Feature
type Entity = core.Entity
type PlaystationStoreApi2Entity = core.PlaystationStoreApi2Entity
type FetcherFunc = core.FetcherFunc
type Spec = core.Spec
type Result = core.Result
type Response = core.Response
type Operation = core.Operation
type Control = core.Control
type PlaystationStoreApi2Error = core.PlaystationStoreApi2Error

// BaseFeature from feature package.
type BaseFeature = feature.BaseFeature

func init() {
	core.NewBaseFeatureFunc = func() core.Feature {
		return feature.NewBaseFeature()
	}
	core.NewTestFeatureFunc = func() core.Feature {
		return feature.NewTestFeature()
	}
	core.NewContainerEntityFunc = func(client *core.PlaystationStoreApi2SDK, entopts map[string]any) core.PlaystationStoreApi2Entity {
		return entity.NewContainerEntity(client, entopts)
	}
}

// Constructor re-exports.
var NewPlaystationStoreApi2SDK = core.NewPlaystationStoreApi2SDK
var TestSDK = core.TestSDK
var NewContext = core.NewContext
var NewSpec = core.NewSpec
var NewResult = core.NewResult
var NewResponse = core.NewResponse
var NewOperation = core.NewOperation
var MakeConfig = core.MakeConfig
var NewBaseFeature = feature.NewBaseFeature
var NewTestFeature = feature.NewTestFeature
