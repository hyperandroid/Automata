"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Context traces substates path.
 * It keeps a current state reference, and from which super state, current state was reached.
 *
 * At any given time, at least two SessionContext exists:
 *   + FSM
 *   + current state in FSM.
 */
class SessionContext {
    constructor(prev, current) {
        this.previous_ = null;
        this.current_ = null;
        this.previous_ = prev;
        this.current_ = current;
    }
    get from() {
        return this.previous_;
    }
    get current() {
        return this.current_;
    }
    set current(current) {
        this.current_ = current;
    }
    __stateToJSON(s) {
        if (s === null) {
            return null;
        }
        else {
            return {
                name: s.name,
                fsm: s.fsm_ !== null ? s.fsm_.name : s.name
            };
        }
    }
    serialize() {
        return {
            current: this.__stateToJSON(this.current)
        };
    }
}
exports.default = SessionContext;
//# sourceMappingURL=SessionContext.js.map