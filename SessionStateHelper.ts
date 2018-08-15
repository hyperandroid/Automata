import Session from "./Session";
import Transition, {Message} from "./Transition";

export interface StateInvocationParams<T> {
    session     : Session<T>;
    transition  : Transition;
    msg         : Message;          // transition call
    guarded?    : boolean;          // check guard callback
}

export default class SessionStateHelper {

    static Invoke<T>(method: string, st: StateInvocationParams<T>) {

        const target = st.session.state;

        if (typeof target !== 'undefined' &&
            typeof method !== 'undefined' &&
            typeof target[method] !== 'undefined' &&
            typeof(target[method]) === 'function') {

            return target[method](st);
        }

        return true;
    }

    static EnterState<T>(session: Session<T>, st: string, cst: StateInvocationParams<T>) {
        SessionStateHelper.Invoke(st + "_enter", cst);
    }

    static ExitState<T>(session: Session<T>, st: string, cst: StateInvocationParams<T>) {
        SessionStateHelper.Invoke(st + "_exit", cst);
    }

    static Transition<T>(session: Session<T>, event: string, cst: StateInvocationParams<T>) {
        SessionStateHelper.Invoke(event + "_transition", cst);
    }

    static CheckGuard<T>(session: Session<T>, event: string, cst: StateInvocationParams<T>): boolean {
        return SessionStateHelper.Invoke(event + "_guard", cst);
    }
}