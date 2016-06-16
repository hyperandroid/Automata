/**
 * Created by ibon on 2/8/16.
 */

export interface Message {
    msgId : string;
    data? : any;
}

export type GenericMap<T> = { [name : string] : T };
export type Action = <T>(session: Session<T>, message : Message) => T;

export interface AutoTransitionJson {
    millis : number,
    data?  : any;
}

export interface TransitionJson {
    from :      string;
    to :        string;
    event :     string;
    timeout? :  AutoTransitionJson
}

export interface FSMJson {
    name :          string;
    state :         string[];
    initial_state : string;
    transition :    TransitionJson[];
}

export type SessionMessageCallback = <T>(session : Session<T>, message? : Message) => void;
export type SessionMessageCallbackError = <T>(session : Session<T>, message? : Error) => void;

export class SessionConsumeMessagePromise<T> {
    
    _success : SessionMessageCallback;
    _error   : SessionMessageCallbackError;
    
    constructor() {
    }
    
    then( ok : SessionMessageCallback, error? : SessionMessageCallbackError ) {
        this._success = ok;
        this._error = error;
        return this;
    }
    
    __success( s : Session<T>, m : Message ) {
        this._success && this._success( s, m );
    }

    __error( s : Session<T>, message? : Error ) {
        this._error && this._error( s, message );
    }
}

export class FSMRegistry {
    
    static _fsm : GenericMap<FSM> = {};

    static FSMFromId( id : string ) : FSM {
        return FSMRegistry._fsm[id];
    }
    
    static register( fsm_json : FSMJson ) : FSM {

        let ret : FSM = null;
        try {
            let fsm = new FSM(fsm_json);
            FSMRegistry._fsm[fsm.name] = fsm;
            console.log("Registered Automata '"+fsm.name+"'");
            ret=fsm;
        } catch( e ) {
            console.error(e);
        }

        return ret;
    }
    
    static createSession<T>( session_controller : T, fsm_id : string, o? : SessionObserver<T> ) : SessionConsumeMessagePromise<T> {
        
        const promise : SessionConsumeMessagePromise<T> = new SessionConsumeMessagePromise<T>();
        
        const fsm = FSMRegistry._fsm[ fsm_id ];
        if ( fsm ) {
            const session = new Session( session_controller );
            if ( o ) {
                session.addObserver(o);
            }
            session.__initialize( fsm ).then(
                (session : Session<T>, m: Message) : void => {
                    promise.__success( session, m );
                },
                (session : Session<T>, m : Error) : void => {
                    promise.__error( session, m );
                }
            );
        } else {
            setImmediate( function() {
                promise.__error( null, new Error("Unkonwn automata: '"+fsm_id+"'") );
            } );
        }
        
        return promise;
    }
}

export interface StateAutoTransitionElement {

    millis : number;
    message?: Message;
    timer_id? : number;
}

export class State {

    _name :                     string;
    _exit_transitions :         GenericMap<Transition>;
    _exit_transitions_count :   number;
    _enter_action :             Action;
    _exit_action :              Action;
    _auto_transition :          StateAutoTransitionElement[];
    
    constructor( name : string ) {
        this._name = name;
        this._exit_transitions = {};
        this._exit_transitions_count = 0;
        this._enter_action = null;
        this._exit_action = null;
        this._auto_transition = [];
    }
    
    transitionForMessage( m : Message ) {
        const tr : Transition = this._exit_transitions[ m.msgId ];
        return tr||null;
    }
    
    addExitTransition( t : Transition ) {
        this._exit_transitions[t.event] = t;
        this._exit_transitions_count += 1;
    }
    
    get name() {
        return this._name;
    }
    
    __onExit<T>( s : Session<T>, m : Message ) : boolean {
        if ( this._exit_action!==null ) {
            this._exit_action( s, m );
        }

        this.__stopTimeoutTransitionElements();
        
        return this._exit_action!==null;
    }
    
    __onEnter<T>( s : Session<T>, m : Message ) {
        if ( this._enter_action!==null ) {
            this._enter_action( s, m);
        }

        this.__startTimeoutTransitionElements(s);
        
        return this._enter_action!==null;
    }

    __startTimeoutTransitionElements<T>( s : Session<T> ) {
        this._auto_transition.forEach( (sate) : void => {
            sate.timer_id = setTimeout(
                this.__notifyTimeoutEvent.bind(this,s, sate.message),
                sate.millis
            );
        });
    }

