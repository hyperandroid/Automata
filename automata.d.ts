declare module FSM {

    export interface FSMDefinitionStateTimer {
        timeout : number;
        event : FSM.TransitionMessage;
    }

    export interface FSMDefinitionState {
        name : string;
        initial? : boolean;
        onTimer? : FSMDefinitionStateTimer;
        onEnter? : string|FSM.StateCallback;
        onExit? : string|StateCallback;
    }

    export interface FSMDefinitionSubState {
        name : string;
    }

    export interface FSMDefinitionTransition {
        event :string;
        from : string;
        to : string;
        onTransition? : string|TransitionCallback;
        onPreGuard? : string|TransitionCallback;
        onPostGuard? : string|TransitionCallback;
    }

    export interface FSMDefinition {
        name : string;
        state : (FSMDefinitionSubState|FSMDefinitionState)[];
        transition : FSMDefinitionTransition[];
        onEnter? : string | StateCallback;
        onExit? : string | StateCallback;
    }

    export interface TransitionMessage {
        msgId : string;
        data? : any;
    }

    export interface ConsumeCallback {
        (session:Session):void
    }

    export interface TransitionCallback {
        (state:State, transition:Transition, message:TransitionMessage):void;
    }

    export interface StateCallback {
        (state:State, transition:Transition, message:TransitionMessage):void;
    }


    export interface SessionFinalStateReachedEvent {
        session : FSM.Session;
    }

    export interface SessionContextEvent {
        session : FSM.Session;
        context : FSM.SessionContext;
    }

    export interface SessionStateChangeEvent {
        session : FSM.Session;
        context : FSM.SessionContext;
        prevState : FSM.State;
        state : FSM.State;
        message : FSM.TransitionMessage;
        isUserMessage : boolean;
    }

    export interface TransitionGuardEvent {
        session : FSM.Session;
        transition : FSM.Transition;
        message : FSM.TransitionMessage;
        exception : string;
    }

    export interface SessionCustomEvent {
        session : FSM.Session;
        data : any;
    }

    class SessionContext {
        getState() : FSM.State;
        printStackTrace() : void;
    }

    class Session {

        consume( message : TransitionMessage, consumeCallback? : FSM.ConsumeCallback  );
        addListener( sl : SessionListener );
        removeListener( sl : SessionListener );
        printStackTrace();
        addProperty( key:string, value:any );
        removeProperty( key:string );
        getProperty( key:string ) : any;
        start( callback:ConsumeCallback ) : void;
        fireCustomEvent( e:any ) : void;
    }

    class GuardException {

        msg : string;
        toString() : string;
    }

    class SessionListener {
        contextCreated( e:SessionContextEvent );
        contextDestroyed( e:SessionContextEvent );
        finalStateReached( e:SessionFinalStateReachedEvent );
        stateChanged( e:SessionStateChangeEvent );
        customEvent( e:SessionCustomEvent );
        guardPreCondition( e:TransitionGuardEvent );
        guardPostCondition( e:TransitionGuardEvent );
    }

    class State {
        getName() : string;
        isFinal() : boolean;
    }

    class Transition {
        getEvent() : string;
        getStartState() : FSM.State;
    }

    export interface StateTransitionCallback {
        ( session:Session, state:State, transition:Transition, message:TransitionMessage ) : void;
    }
}

declare module Automata {

    export function registerFSM( object:FSM.FSMDefinition );
    export function registerFDA( object:FSM.FSMDefinition );
    export function createSession( fda_name : string, controller : any ) : FSM.Session;
    export function newGuardException( message : string ) : FSM.GuardException;
    export function newSessionListener( obj : any ) : FSM.SessionListener;

}