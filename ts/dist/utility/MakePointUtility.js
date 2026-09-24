"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makePoint = makePoint;
function terminalParam(point) {
    const parts = point.parts;
    const last = 0 < parts.length ? parts[parts.length - 1] : '';
    return 'string' === typeof last && 0 === last.indexOf('{');
}
function ownPoint(points) {
    let best = points[0];
    for (const cand of points) {
        const candterm = terminalParam(cand);
        const bestterm = terminalParam(best);
        if (candterm !== bestterm ? candterm :
            cand.parts.length < best.parts.length) {
            best = cand;
        }
    }
    return best;
}
function makePoint(ctx) {
    if (ctx.out.point) {
        return ctx.point = ctx.out.point;
    }
    const getprop = ctx.utility.struct.getprop;
    const op = ctx.op;
    const options = ctx.options;
    if (!options.allow.op.includes(op.name)) {
        return ctx.error('point_op_allow', 'Operation "' + op.name +
            '" not allowed by SDK option allow.op value: "' + options.allow.op + '"');
    }
    if (0 === op.points.length) {
        return ctx.error('point_no_points', 'Operation "' + op.name + '" has no endpoint definitions.');
    }
    // Choose the appropriate point based on the match or data.
    if (1 === op.points.length) {
        ctx.point = op.points[0];
    }
    else {
        // Operation argument has priority, but also look in current data or match.
        const reqselector = getprop(ctx, 'req' + op.input);
        const selector = getprop(ctx, op.input);
        let point;
        let matched = false;
        for (let i = 0; i < op.points.length; i++) {
            const cand = op.points[i];
            const select = cand.select;
            let found = true;
            if (selector && select.exist) {
                for (let j = 0; j < select.exist.length; j++) {
                    const existkey = select.exist[j];
                    if (undefined === getprop(reqselector, existkey)
                        && undefined === getprop(selector, existkey)) {
                        found = false;
                        break;
                    }
                }
            }
            // Action is only in operation argument.
            if (found && reqselector.$action !== select.$action) {
                found = false;
            }
            if (found) {
                point = cand;
                matched = true;
                break;
            }
        }
        if (!matched) {
            if (null != reqselector.$action) {
                return ctx.error('point_action_invalid', 'Operation "' + op.name +
                    '" action "' + reqselector.$action + '" is not valid.');
            }
            point = ownPoint(op.points);
        }
        if (null != reqselector.$action &&
            null != point &&
            reqselector.$action !== point.select.$action) {
            return ctx.error('point_action_invalid', 'Operation "' + op.name +
                '" action "' + reqselector.$action + '" is not valid.');
        }
        ctx.point = point;
    }
    return ctx.point;
}
//# sourceMappingURL=MakePointUtility.js.map