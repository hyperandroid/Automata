"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class State {
    constructor(name, fsm) {
        this.isFinal_ = true;
        this.isInitial_ = true;
        this.enterTransitions_ = {};
        this.exitTransitions_ = {};
        this.name_ = name;
        this.fsm_ = fsm;
    }
    onEnter(session, tr) {
        // emit new state this
    }
    addEnterTransition(t) {
        this.enterTransitions_[t.event] = t;
        this.isInitial_ = false;
    }
    addExitTransition(t) {
        this.exitTransitions_[t.event] = t;
        this.isFinal_ = false;
    }
    get isFinal() {
        return this.isFinal_;
    }
    get isInitial() {
        return this.isInitial_;
    }
    get name() {
        return this.name_;
    }
    transitionForEvent(event) {
        const r = this.exitTransitions_[event];
        return r !== void 0 ? r : null;
    }
    serialize() {
        throw new Error("states can't be serialized like this.!");
    }
}
exports.default = State;
//# sourceMappingURL=State.js.map