    __stopTimeoutTransitionElements() {
        this._auto_transition.forEach( (sate) : void => {
            if ( sate.timer_id !==-1 ) {
                clearTimeout(sate.timer_id);
                sate.timer_id = -1;
            }
        });
    }

    __notifyTimeoutEvent<T>( s : Session<T>, m : Message ) {
        this.__stopTimeoutTransitionElements();
        s.dispatchMessage( m );
    }

    __setTimeoutTransitionInfo( millis : number, message : Message ) {
        this._auto_transition.push( {
            millis : millis,
            message : message,
            timer_id : -1
        } );
    }
    
    isFinal() : boolean {
        return this._exit_transitions_count === 0;
    }

    toString() : string {
        return this._name;
    }
}

export class FSM extends State {
    
    _states :           State[];
    _transitions :      Transition[];
    _initial_state :    State;
    
    constructor( fsm : FSMJson ) {
        super( fsm.name );
        
        this._states =          [];
        this._transitions =     [];
        this._initial_state =   null;
        
        this.__createStates( fsm.state, fsm.initial_state );
        this.__createTransitions( fsm.transition );
    }
    
    get initial_state() {
        return this._initial_state;
    }

    serialize() : FSMJson {
        return {
            name :          this._name,
            state :         this._states.map( st => st._name ),
            initial_state : this._initial_state._name,
            transition :    this._transitions.map( tr => {
                return {
                    event: tr._event,
                    from: tr._initial_state._name,
                    to: tr._final_state._name
                }
            })
        };
    }
    
    __createStates( states : string[], initial : string ) {

        for( let name of states ) {

            let st: State;
            if ( name.lastIndexOf("FSM:")===-1 ) {
                st= new State(name);
            } else {
                const fsmname = name.substring(4);
                st= FSMRegistry._fsm[fsmname];
                if ( !st ) {
                    throw "Automata '"+this._name+"' referencing other non existent automata: '"+name+"'";
                }
            }

            this._states.push( st );
                        
            if ( st.name === initial ) {
                this.__setInitialState( st );
            }
        }
    }
    
    __setInitialState( st : State ) {
        this._initial_state = st;
        this.__createInitialTransition();
        this.__createEnterAction();
    }
    
    __createInitialTransition() {
        this.addExitTransition( 
            new Transition( 
                this, 
                this._initial_state, 
                Transition.__InitialTransitionEvent ) );
    }
    
    __createEnterAction() {
        this._enter_action = <T>(session : Session<T>, message : Message ) : void => {
            session.postMessage( Transition.__InitialTransitionMessage );
        }
    }
    
    __findStateByName( n : string ) : State {
        for( let s of this._states ) {
            if ( s.name===n ) {
                return s;
            }
        }
        
        return null;
    }
    
    __createTransitions( transitions : TransitionJson[] ) {
        transitions.forEach( (v:TransitionJson /*, index:number, arr:TransitionJson[] */ ) : void => {
            
            const f : State = this.__findStateByName( v.from );
            const t : State = this.__findStateByName( v.to );
            const e : string = v.event;

            if ( !f || !t ) {
                throw `Wrongly defined Automata '${this.name}'. Transition '${v.event}' refers unknown state:'${(!f ? v.from : v.to)}'`;
            }
            
            this._transitions.push( new Transition( f, t, e ) );

            // auto transition behavior.
            if ( typeof v.timeout!=="undefined" ) {
                f.__setTimeoutTransitionInfo( v.timeout.millis, {
                    msgId : e,
                    data  : v.timeout.data
                } );
            }
        });
    }
}

export class Transition {
    
    static __InitialTransitionEvent : string = "__INITIAL_EVENT";
    static __InitialTransitionMessage :  Message = { msgId : Transition.__InitialTransitionEvent };
    
    _event :            string;
    _initial_state :    State;
    _final_state :      State;
    
    constructor( from : State, to : State, event : string ) {
        this._event= event;
        this._initial_state = from;
        this._final_state = to;
        
        if ( from ) {
            from.addExitTransition( this );
        }
    }

    get event() {
        return this._event;
    }

    get final_state() {
        return this._final_state;
    }

    toString() : string {
        return this._event;
    }
}

export interface SerializedSessionContext {
    current_state : string;
    prev_state : string;
}

export class SessionContext {
    
    _current_state :    State;
    _prev_state :       State;
    
