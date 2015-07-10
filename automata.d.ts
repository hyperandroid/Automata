declare module FSM {

    export interface TransitionMessage {
        msgId : string;
        data? : any;
    }

    export interface ConsumeCallback {
        (session:Session):void
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
    }

    class GuardException {

        msg : string;
        toString() : string;
    }

    class SessionListener {
        contextCreated( obj );
        contextDestroyed( obj );
        finalStateReached( obj );
        stateChanged( obj );
        customEvent( obj );
        guardPreCondition( obj );
        guardPostCondition( obj );
    }

    class State {
        getName() : string;
        isFinal() : boolean;
    }

    class Transition {
        getEvent() : string;
    }

    export interface StateTransitionCallback {
        ( session:Session, state:State, transition:Transition, message:TransitionMessage ) : void;
    }
}

declare module Automata {

    export function registerFSM( object:any );
    export function registerFDA( object:any );
    export function createSession( fda_name : string, controller:any ) :       FSM.Session;
    export function newGuardException( message : string ) :    FSM.GuardException;
    export function newSessionListener( obj : any ) :          FSM.SessionListener;

}