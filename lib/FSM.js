"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const State_1 = require("./State");
const Transition_1 = require("./Transition");
const Registry_1 = require("./Registry");
class FSM extends State_1.default {
    constructor(json) {
        super(json.name, null);
        this.states_ = [];
        this.transitions_ = [];
        this.initialState_ = null;
        this.__createStates(json.state, json.initial);
        this.__createTransitions(json.transition);
    }
    __createStates(states, initial) {
        for (let name of states) {
            let st = null;
            ["@", "FSM:"].forEach(prefix => {
                if (name.lastIndexOf(prefix) !== -1) {
                    const fsmname = name.substring(prefix.length);
                    st = Registry_1.default.Get(fsmname);
                }
            });
            if (st === null) {
                st = new State_1.default(name, this);
                if (name === initial) {
                    this.initialState_ = st;
                }
            }
            this.states_.push(st);
        }
        if (this.initialState_ === null) {
            throw new Error("No initial state defined.");
        }
    }
    __findStateByName(n) {
        for (let s of this.states_) {
            if (s.name === n) {
                return s;
            }
        }
        if (n === this.name) {
            return this;
        }
        return null;
    }
    __createTransitions(transitions) {
        transitions.forEach(v => {
            const f = this.__findStateByName(v.from);
            const t = this.__findStateByName(v.to);
            const e = v.event;
            if (!f || !t) {
                throw new Error(`Wrongly defined Automata '${this.name}'. Transition '${v.event}' refers unknown state:'${(!f ? v.from : v.to)}'`);
            }
            this.transitions_.push(new Transition_1.default(f, t, e).setup());
        });
    }
    get isFinal() {
        return this.states_.length === 0;
    }
    onEnter(session, tr) {
        if (!this.isFinal) {
            session.pushContext(this.initialState_, tr);
        }
    }
    toJSON() {
        return {
            name: this.name_,
            state: this.states_.map(st => st instanceof FSM ? "@" + st.name_ : st.name_),
            initial: this.initialState_.name_,
            transition: this.transitions_.map(tr => {
                return {
                    event: tr.event_,
                    from: tr.from.name_,
                    to: tr.to.name_
                };
            })
        };
    }
    serialize() {
        const jfsm = [];
        jfsm.push(this.toJSON());
        this.__fsmToJSONImpl(jfsm, this);
        return jfsm;
    }
    __fsmToJSONImpl(jfsm, fsm) {
        fsm.states_.forEach(s => {
            if (s instanceof FSM) {
                jfsm.push(...s.serialize());
            }
        });
    }
}
exports.default = FSM;
//# sourceMappingURL=FSM.js.map