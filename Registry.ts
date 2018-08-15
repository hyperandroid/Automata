import {SessionObserver} from "./Session";
import Session from "./Session";
import FSM, {FSMCollectionJson} from "./FSM";

export type FSMRegistry = {[key:string]:FSM};

export default class Registry {

    private static registris_ : FSMRegistry[] = [];
    private static fsm_: FSMRegistry = null;

    static Parse(fsmc: FSMCollectionJson) {
        fsmc.forEach(fsmJson => {
            if ( Registry.Get(fsmJson.name)===null ) {
                const fsm = new FSM(fsmJson);
                Registry.fsm_[fsm.name] = fsm;
            }
        });
    }

    static Get(s: string) : FSM {
        const fsm = Registry.fsm_[s];
        if (typeof fsm === 'undefined') {
            return null;
        }

        return fsm;
    }

    static SessionFor<T>(s: string, state: T, observer?: SessionObserver<T>) {
        const fsm = Registry.Get(s);
        if (fsm === null) {
            throw new Error(`FSM ${s} does not exist.`);
        }

        const session= new Session(state);
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

Registry.PushRegistry();