"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseFeature = void 0;
class BaseFeature {
    version = '0.0.1';
    name = 'base';
    active = true;
    init(_ctx, _options) { }
    PostConstruct(_ctx) { }
    PostConstructEntity(_ctx) { }
    SetData(_ctx) { }
    GetData(_ctx) { }
    SetMatch(_ctx) { }
    GetMatch(_ctx) { }
    PrePoint(_ctx) { }
    PreSpec(_ctx) { }
    PreRequest(_ctx) { }
    PreResponse(_ctx) { }
    PreResult(_ctx) { }
    PreDone(_ctx) { }
    PreUnexpected(_ctx) { }
}
exports.BaseFeature = BaseFeature;
//# sourceMappingURL=BaseFeature.js.map