    constructor( c:State, p:State ) {
        this._current_state = c;
        this._prev_state = p;
    }

    serialize() : SerializedSessionContext {
        return {
            current_state : this._current_state._name,
            prev_state : this._prev_state ? this._prev_state._name : "",
        };
    }

    get current_state() : State {
        return this._current_state;
    }
    
    get prev_state() : State {
        return this._prev_state;
    }    
    
    currentStateName() : string {
        return this._current_state && this._current_state.name;
    }
    
    prevStateName() : string {
        return this._prev_state && this._prev_state.name;
    }

    printStackTrace() {
        console.log("  "+this._current_state.name );
    }
}

export interface SessionObserverEvent<T> {
    session :               Session<T>;
    message :               Message;
    custom_message? :       Message;
    current_state_name :    string;
    prev_state_name :       string;
}

export interface SessionObserver<T> {
    contextCreated(     e : SessionObserverEvent<T> ) : void;
    contextDestroyed(   e : SessionObserverEvent<T> ) : void;
    sessionEnded(       e : SessionObserverEvent<T> ) : void;
    customEvent(        e : SessionObserverEvent<T> ) : void;
    stateChanged(       e : SessionObserverEvent<T> ) : void;
}

export interface SerializedSession {
    ended : boolean,
    controller : any,
    states : SerializedSessionContext[],
    fsm : FSMJson | string
}

export class Session<T> {
    _fsm :                  FSM;
    _session_controller :   T;
    _states :               SessionContext[];
    _ended :                boolean;
    _messages_controller :  SessionMessagesController<T>;

    _observers :            SessionObserver<T>[];
    _sessionEndPromise :    SessionConsumeMessagePromise<T>;
    
    constructor( session_controller : T ) {
        this._states =              [];
        this._session_controller =  session_controller;
        this._messages_controller = new SessionMessagesController(this);
        this._observers =           [];
        this._fsm =                 null;
        this._ended =               false;
        this._sessionEndPromise =   null;
    }
    
    __initialize( fsm : FSM ) : SessionConsumeMessagePromise<T> {
        
        this._fsm = fsm;
        this._states.push( new SessionContext(fsm, null) );
        this.__invoke( fsm.name + "_enter", Transition.__InitialTransitionMessage );
        const promise =this.dispatchMessage( Transition.__InitialTransitionMessage );
        
        this._sessionEndPromise = promise;
        
        return promise;
    }

    __serializeController() : any {
        var sc = <any>this._session_controller;
        if ( sc.serialize && typeof sc.serialize==="function" ) {
            return sc.serialize();
        }

        return {};
    }

    serialize( from_registry?:boolean ) : SerializedSession {

        const serializedController = this.__serializeController();

        return {
            ended :     this._ended,
            fsm :       from_registry ? this._fsm.name : this._fsm.serialize(),
            states :    this._states.map( st => st.serialize() ),
            controller: serializedController
        };
    }

    static deserialize<T,U>( s : SerializedSession, deserializer : (sg : U) => T, from_registry?:boolean ) : Session<T> {

        const controller : T = deserializer( s.controller );
        const session : Session<T> = new Session( controller );
        session.__deserialize( s, from_registry );

        return session;
    }

    __deserialize( s : SerializedSession, from_registry?:boolean ) {

        if ( !from_registry ) {
            this._fsm = FSMRegistry.register(s.fsm as FSMJson);
        } else {
            if ( typeof s.fsm==='string' ) {
                // try automata saved as string.
                this._fsm = FSMRegistry.FSMFromId(s.fsm as string);
            } else {
                // if not, assume it was saved as fully serialized automata, but loading it was saved as automata name.
                this._fsm = FSMRegistry.FSMFromId((s.fsm as FSMJson).name);
            }
        }

        this._ended = s.ended;
        this._states = s.states.map( e => {
            const c : State = e.current_state === this._fsm.name ?
                this._fsm :
                this._fsm._states.filter( s => s._name===e.current_state )[0];
            const p : State = e.prev_state === "" ?
                null :
                this._fsm._states.filter( s => s._name===e.prev_state )[0];

            return new SessionContext(c, p)
        } );
    }
    
    addObserver( o : SessionObserver<T> ) {
        this._observers.push( o );
    }
    
