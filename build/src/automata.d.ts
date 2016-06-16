/**
 * Created by ibon on 2/8/16.
 */
export interface Message {
    msgId: string;
    data?: any;
}
export declare type GenericMap<T> = {
    [name: string]: T;
};
export declare type Action = <T>(session: Session<T>, message: Message) => T;
export interface AutoTransitionJson {
    millis: number;
    data?: any;
}
export interface TransitionJson {
    from: string;
    to: string;
    event: string;
    timeout?: AutoTransitionJson;
}
export interface FSMJson {
    name: string;
    state: string[];
    initial_state: string;
    transition: TransitionJson[];
}
export declare type SessionMessageCallback = <T>(session: Session<T>, message?: Message) => void;
export declare type SessionMessageCallbackError = <T>(session: Session<T>, message?: Error) => void;
export declare class SessionConsumeMessagePromise<T> {
    _success: SessionMessageCallback;
    _error: SessionMessageCallbackError;
    constructor();
    then(ok: SessionMessageCallback, error?: SessionMessageCallbackError): this;
    __success(s: Session<T>, m: Message): void;
    __error(s: Session<T>, message?: Error): void;
}
export declare class FSMRegistry {
    static _fsm: GenericMap<FSM>;
    static FSMFromId(id: string): FSM;
    static register(fsm_json: FSMJson): FSM;
    static createSession<T>(session_controller: T, fsm_id: string, o?: SessionObserver<T>): SessionConsumeMessagePromise<T>;
}
export interface StateAutoTransitionElement {
    millis: number;
    message?: Message;
    timer_id?: number;
}
export declare class State {
    _name: string;
    _exit_transitions: GenericMap<Transition>;
    _exit_transitions_count: number;
    _enter_action: Action;
    _exit_action: Action;
    _auto_transition: StateAutoTransitionElement[];
    constructor(name: string);
    transitionForMessage(m: Message): Transition;
    addExitTransition(t: Transition): void;
    name: string;
    __onExit<T>(s: Session<T>, m: Message): boolean;
    __onEnter<T>(s: Session<T>, m: Message): boolean;
    __startTimeoutTransitionElements<T>(s: Session<T>): void;
    __stopTimeoutTransitionElements(): void;
    __notifyTimeoutEvent<T>(s: Session<T>, m: Message): void;
    __setTimeoutTransitionInfo(millis: number, message: Message): void;
    isFinal(): boolean;
    toString(): string;
}
export declare class FSM extends State {
    _states: State[];
    _transitions: Transition[];
    _initial_state: State;
    constructor(fsm: FSMJson);
    initial_state: State;
    serialize(): FSMJson;
    __createStates(states: string[], initial: string): void;
    __setInitialState(st: State): void;
    __createInitialTransition(): void;
    __createEnterAction(): void;
    __findStateByName(n: string): State;
    __createTransitions(transitions: TransitionJson[]): void;
}
export declare class Transition {
    static __InitialTransitionEvent: string;
    static __InitialTransitionMessage: Message;
    _event: string;
    _initial_state: State;
    _final_state: State;
    constructor(from: State, to: State, event: string);
    event: string;
    final_state: State;
    toString(): string;
}
export interface SerializedSessionContext {
    current_state: string;
    prev_state: string;
}
export declare class SessionContext {
    _current_state: State;
    _prev_state: State;
    constructor(c: State, p: State);
    serialize(): SerializedSessionContext;
    current_state: State;
    prev_state: State;
    currentStateName(): string;
    prevStateName(): string;
    printStackTrace(): void;
}
export interface SessionObserverEvent<T> {
    session: Session<T>;
    message: Message;
    custom_message?: Message;
    current_state_name: string;
    prev_state_name: string;
}
export interface SessionObserver<T> {
    contextCreated(e: SessionObserverEvent<T>): void;
    contextDestroyed(e: SessionObserverEvent<T>): void;
    sessionEnded(e: SessionObserverEvent<T>): void;
    customEvent(e: SessionObserverEvent<T>): void;
    stateChanged(e: SessionObserverEvent<T>): void;
}
export interface SerializedSession {
    ended: boolean;
    controller: any;
    states: SerializedSessionContext[];
    fsm: FSMJson | string;
}
export declare class Session<T> {
    _fsm: FSM;
    _session_controller: T;
    _states: SessionContext[];
    _ended: boolean;
    _messages_controller: SessionMessagesController<T>;
    _observers: SessionObserver<T>[];
    _sessionEndPromise: SessionConsumeMessagePromise<T>;
    constructor(session_controller: T);
    __initialize(fsm: FSM): SessionConsumeMessagePromise<T>;
    __serializeController(): any;
    serialize(from_registry?: boolean): SerializedSession;
    static deserialize<T, U>(s: SerializedSession, deserializer: (sg: U) => T, from_registry?: boolean): Session<T>;
    __deserialize(s: SerializedSession, from_registry?: boolean): void;
    addObserver(o: SessionObserver<T>): void;
    /**
     * User side message.
     */
    dispatchMessage<U extends Message>(m: U): SessionConsumeMessagePromise<T>;
    /**
     * From SessionController internals.
     */
    postMessage(m: Message): void;
    __messageImpl(m: Message): void;
    current_state: State;
    prev_state: State;
    __onEnter(m: Message): void;
    __onExit(m: Message): void;
    __invoke(method: string, m: Message): any;
    __consumeMessageForFSM(m: Message): void;
    __findStateWithTransitionForMessage(m: Message): State;
    __exitAllStatesUpToStateWithTransitionForMessage(stateWitTransition: State, m: Message): void;
    __popAllStates(m: Message): void;
    __setCurrentState(s: State, m: Message): void;
    __endSession(m: Message): void;
    current_state_name: string;
    prev_state_name: string;
    __consumeMessageForState(m: Message): void;
    __processMessage(state_for_message: State, m: Message): void;
    fireCustomEvent(message: any): void;
    __notifySessionEnded(m: Message): void;
    __notifyContextCreated(m: Message): void;
    __notifyContextDestroyed(m: Message): void;
    __notifyStateChange(m: Message): void;
    __notify(m: Message, method: string): void;
    controller: T;
    printStackTrace(): void;
}
export declare class SessionMessageControllerMessageQueue<T> {
    _session: Session<T>;
    _triggering_message: Message;
    _messages_queue: Message[];
    _callback: SessionConsumeMessagePromise<T>;
    constructor(session: Session<T>, m: Message, callback?: SessionConsumeMessagePromise<T>);
    postMessage(m: Message): void;
    __consumeMessage(): boolean;
}
export declare class SessionMessagesController<T> {
    _session: Session<T>;
    _message_queues: SessionMessageControllerMessageQueue<T>[];
    _consuming: boolean;
    constructor(session: Session<T>);
    dispatchMessage(m: Message, callback?: SessionConsumeMessagePromise<T>): void;
    postMessage(m: Message): void;
    __consumeMessage(): void;
    __consumeOne(): void;
}
export declare class Automata {
    static RegisterFSM(file: string | FSMJson): void;
    static CreateSession<T>(controller: T, fsm_name: string, o?: SessionObserver<T>): SessionConsumeMessagePromise<T>;
}
