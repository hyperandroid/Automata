"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * A Transition is a link between two states.
 * It fires whenever an state has an exit transition identified by `event`.
 */
class Transition {
    constructor(from, to, event) {
        this.event_ = event;
        this.from_ = from;
        this.to_ = to;
    }
    setup() {
        this.from_.addExitTransition(this);
        this.to_.addEnterTransition(this);
        return this;
    }
    get from() {
        return this.from_;
    }
    get to() {
        return this.to_;
    }
    get event() {
        return this.event_;
    }
}
exports.default = Transition;
//# sourceMappingURL=Transition.js.map