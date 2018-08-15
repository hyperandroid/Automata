"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Session_1 = require("./Session");
const FSM_1 = require("./FSM");
class Registry {
    static Parse(fsmc) {
        fsmc.forEach(fsmJson => {
            if (Registry.Get(fsmJson.name) === null) {
                const fsm = new FSM_1.default(fsmJson);
                Registry.fsm_[fsm.name] = fsm;
            }
        });
    }
    static Get(s) {
        const fsm = Registry.fsm_[s];
        if (typeof fsm === 'undefined') {
            return null;
        }
        return fsm;
    }
    static SessionFor(s, state, observer) {
        const fsm = Registry.Get(s);
        if (fsm === null) {
            throw new Error(`FSM ${s} does not exist.`);
        }
        const session = new Session_1.default(state);
        session.initialize(fsm, observer);
        return session;
    }
    static PushRegistry() {
        Registry.fsm_ = {};
        Registry.registris_.push(this.fsm_);
    }
    static PopRegistry() {
        Registry.fsm_ = this.registris_.pop();
    }
}
Registry.registris_ = [];
Registry.fsm_ = null;
exports.default = Registry;
Registry.PushRegistry();
//# sourceMappingURL=Registry.js.map