    /**
     * User side message.
     */
    dispatchMessage<U extends Message>( m : U ) : SessionConsumeMessagePromise<T> {
        const c : SessionConsumeMessagePromise<T> = new SessionConsumeMessagePromise();

        if ( this._ended ) {
            setTimeout( ()=> {
                c._error(this, new Error('Session ended'));
            }, 0 );
        } else {
            this._messages_controller.dispatchMessage(m, c);
        }
        
        return c;
    }
    
    /**
     * From SessionController internals.
     */
    postMessage( m : Message ) {
        this._messages_controller.postMessage( m );
    }
    
    __messageImpl( m : Message ) {
        if ( m === Transition.__InitialTransitionMessage ) {
            this.__consumeMessageForFSM( m );
        } else {
            this.__consumeMessageForState( m );
        }        
    }
    
    get current_state() : State {
        return this._states.length ?
                this._states[ this._states.length-1 ].current_state :
                null;
    }
    
    get prev_state() : State {
        return this._states.length ?
                this._states[ this._states.length-1 ].prev_state :
                null;
    }
    

    __onEnter( m : Message ) {
        
        const cs : State = this.current_state;
        if ( cs!==null && !cs.__onEnter(this, m) ) {
            this.__invoke( cs.name+"_enter", m );
        }        
    }
    
    __onExit( m : Message ) {
        const cs = this.current_state;
        if ( cs!==null && !cs.__onExit( this, m ) ) {
            this.__invoke( cs.name+"_exit", m );
        }        
    }    
    
    __invoke( method : string, m : Message ) : any {
        return (<any>this._session_controller)[method] && (<any>this._session_controller)[method]( this, this.current_state_name, m );
    }
    
    __consumeMessageForFSM( m : Message ) {
        
        const cs = this.current_state;
        const fsm = <FSM>cs;
        const new_current_state = fsm.initial_state;
        
        this._states.push( new SessionContext( new_current_state, this.current_state ) );
        this.__notifyContextCreated( m );
        this.__onEnter( m );
    }
    
    
    __findStateWithTransitionForMessage( m : Message ) : State {
        
        const sc = this._states;
        let state : State = null;
        
        for( let i= sc.length-1; i>=0; i-- ) {
            const current_state : State = sc[i].current_state;
            const tr : Transition= current_state.transitionForMessage( m );
            if ( tr!==null ) {
                state= current_state;
                break;
            }
        }
        
        return state;
    }
    

    __exitAllStatesUpToStateWithTransitionForMessage( stateWitTransition : State, m : Message ) {
        
        while( this._states.length ) {

            let cs : SessionContext= this._states[ this._states.length - 1 ];
            this.__onExit( m );
            
            if ( cs.current_state!==stateWitTransition ) {
                this._states.pop();
                this.__notifyContextDestroyed( m );
            } else {
                break;
            }            
        }
    }    
    
    __popAllStates( m : Message ) {
        while( this._states.length ) {
            this.__onExit(m);
            this._states.pop();
            this.__notifyContextDestroyed( m );
        }
    }
    
    __setCurrentState( s :State, m : Message ) {
        
        let prev : State = null;
        if ( this._states.length ) {
            prev= this._states.pop().current_state;
        }
        
        this._states.push( new SessionContext( s, prev ) );
        this.__notifyStateChange( m );

        this.__onEnter( m );
    }    
    
    __endSession( m : Message ) {

        this._ended= true;    
        this.__notifySessionEnded( m );
    }    
    
    get current_state_name() {
        return this._states.length ?
            this._states[ this._states.length - 1].currentStateName() :
            "<No current state>";
    }
    
    get prev_state_name() {
        return this._states.length ?
            this._states[ this._states.length - 1].prevStateName() :
            "<No prev state>";
    }

    __consumeMessageForState( m : Message ) {
        
        if ( !this._ended ) {
            const state_for_message:State = this.__findStateWithTransitionForMessage(m);

            if (null !== state_for_message) {
                this.__processMessage(state_for_message, m);
            } else {
                throw new Error(`No message: '${m.msgId}' for state: '${this.current_state_name}'`);
            }
        } else {
            throw new Error(`Session is ended. Message ${m.msgId} is discarded.`);
        }
    }   
    
