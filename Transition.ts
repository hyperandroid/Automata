import State from "./State";

export interface Message {
    event: string;
    payload?: any;
}

/**
 * A Transition is a link between two states.
 * It fires whenever an state has an exit transition identified by `event`.
 */
export default class Transition {

    from_: State;
    to_: State;
    event_: string;

    constructor(from: State, to: State, event: string) {
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