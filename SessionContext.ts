import State from "./State";

export interface SerializedSessionContext {
    current : {
        name : string;
        fsm : string;
    }
}

/**
 * Context traces substates path.
 * It keeps a current state reference, and from which super state, current state was reached.
 *
 * At any given time, at least two SessionContext exists:
 *   + FSM
 *   + current state in FSM.
 */
export default class SessionContext {

    previous_: State = null;
    current_: State = null;

    constructor(prev: State, current: State) {
        this.previous_ = prev;
        this.current_ = current;
    }

    get from() {
        return this.previous_;
    }

    get current() {
        return this.current_;
    }

    set current(current: State) {
        this.current_ = current;
    }

    __stateToJSON(s: State) {
        if ( s===null ) {
            return null;
        } else {
            return {
                name : s.name,
                fsm : s.fsm_!==null ? s.fsm_.name : s.name
            }
        }
    }

    serialize() {
        return {
            current: this.__stateToJSON( this.current )
        }
    }
}