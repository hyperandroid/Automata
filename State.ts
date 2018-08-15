import Transition from "./Transition";
import Session from "./Session";
import FSM from "./FSM";

export type TransitionMap = { [key: string]: Transition };

export default class State {

    name_: string;

    fsm_ : FSM;

    isFinal_ = true;
    isInitial_ = true;

    enterTransitions_: TransitionMap = {};
    exitTransitions_: TransitionMap = {};

    constructor(name: string, fsm: FSM) {
        this.name_ = name;
        this.fsm_ = fsm;
    }

    onEnter(session: Session<any>, tr: Transition) {
        // emit new state this
    }

    addEnterTransition(t: Transition) {
        this.enterTransitions_[t.event] = t;
        this.isInitial_ = false;
    }

    addExitTransition(t: Transition) {
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

    transitionForEvent(event: string) {
        const r = this.exitTransitions_[event];
        return r !== void 0 ? r : null;
    }

    serialize() :any {
        throw new Error("states can't be serialized like this.!");
    }
}