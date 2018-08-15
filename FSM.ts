import State from "./State";
import Transition from "./Transition";
import Session from "./Session";
import Registry from "./Registry";

export interface TransitionJson {
    from: string;
    to: string;
    event: string;
}

export interface FSMJson {
    name: string;
    state: string[];
    initial: string;
    transition: TransitionJson[];
}

export type FSMCollectionJson = FSMJson[];

export default class FSM extends State {

    states_: State[] = [];
    transitions_: Transition[] = [];

    initialState_: State = null;

    constructor(json: FSMJson) {
        super(json.name, null);

        this.__createStates(json.state, json.initial);
        this.__createTransitions(json.transition);
    }

    __createStates(states: string[], initial: string) {

        for (let name of states) {

            let st: State = null;

            ["@", "FSM:"].forEach(prefix => {
                if (name.lastIndexOf(prefix) !== -1) {
                    const fsmname = name.substring(prefix.length);
                    st = Registry.Get(fsmname);
                }
            });

            if (st === null) {
                st = new State(name, this);
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

    __findStateByName(n: string): State {
        for (let s of this.states_) {
            if (s.name === n) {
                return s;
            }
        }

        if ( n===this.name) {
            return this;
        }

        return null;
    }

    __createTransitions(transitions: TransitionJson[]) {

        transitions.forEach(v => {

            const f: State = this.__findStateByName(v.from);
            const t: State = this.__findStateByName(v.to);
            const e: string = v.event;

            if (!f || !t) {
                throw new Error(
                    `Wrongly defined Automata '${this.name}'. Transition '${v.event}' refers unknown state:'${(!f ? v.from : v.to)}'`);
            }

            this.transitions_.push(new Transition(f, t, e).setup());
        });
    }

    get isFinal() {
        return this.states_.length === 0;
    }

    onEnter<T>(session: Session<T>, tr: Transition) {
        if (!this.isFinal) {
            session.pushContext(this.initialState_, tr);
        }
    }

    toJSON() : any {
        return {
            name: this.name_,
            state: this.states_.map(st => st instanceof FSM ? "@"+st.name_ : st.name_),
            initial: this.initialState_.name_,
            transition: this.transitions_.map(tr => {
                return {
                    event: tr.event_,
                    from: tr.from.name_,
                    to: tr.to.name_
                }
            })
        }

    }

    serialize() : FSMJson[] {
        const jfsm: FSMJson[] = [];
        jfsm.push(this.toJSON() as FSMJson);
        this.__fsmToJSONImpl(jfsm, this);

        return jfsm;
    }

    __fsmToJSONImpl( jfsm: FSMJson[], fsm: FSM ) {
        fsm.states_.forEach(s => {
            if (s instanceof FSM) {
                jfsm.push( ...(s as FSM).serialize() );
            }
        })
    }

}
