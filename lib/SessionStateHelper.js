"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class SessionStateHelper {
    static Invoke(method, st) {
        const target = st.session.state;
        if (typeof target !== 'undefined' &&
            typeof method !== 'undefined' &&
            typeof target[method] !== 'undefined' &&
            typeof (target[method]) === 'function') {
            return target[method](st);
        }
        return true;
    }
    static EnterState(session, st, cst) {
        SessionStateHelper.Invoke(st + "_enter", cst);
    }
    static ExitState(session, st, cst) {
        SessionStateHelper.Invoke(st + "_exit", cst);
    }
    static Transition(session, event, cst) {
        SessionStateHelper.Invoke(event + "_transition", cst);
    }
    static CheckGuard(session, event, cst) {
        return SessionStateHelper.Invoke(event + "_guard", cst);
    }
}
exports.default = SessionStateHelper;
//# sourceMappingURL=SessionStateHelper.js.map