    __processMessage( state_for_message : State, m : Message ) {

        const tr : Transition = state_for_message.transitionForMessage(m);
        const transition_event : string = tr.event;
                        
        if ( !this.__invoke(transition_event+"_preGuard", m) ) {

            this.__exitAllStatesUpToStateWithTransitionForMessage(state_for_message, m);

            this.__invoke(transition_event + "_transition", m);

            let next:State;

            if (! this.__invoke(transition_event + "_postGuard", m) ) {
                next = tr.final_state;
            } else {
                next = state_for_message;
            }

            this.__setCurrentState(next, m);

            if (next.isFinal()) {
                // this.__popAllStates(m);
                this.__endSession(m);
            }
        }
    }

    fireCustomEvent( message : any ) {
        for( let o of this._observers ) {
            o.customEvent( {
                session :               this,
                message :               null,
                current_state_name :    this.current_state_name,
                prev_state_name :       this.prev_state.name,
                custom_message :        message
            } );
        }
    }
    
    __notifySessionEnded( m : Message ) {
        this.__notify( m, "sessionEnded" );
    }

    __notifyContextCreated( m : Message ) {
        this.__notify( m, "contextCreated" );
    }
    
    __notifyContextDestroyed( m : Message ) {
        this.__notify( m, "contextDestroyed");
    }

    __notifyStateChange( m : Message ) {
        this.__notify( m, "stateChanged" );
    }
    
    __notify( m : Message, method : string ) {
        for( let o of this._observers ) {
            (<any>o)[method] && (<any>o)[method]( {
                session :               this,
                message :               m,
                current_state_name :    this.current_state_name,
                prev_state_name :       this.prev_state_name
            } );
        }
    }

    get controller() {
        return this._session_controller;
    }

    printStackTrace() {
        if ( this._states.length===0 ) {
            console.log("session empty");
        } else {
            console.log("session stack trace:");
            this._states.forEach( function( s ) {
                s.printStackTrace();
            });
        }
    }
}

export class SessionMessageControllerMessageQueue<T> {
    
    _session :              Session<T>;
    _triggering_message :   Message;
    _messages_queue :       Message[];
    _callback :             SessionConsumeMessagePromise<T>;
    
    constructor( session : Session<T>, m : Message, callback? : SessionConsumeMessagePromise<T> ) {
        this._session = session;
        this._callback = typeof callback!=="undefined" ? callback : null;
        this._triggering_message =  m;        
        this._messages_queue =      [ m ];
    }
    
    postMessage( m : Message ) {
        this._messages_queue.push( m );
    }
    
    __consumeMessage() : boolean {

        let ret : boolean;

        if ( this._messages_queue.length ) {
            const m = this._messages_queue.shift();

            try {
                this._session.__messageImpl(m);
                ret = false;
            } catch (e) {
                // console.error(`consume for message '${m.msgId}' got exception: `, e);
                this._messages_queue= [];
                this._callback.__error( this._session, e );
                ret = true;
            }

        } else {
            ret = true;
            if ( this._callback ) {
                this._callback.__success( this._session, this._triggering_message );
            }
        }
        
        return ret;
    }
}

export class SessionMessagesController<T> {
    
    _session :          Session<T>;
    _message_queues :   SessionMessageControllerMessageQueue<T>[];
    _consuming :        boolean;
    
    constructor( session : Session<T> ) {
        this._message_queues = [];
        this._session = session;
        this._consuming = false;
    }
    
    dispatchMessage( m : Message, callback? : SessionConsumeMessagePromise<T> ) {
        this._message_queues.push( new SessionMessageControllerMessageQueue(this._session, m, callback) );
        this.__consumeMessage();
    }
    
    postMessage( m : Message ) {
        this._message_queues[0].postMessage( m );
        this.__consumeMessage();
    }

    __consumeMessage() {
        if ( !this._consuming ) {
            this._consuming = true;
            setImmediate( this.__consumeOne.bind(this) );
        }
    }

    __consumeOne() {
        if (this._message_queues.length) {
            if ( this._message_queues[0].__consumeMessage() ) {
                this._message_queues.shift();
            }
        }
        
        if ( this._message_queues.length ) {
            setImmediate( this.__consumeOne.bind(this) );
        } else {
            this._consuming = false;
        }
    }
}

export class Automata {
    
    static RegisterFSM( file : string|FSMJson ) {
        
        if ( typeof file==="string" ) {
            
        } else {
            FSMRegistry.register( file );
        }
    }
    
    static CreateSession<T>( controller : T, fsm_name : string, o? : SessionObserver<T> ) : SessionConsumeMessagePromise<T> {
        return FSMRegistry.createSession( controller, fsm_name, o );
    }
}