package core

type PlaystationStoreApi2Error struct {
	IsPlaystationStoreApi2Error bool
	Sdk              string
	Code             string
	Msg              string
	Ctx              *Context
	Result           any
	Spec             any
}

func NewPlaystationStoreApi2Error(code string, msg string, ctx *Context) *PlaystationStoreApi2Error {
	return &PlaystationStoreApi2Error{
		IsPlaystationStoreApi2Error: true,
		Sdk:              "PlaystationStoreApi2",
		Code:             code,
		Msg:              msg,
		Ctx:              ctx,
	}
}

func (e *PlaystationStoreApi2Error) Error() string {
	return e.Msg
}
