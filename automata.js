/**
 * @author Ibon Tolosana, @hyperandroid
 *
 * See LICENSE file.
 *
 */


(function (root) {

    var TIMER_CHECK_RESOLUTION= 200;


    /**
     * requireJS available ???
     */
    root.module = {};

    /**
     * @callback  ConsumeCallback
     * @param session {FSM.Session}
     */

    /**
     * @callback TransitionCallback
     * @param state {FSM.State}
     * @param transition {FSM.Transition}
     * @param message {FSM.TransitionMessage}
     */

    /**
     * @callback StateCallback
     * @param state {FSM.State}
     * @param transition {FSM.Transition}
     * @param message {FSM.TransitionMessage}
     */


    /**
     * @name FSM
     * @namespace
     *
     * Local module definition.
     */
    var FSM= {};

    /**
     * @typedef {{ message :FSM.TransitionMessage, callback : ConsumeCallback}}
     */
    FSM.MessageCallbackTuple;

    /**
     * @typedef {{ event : FSM.TransitionMessage, timeout : number}}
     */
    FSM.StateTimeTransitionInfo;

    /**
     * @typedef {{ msgId : string, data? : object }}
     */
    FSM.TransitionMessage;

    /**
     * @typedef {{ fda : string, controller? : Object }}
     */
    FSM.SessionCreationData;

    /**
     * @typedef {{ session : FSM.Session }}
     */
    FSM.SessionFinalStateReachedEvent;

    /**
     * @typedef {{ session : FSM.Session, context : FSM.SessionContext }}
     */
    FSM.SessionContextEvent;

    /**
     * @typedef {{
     *      session : FSM.Session,
     *      context : FSM.SessionContext,
     *      prevState : FSM.State,
     *      state : FSM.State,
     *      message : FSM.TransitionMessage,
     *      isUserMessage : boolean
     * }}
     */
    FSM.SessionStateChangeEvent;

    /**
     * @typedef {{
     *      session : FSM.Session,
     *      transition : FSM.Transition,
     *      message : FSM.TransitionMessage,
     *      exception : string,
     * }}
     */
    FSM.TransitionGuardEvent;

    /**
     * @typedef {{
     *      session : FSM.Session,
     *      data : Object,
     * }}
     */
    FSM.SessionCustomEvent;

    /**
     * @typedef {{
     *  timeout : number,
     *  event : FSM.TransitionMessage
     * }}
     */
    var FSMDefinitionStateTimer;

    /**
     * @typedef {{
     *  name : string,
     *  initial : boolean=,
     *  onTimer : FSMDefinitionStateTimer=,
     *  onEnter : (string|StateCallback),
     *  onExit : (string|StateCallback)
     * }}
     */
    var FSMDefinitionState;

    /**
     * @typedef {{
     *  name : string,
     * }}
     */
    var FSMDefinitionSubState;

    /**
     * @typedef {{
     *  event : string,
     *  from : string,
     *  to : string,
     *  onTransition : (string|TransitionCallback),
     *  onPreGuard : (string|TransitionCallback),
     *  onPostGuard : (string|TransitionCallback)
     * }}
     */
    var FSMDefinitionTransition;

    /**
     * @typedef {{
     *  name :       string,
     *  state :      Array<FSMDefinitionState|FSMDefinitionSubState>,
     *  transition : Array<FSMDefinitionTransition>,
     *  onEnter : (string|StateCallback),
     *  onExit : (string|StateCallback)
     * }}
     */
    var FSMDefinition;

    /**
     * Regular extension mechanism.
     *
     * @param subc <object> object to subclass
     * @param superc <object> object to subclass from
     */
    function extend(subc, superc) {
        var subcp = subc.prototype;
        var method;

        // Class pattern.
        var F = function() {
        };
        F.prototype = superc.prototype;

        subc.prototype = new F();       // chain prototypes.
        subc.superclass = superc.prototype;
        subc.prototype.constructor = subc;

        // Reset constructor. See Object Oriented Javascript for an in-depth explanation of this.
        if (superc.prototype.constructor === Object.prototype.constructor) {
            superc.prototype.constructor = superc;
        }

        // los metodos de superc, que no esten en esta clase, crear un metodo que
        // llama al metodo de superc.
        for ( method in subcp ) {
            if (subcp.hasOwnProperty(method)) {
                subc.prototype[method] = subcp[method];
            }
        }
    }

    /**
     * Bind mechanism. Honors already existing bind functions.
     */
    Function.prototype.bind = Function.prototype.bind || function( /* this */ ) {

        var fn=     this;                                   // the function
        var args=   Array.prototype.slice.call(arguments);  // copy the arguments.
        var obj=    args.shift();                           // first parameter will be context 'this'

        return function() {
            fn.apply( obj, args.concat( Array.prototype.slice(arguments) ) );
        };
    };

    /**
     * TimerTask sequence.
     */
    var __TimerIndex= 0;

    /**
     * State creation sequence
     */
    var __StateIndex= 0;

    /**
     * Initial transition msgId identification.
     */
    var __InitialTransitionId= "__initial_transition_id";

    /**
     * Automata system context object. Supposed to be unique.
     */
    var fsmContext= null;

    /**
     * @memberOf FSM
     *
     * @class TimerTask
     * @classdesc
     *
     * This object encapsulates a task timer.
     * They are automatically defined by setting an onTimer block in a state definition.
     *
     * @constructor
     * @param session <FSM.Session> a session object
     * @param event   <FSM.TransitionMessage> a message object.
     * @param time    <number> an integer specifying milliseconds.
     */
    FSM.TimerTask= function( session, event, time ) {

        /**
         * Session to forward the event to on timeout.
         * @name session
         * @memberOf TimerTask.prototype
         * @type {FSM.Session}
         */
        this.session=       session;

        /**
         * This event will be forwarded to the task session owner when timeout.
         * This is an event to be sent to a transition.
         * @name event
         * @memberOf TimerTask.prototype
         * @type {FSM.TransitionMessage}
         */
        this.event=         event;

        /**
         * Milliseconds to consider this task expired.
         * @name triggerTime
         * @memberOf TimerTask.prototype
         * @type {number}
         */
        this.triggerTime=   time;

        /**
         * TimerTask id.
         * This id is returned whenever a timed-transition is set. Thus, timed events can be cancelled.
         * @name id
         * @memberOf TimerTask.prototype
         * @type {number}
         */
        this.id=            __TimerIndex++;

        /**
         * Cache session's current state. When the task times-out, it is checked whether the session is still in the
         * same state. If so, the timeout event is sent.
         * @name contextState
         * @memberOf TimerTask.prototype
         * @type {FSM.State}
         */
        this.contextState=  session.getCurrentState();

        /**
         * Time when the timer task was created. More or less at scheduleTime + triggerTime the task times out.
         * @mame scheduleTime
         * @memberOf TimerTask.prototype
         * @type {number}
         */
        this.scheduleTime=  new Date().getTime();

        /**
         * Internal flag of timer task validity.
         * @name consumed
         * @memberOf TimerTask.prototype
         * @type {boolean}
         */
        this.consumed    =  false;

        return this;
    };

    /**
     * @lend FSM.TimerTask.prototype
     */
    FSM.TimerTask.prototype= {

        /**
         * Get this task id.
         * @returns {number}
         */
        getId : function() {
            return this.id;
        },

        /**
         * Has this timer task already been fired ?
         */
        isConsumed  : function() {
            return this.consumed;
        },

        /**
         * Is this timer task on time so that it must be triggered ?
         * @param t {number} current time.
         */
        isExpired : function( t ) {
            return this.scheduleTime + this.triggerTime < t;
        },

        /**
         * This is the timer task control function.
         * @param t {number} current time.
         */
        consume : function( t ) {

            // should never happen. how a consumed task could be resubmitted ?
            if ( this.isConsumed() ) {
                return true;
            }

            if ( this.isExpired( t ) ) {
                if ( this.contextState === this.session.getCurrentState() ) {
                    this.session.consume( this.event );
                }
                // else, the session has already changed state and needs to dispatch the timeout message.

                this.consumed= true;
                return true;
            }

            return false;
        }
    };

    /**
     * @memberOf FSM
     *
     * @class FSMContext
     * @classdesc
     *
     * FSMContext is the core of the Automata engine. It server as Finite State Machines registry, timer task
     * manager, FSM session creation, etc.
     * It is intended to be a unique object of this type.
     *
     * @constructor
     *
     */
    FSM.FSMContext= function() {

        /**
         * Array of pending timer tasks.
         * @name timerTask
         * @memberOf FSMContext.prototype
         * @type {Array<FSM.TimerTask>}
         */
        this.timerTasks=    [];

        /**
         * Registry of State machines.
         * From each entry a FSM session object can be built.
         *
         * @name registry
         * @memberOf FSMContext.prototype
         * @type {map<string, FSM.FSM>}
         */
        this.registry=      {};

        /**
         * This timer is used to check all the TimerTask timeouts.
         * @name timerId
         * @memberOf FSMContext.prototype
         * @type {number}
         */
        this.timerId=       root.setInterval( this.__checkTimers.bind(this), TIMER_CHECK_RESOLUTION );

        return this;
    };

    /**
     * @lend FSM.FSMContext.prototype
     */
    FSM.FSMContext.prototype= {

        /**
         * Check every FSM running session pending timer tasks.
         * @private
         */
        __checkTimers : function() {

            var time= new Date().getTime();

            for( var i=0; i < this.timerTasks.length; i++ ) {
                var timerTask= this.timerTasks[i];
                if ( timerTask.consume( time ) ) {
                    this.timerTasks.splice( i,1 );
                }
            }
        },

        /**
         * Initialize Automata's engine.
         * @deprecated
         */
        initialize : function() {
            return this;
        },

        /**
         * Shutdown Automata's engine.
         * Pending timer tasks won't be notified.
         */
        destroy : function() {
            root.clearInterval( this.timerId );
        },

        /**
         * Register a new FSM.
         * This is the first step to have a running FSM session in Automata engine.
         *
         * @param name {string} a FSM name.
         * @param fsm {FSM.FSM} an FSM object instance.
         */
        registerFSM : function( name, fsm ) {
            if ( this.registry[name] ) {
                throw "'"+name+"' FSM already registered.";
            }

            this.registry[ name ]= fsm;
        },

        /**
         * Get a FSM.FSM registered instance.
         *
         * @param name {string} get a FSM.FSM previously registered object.
         */
        getFSM : function( name ) {
            return this.registry[ name ];
        },

        /**
         * Create a given FSM session.
         *
         * @param sessionData {FSM.SessionCreationData}
         *
         * @return {FSM.Session} an initialized session object.
         */
        createSession : function( sessionData  ) {

            var automata= sessionData.fda;
            var fsm= this.registry[ automata ];
            if ( typeof fsm==="undefined" ) {
                throw "FSM "+automata+" does not exist.";
            }

            return fsm.createSession(sessionData.controller);
        },

        /**
         * Add a new Timer Task.
         * A timer task means sending a message to a given FSM session after elapsing some time.
         * It is automatically managed by onTimer block definition.
         *
         * Should not be called directly.
         *
         * @param session {FSM.Session} a session object
         * @param event {FSM.TransitionMessage} a message object
         * @param time {number} an integer indicating milliseconds.
         *
         * @return {number} a unique timertask id.
         */
        addTimerTask : function( session, event, time ) {
            var ttask= new FSM.TimerTask( session, event, time );
            this.timerTasks.push( ttask );
            return ttask.getId();
        },

        /**
         * Remove a previously set timer task.
         * It is automatically managed by onTimer block definition.
         *
         * Should not be called directly.
         *
         * @param id {number} removes a timertask created by calling addTimerTask.
         */
        removeTimerTask : function( id ) {
            for( var i=0; i<this.timerTasks.length; i++ ) {
                if ( this.timerTasks[i].id===id ) {
                    this.timerTasks.splice( i, 1 );
                    return true;
                }
            }

            return false;
        }
    };

    /**
     * @memberOf FSM
     *
     * @class GuardException
     * @classdesc
     *
     * An Automata specific exception raised when a guard fails.
     *
     * @param msg {string}
     *
     * @return {FSM.GuardException}
     * @constructor
     */
    FSM.GuardException= function(msg) {

        /**
         * @name msg
         * @memberOf GuardException.prototype
         * @type {string}
         */
        this.msg = msg;

        return this;
    };

    /**
     * @lend FSM.GuardException.prototype
     */
    FSM.GuardException.prototype= {

        toString : function() {
            return this.msg.toString();
        }
    };

    /**
     * @memberOf FSM
     *
     * @class Transition
     * @classdesc
     *
     * An Automata framework transition.
     * This class is private and should not be used directly.
     * Any given Transition which belongs to a FSM object is a unique instance.
     *
     * @param event {string}
     * @param initialState {FSM.State}
     * @param finalState {FSM.State}
     *
     * @constructor
     */
    FSM.Transition= function( event, initialState, finalState ) {

        /**
         * An string identifying an event this transition will be fired by.
         * @name event
         * @memberOf Transition.prototype
         * @type string
         */
        this.event=         event;

        /**
         * Transition initial State.
         * @name initialState
         * @memberOf FSM.Transition.prototype
         * @type {FSM.State}
         */
        this.initialState=  initialState;

        /**
         * Transition final State.
         * @name finalState
         * @memberOf Transition.prototype
         * @type FSM.State
         */
        this.finalState=    finalState;

        /**
         * On transition action. Fired when the FSM changes state.
         * If it is a string, the system will find and call a session method with this name.
         * If a function, it will be invoked.
         *
         * @name onTransition
         * @memberOf Transition.prototype
         * @type {string|TransitionCallback}
         */
        this.onTransition=  null;

        /**
         * On pre guard action. Fired when the transition pre-guard fails.
         * If it is a string, the system will find and call a session method with this name.
         * If a function, it will be invoked.
         *
         * @name onPreGuard
         * @memberOf Transition.prototype
         * @type {string|TransitionCallback}
         */
        this.onPreGuard=    null;

        /**
         * On post guard action. Fired when the transition post-guard fails.
         * If it is a string, the system will find and call a session method with this name.
         * If a function, it will be invoked.
         *
         * @name onPreGuard
         * @memberOf Transition.prototype
         * @type {string|TransitionCallback}
         */
        this.onPostGuard=   null;

        if ( this.initialState ) {
            this.initialState.addTransition(this);
        }

        return this;
    };

    /**
     * @lend FSM.Transition.prototype
     */
    FSM.Transition.prototype= {

        getStartState : function() {
            return this.initialState;
        },

        /**
         * @return {string} transition's firing event.
         */
        getEvent : function() {
            return this.event;
        },

        /**
         * Set this transition's pre guard function or function name form the controller object.
         *
         * @param m {TransitionCallback|string}
         */
        setOnPreGuard : function( m ) {
            this.onPreGuard= m;
            return this;
        },

        /**
         * Create a GuardException.
         * @param msg {string}
         */
        createThrowable : function( msg ) {
            throw new FSM.GuardException(msg);
        },

        /**
         * Set this transition's post guard function or function name form the controller object.
         *
         * @param m {TransitionCallback|string}
         */
        setOnPostGuard : function( m ) {
            this.onPostGuard= m;
            return this;
        },

        /**
         * Set this transition's callback function executed when the transition is fired.
         * @param m {TransitionCallback|string}
         */
        setOnTransition : function( m ) {
            this.onTransition= m;
            return this;
        },

        /**
         * Do this transition's pre-transition code
         * @param msg {FSM.TransitionMessage}
         * @param session {FSM.Session}
         */
        firePreTransition : function( msg, session) {
            if ( this.initialState!=null ) {
                this.initialState.callOnExit( session, this, msg );
            }

            if ( this.onTransition ) {
                session.callMethod(this.onTransition, this.initialState, this, msg);
            }
        },

        /**
         * Do this transition's post-transition code
         * @param msg {FSM.TransitionMessage}
         * @param session {FSM.Session}
         */
        firePostTransition : function( msg, session) {
            this.finalState.callOnEnter( session, this, msg );
        },

        /**
         * Do this transition's pre-transition code. Though it may seem equal to firePreTransition it is handled
         * in another function because an exception could be throws. In such case a pre-guard is assumed to have
         * been fired.
         * @param msg {FSM.TransitionMessage}
         * @param session {FSM.Session}
         */
        firePreTransitionGuardedByPostCondition : function( msg, session ) {
            if ( this.initialState!=null ) {
                this.initialState.callOnExit( session, this, msg );
            }

            if ( this.onTransition ) {
                session.callMethod(this.onTransition, this.initialState, this, msg);
            }
        },

        /**
         * Do this transition's post-transition code. Though it may seem equal to firePreTransition it is handled
         * in another function because an exception could be throws. In such case a pre-guard is assumed to have
         * been fired.
         * @param msg {FSM.TransitionMessage}
         * @param session {FSM.Session}
         */
        firePostTransitionGuardedByPostCondition : function( msg, session ) {
            if ( this.initialState!=null ) {
                session.callMethod( this.initialState.onEnter, this.initialState, this, msg );
            }
        },

        /**
         * Fire pre-Guard code.
         * If the method throws an exception, this transition is aborted as if it hadn't been fired.
         * @param msg {FSM.TransitionMessage}
         * @param session {FSM.Session}
         */
        checkGuardPreCondition : function( msg, session ) {
            session.callMethod( this.onPreGuard, this.initialState, this, msg );
        },

        /**
         * Fire post-Guard code.
         * If the method throws an exception, this transition is vetoed, and it will issue an auto-transition instead
         * of a state-to-state transition.
         * @param msg {FSM.TransitionMessage}
         * @param session {FSM.Session}
         */
        checkGuardPostCondition : function( msg, session ) {
            session.callMethod( this.onPostGuard, this.initialState, this, msg );
        },

        /**
         * Notify observers about this transition fire event.
         *
         * @param msg {FSM.TransitionMessage} the message which fired this transition
         * @param session {FSM.Session}
         *
         * @private
         */
        fireTransition : function( msg, session ) {
            if ( this.initialState!==null ) {
                this.initialState.callOnExit( session, this, msg );
            }

            if ( this.onTransition ) {
                session.callMethod(this.onTransition, this.initialState, this, msg);
            }

            this.finalState.callOnEnter( session, this, msg );
        },

        toString : function() {
            return ""+this.event;
        }
    };

    /**
     * @memberOf FSM
     * @class State
     * @classdesc
     *
     * This object defines a FSM state. There's a finite number of states, and each session can only be in one such
     * State at the same time.
     *
     * @param name {string} state's name.
     *
     * @constructor
     */
    FSM.State= function( name ) {

        /**
         * Exiting transitions from this State.
         *
         * @type {map<string,FSM.Transition>}
         * @memberOf State.prototype
         * @name exitTransitions
         */
        this.exitTransitions=       {};

        /**
         * Number of exit transitions. Needed to know which State is a final state (no exit transitions).
         * @name exitTransitionsCount
         * @type {number}
         * @memberOf State.prototype
         */
        this.exitTransitionsCount=  0;

        /**
         * State name.
         *
         * @type {string}
         * @memberOf State.prototype
         * @name name
         */
        this.name=                  name || ( "state"+__StateIndex++ );

        /**
         * On State Enter action.
         * @type {string|StateCallback}
         * @name onEnter
         * @memberOf State.prototype
         */
        this.onEnter=               null;

        /**
         * On State Exit action.
         * @type {string|StateCallback}
         * @name onEnter
         * @memberOf State.prototype
         */
        this.onExit=                null;

        /**
         * Described a timed transition to this State.
         * @type {FSM.StateTimeTransitionInfo}
         * @name onTimer
         * @memberOf FSM.State.prototype
         */
        this.onTimer=               null;

        /**
         * Whether this State is a whole FSM substate. (Nested FSM.FSM objects)
         *
         * @type {FSM.FSM}
         * @name subState
         * @memberOf State.prototype
         */
        this.subState=              null;

        return this;
    };

    FSM.State.deserialize = function( obj, parentState ) {

        if ( null==parentState ) {
            return fsmContext.getFSM( obj.name );
        }

        return parentState.getStateByName( obj.name );
    };

    /**
     * @lend FSM.State.prototype
     */
    FSM.State.prototype= {

        serialize : function() {
            return {
                "class" : "State",
                "name"  : this.name
            };
        },

        /**
         * Get this state name.
         * @returns {string}
         */
        getName : function() {
            return this.name;
        },

        /**
         * Add an exit transition to this State instance.
         * This transition must be uniquely added.
         * @param tr {FSM.Transition}
         */
        addTransition : function( tr ) {
            var event= tr.getEvent();

            if ( this.exitTransitions[event] ) {
                throw "Already set transition for event "+event;
            }

            this.exitTransitions[event]= tr;
            this.exitTransitionsCount++;

            return this;
        },

        /**
         * Check whether this state has exiting transitions.
         * If not, will be defined as final.
         *
         * @return bool
         */
        isFinalState : function() {
            return this.exitTransitionsCount===0;
        },

        /**
         * Set this state's onEnter callback function.
         * @param c {string|StateCallback}
         */
        setOnEnter : function( c ) {
            this.onEnter= c;
            return this;
        },

        /**
         * Set this state's onExit callback function.
         * @param c {string|StateCallback}
         */
        setOnExit : function( c ) {
            this.onExit= c;
            return this;
        },

        /**
         * Add a timed transition to this state.
         * @param c {FSM.StateTimeTransitionInfo}
         */
        setOnTimer : function( c ) {
            this.onTimer= c;
        },

        /**
         * Get a transition for the defined typeof message.
         * @param msg {FSM.TransitionMessage}
         */
        getTransitionFor : function( msg ) {
            if (!msg || !msg.msgId ) {
                // WTF ??
                return null;
            }
            return this.exitTransitions[ msg.msgId ];
        },

        /**
         * @private
         */
        __getTimerKey : function( ) {
            return this.name; // + "#" + this.onTimer.event.msgId;
        },

        /**
         * Execute the procedure on entering this State.
         * It may seem to set a timer, and calling the optional onEnter callback function.
         * @param session {FSM.Session}
         * @param transition {FSM.Transition}
         * @param msg {FSM.TransitionMessage}
         */
        callOnEnter : function( session, transition, msg ) {
            if ( this.onTimer ) {
                session.addProperty(
                    this.__getTimerKey( ),
                    fsmContext.addTimerTask( session, this.onTimer.event, this.onTimer.timeout )
                );
            }
            session.callMethod( this.onEnter, this, transition, msg );
        },

        /**
         * Execute the procedure on exiting this State.
         * It may seem to reset a timer, and calling the optional onEnter callback function.
         *
         * @param session {FSM.Session}
         * @param transition {FSM.Transition}
         * @param msg {FSM.TransitionMessage}
         */
        callOnExit : function( session, transition, msg ) {
            if( this.onTimer ) {
                var pr= session.getProperty( this.__getTimerKey() );
                fsmContext.removeTimerTask( pr );
                session.removeProperty(pr);
            }
            session.callMethod( this.onExit, this, transition, msg );
        },

        toString : function() {
            return ""+this.name;
        }

    };

    /**
     * @memberOf FSM
     * @class FSM
     * @extends FSM.State
     *
     * @classdesc
     *
     * FSM defines a complete finite state machine.
     * A FSM.FSM object extends a FSM.State object, so polymorphically a complete FSM is an State. This way, we can
     * supply with sub-states to Automata's engine.
     *
     * There's just one instance for each FSM object. From FSM, sessions are created, which keep track of current
     * state and session context data. The session context data is created by invoking the constructor function
     * supplied as parameter.
     *
     * @constructor
     * @param name {string} FSM name
     *
     */
    FSM.FSM= function( name ) {

        FSM.FSM.superclass.constructor.call(this, name);

        /**
         * @name onEnter
         * @type {string|StateCallback}
         * @memberOf FSM.prototype
         */
        this.onEnter=              this.getName()+"_enter";

        /**
         * @name onExit
         * @type {string|StateCallback}
         * @memberOf FSM.prototype
         */
        this.onExit=              this.getName()+"_exit";

        /**
         * Defines the FDA's initial state.
         *
         * @memberOf FSM.prototype
         * @name initialState
         * @type {FSM.State}
         */
        this.initialState=          null;

        /**
         * FSM declarative description.
         * @type {FSM.FSMState[]}
         */
        this.states =        null;

        return this;
    };

    /**
     * @lend FSM.FSM.prototype
     */
    FSM.FSM.prototype= {

        getStateByName : function( n ) {

            var s= this.states[n];
            return s ? s : null;
        },

        /**
         * Initialize a Finite State Machine.
         * Create the initial transition to the supplied state.
         * A FSM is a single State reached by calling the initial transition. This state drills down to the
         * FSM definition.
         *
         * @param initialState {FSM.State}
         */
        initialize : function( initialState ) {
            this.initialState= initialState;
        },

        /**
         * Override State callOnEnter.
         * When a substate is entered, its onEnter action is called and then, substate's initial state's onEnter action.
         *
         * @param session {FSM.Session}
         * @param transition {FSM.Transition}
         * @param msg {FSM.TransitionMessage}
         */
        callOnEnter : function( session, transition, msg ) {
            FSM.FSM.superclass.callOnEnter.call( this, session, transition, msg );
            session.consume( {
                msgId : __InitialTransitionId
            });

        },

        /**
         * Build a Session for this FSM object.
         * A session is (of course) initially empty.
         * This method is called only once, and from this on, sub-state automata go on with the normal lifecycle
         * calling their custom onEnter method which launcher the initialTransition.
         * Strictly talking, automata object should be constructed from a building block where just an FSM defined
         * just one state being a substate of the target FSM.
         *
         * To avoid such automata definition inefficiencies, here I'm calling the block manually:
         *   + pushing a top level FSM context
         *   + calling its onEnter method as if an initialTransition was fired.
         *
         * I'm not happy with the semantics of manually calling a (supposed to be) initial transition. Will keep it
         * this way for the sake of simplicity, but will probably change this semantics in the future,
         * (by adding an Automata with just one substate) which could cause backward incompatibilities.
         *
         * @param sessionController {object} session factory initialization parameters.
         */
        createSession : function(sessionController ) {
            return new FSM.Session(this, sessionController );
        },

        /**
         *
         * @param session {FSM.Session}
         * @param callback {ConsumeCallback}
         * @returns {FSM.Session}
         */
        startSession : function( session, callback ) {
            session.push(this);
            FSM.FSM.superclass.callOnEnter.call( this, session, null, null );
            session.consume( {
                msgId : __InitialTransitionId
            }, callback);

            return session;
        }
    };

    extend( FSM.FSM, FSM.State );


    /**
     * @memberOf FSM
     *
     * @class SessionContext
     * @classdesc
     *
     * A session context is just a holder for a current state across the different nesting levels of an FSM.
     * This class is some sugar to deal with an State.
     * A FSM.Session is an stack of different contexts.
     *
     * @param state {FSM.State}
     *
     * @constructor
     */
    FSM.SessionContext= function( state ) {

        /**
         * Current context state.
         *
         * @name currentState
         * @type {FSM.State}
         * @memberOf SessionContext.prototype
         */
        this.currentState= state;

        return this;
    };

    /**
     *
     * @param obj {object}
     * @param parentFDA {FSM.State}
     */
    FSM.SessionContext.deserialize= function( obj, parentFDA ) {

        if ( obj && obj["class"] && obj["class"]==="SessionContext" ) {
            var s= FSM.State.deserialize( obj.state, parentFDA );
            if ( s ) {
                return new FSM.SessionContext(s);
            }

            throw "Unknown state '"+obj.state.name+"' in FDA "+parentFDA.getName();
        }

        throw "SessionContext invalid data.";
    };

    /**
     * @lend FSM.SessionContext.prototype
     */
    FSM.SessionContext.prototype= {

        /**
         * Set this context current state.
         * This method will be called by Automata's engine when a state change is fired.
         * @param s {FSM.State}
         */
        setCurrentState : function( s ) {
            this.currentState= s;
        },

        /**
         * Get this context's current state.
         * @return {FSM.State}
         */
        getState : function() {
            return this.currentState;
        },

        /**
         * Get an exiting transition defined by this message for the current State.
         * @param msg {FSM.TransitionMessage}
         */
        getTransitionFor : function( msg ) {
            return this.currentState.getTransitionFor( msg );
        },

        /**
         * Call this current State onExit callback function.
         * @param session {FSM.Session}
         * @param transition {FSM.Transition}
         * @param msg {FSM.TransitionMessage}
         */
        exit : function( session, transition, msg) {
            this.currentState.callOnExit(session, transition, msg);
        },

        /**
         * Print this context current state info.
         */
        printStackTrace : function() {
            FSM.Log.d("  "+this.currentState.getName());
        },

        serialize : function() {
            return {
                "class" : "SessionContext",
                "state" : this.currentState.serialize()
            }
        }
    };

    /**
     * @class Log
     * @memberOf FSM
     *
     * logging facilities.
     * There are 3 log levels: DEBUG, INFO, ERROR.
     * Errors are hierarchically solved. DEBUG level will print all three types of log messages,
     * INFO level only INFO and ERROR messages while ERROR just ERROR messages.
     *
     */
    FSM.Log = {

        __logLevel : 0,

        /**
         * A constant to define DEBUG log level.
         *
         * @name DEBUG
         * @memberOf Log
         * @type {number}
         */
        DEBUG : 0,

        /**
         * A constant to define INFO log level.
         *
         * @name INFO
         * @memberOf Log
         * @type {number}
         */
        INFO : 1,

        /**
         * A constant to define ERROR log level.
         *
         * @name ERROR
         * @memberOf Log
         * @type {number}
         */
        ERROR : 2,

        /**
         * Set execution log level.
         * @param l {FSM.Log.DEBUG | FSM.Log.INFO | FSM.Log.ERROR}
         */
        setLogLevel : function( l ) {
            this.__logLevel= l;
        },

        /**
         * Print a debug message if the current log level allows for it.
         * @param str {string}
         */
        d : function( str ) {
            if ( this.__logLevel<=this.DEBUG ) {
                console.log("DEBUG: " + str);
            }
        },

        /**
         * Print a info message if the current log level allows for it.
         * @param str {string}
         */
        i : function( str ) {
            if ( this.__logLevel<=this.INFO ) {
                console.log("INFO: " + str);
            }
        },

        /**
         * Print an error message if the current log level allows for it.
         * @param str {string}
         */
        e : function( str ) {
            if ( this.__logLevel<=this.ERROR ) {
                console.log("ERROR: " + str);
            }
        }
    };

    /**
     * @memberOf FSM
     *
     * @class Session
     * @classdesc
     *
     * A Session is the real artifact to deal with the Automata engine.
     * A session must be created for an FSM and will the core object to send messages to.
     * Automata framework will take care choreographing calls, context push/pop, session observer notification, etc.
     *
     * @constructor
     *
     * @param fsm {FSM.FSM} a FDA.
     * @param controller {object} an object coming from the FSM session factory object.
     */
    FSM.Session= function( fsm, controller ) {

        /**
         * FSM.FSM instance this sessio belongs to.
         * @name _fda
         * @memberOf FSM.Session.prototype
         * @type {FSM.FSM}
         * @private
         */
        this._fda=                  fsm;

        /**
         * Each sub-state accessed during the FSM execution will generated a new context object.
         * This is the stack-trace of the different sub-states a FSM currently is in.
         * @type {Array.<FSM.SessionContext>}
         * @name sessionContextList
         * @memberOf Session.prototype
         */
        this.sessionContextList=    [];

        /**
         * A collection of session listener objects.
         * A session listener exposes all information for activity, from creating context objects to setting properties,
         * etc.
         *
         * @name sessionListeners
         * @memberOf Session.prototype
         * @type {Array.<FSM.SessionListener>}
         */
        this.sessionListener=       [];

        /**
         * A map of key/value pairs.
         * The only imposed property from the engine will be the FSM name itself, and will store the timed
         * auto-transition timer ids.
         * This is a general purpose map holder, use wisely.
         *
         * @name properties
         * @memberOf Session.prototype
         * @type {map<string,object>}
         */
        this.properties=            {};

        /**
         * Session data. An object created form the FSM factory constructor function.
         *
         * @name controller
         * @memberOf Session.prototype
         * @type {object} an object returned from the FSM factory constructor.
         */
        this.controller=            controller;

        /**
         * When a message is sent to a session, that message consumtion may fire new messages sent to the session.
         * These messages are not consumed immediately.
         *
         * @name messages
         * @memberOf Session.prototype
         * @type {Array.<FSM.SessionMessageQueue>}
         */
        this.messageQueues =        [];

        /**
         * Internal flag used to signal that 'consume' calls are in the context of a 'callMethod'.
         *
         * @name _inCallMethod
         * @memberOf Session.prototype
         * @type {Array.<FSM.SessionMessageQueue>}
         */
        this._inCallMethod =        false;

        /**
         * Internal flag for session state.
         * @name _started
         * @memberOf FSM.Session.prototype
         * @type {boolean}
         * @private
         */
        this._started =             false;

        return this;
    };

    /**
     * @class SessionMessageQueue
     * @memberOf FSM
     * @classdesc
     *
     * This function creates objects to hold messages for a unit of work.
     * The unit of work is a user-made 'consume' method, and all the transitions generated from this call.
     *
     * This is a FIFO queue.
     *
     * @param msg {FSM.TransitionMessage}
     * @param callback {ConsumeCallback}
     * @returns {FSM.SessionMessageQueue}
     *
     * @constructor
     */
    FSM.SessionMessageQueue = function( msg, callback ) {

        /**
         * @name _callback
         * @type {ConsumeCallback}
         * @memberOf SessionMessageQueue.prototype
         * @private
         */
        this._callback = callback;

        /**
         * @name _messageQueue;
         * @type {Array<FSM.MessageCallbackTuple>}
         * @memberOf SessionMessageQueue.prototype
         * @private
         */
        this._messages = [];

        this._userMessage = msg;

        this.push( msg );

        return this;
    };

    /**
     * @lend FSM.SessionMessageQueue.prototype
     */
    FSM.SessionMessageQueue.prototype = {

        isUserMessage : function( msg ) {
            return msg===this._userMessage;
        },

        /**
         *
         * @param message {FSM.TransitionMessage} a valid FSM message. can be null if called from the initial state context.
         * @param callback {ConsumeCallback?}
         */
        push : function( message, callback ) {
            if ( message ) {
                this._messages.push( {
                    message: message,
                    callback: callback
                });
            }
        },

        /**
         * Get the head of messages.
         * @returns {FSM.MessageCallbackTuple}
         */
        shift : function() {
            return this._messages.shift();
        },

        /**
         * Get number of pending messages.
         * @returns {Number}
         */
        getNumMessages : function() {
            return this._messages.length;
        },

        /**
         * Notify this messages queue callback.
         * This happens when the unit of work ends, ie the queue gets empty.
         *
         * @param session {FSM.Session}
         */
        notify : function( session ) {
            if ( this._callback ) {
                this._callback( session );
            }
        }
    };

    /**
     * @param obj
     */
    FSM.Session.deserialize= function( obj, controllerDeserializer ) {

        if ( obj && obj["class"] && obj["class"]==="Session" ) {

            var fsm = fsmContext.getFSM(obj.fda);
            if (!fsm) {
                throw "Unknown FSM '" + obj.fda + "'";
            }
            var s = new FSM.Session(fsm);
            s._started= obj.started;

            s.sessionContextList= [];
            var prevState= null;
            obj.sessionContextList.forEach( function(scdef) {
                var ns= FSM.SessionContext.deserialize( scdef, prevState );
                s.sessionContextList.push( ns );
                prevState= ns.getState();
            });

            s.controller= controllerDeserializer( obj.controller );

            return s;
        }

        throw "Invalid session object definition.";
    };

    /**
     * @lend FSM.Session.prototype
     */
    FSM.Session.prototype= {

        serialize : function() {
            var ret= {
                "class" : "Session",
                "fda" : this._fda.getName(),
                "sessionContextList" : [],
                "started" : this._started,
                "controller" : this.controller.serialize ? this.controller.serialize() : ""
            };

            this.sessionContextList.forEach( function( sc ) {
                ret["sessionContextList"].push( sc.serialize() );
            });

            return ret;
        },

        /**
         * Start a Session object.
         * The session can be started only once.
         * The reason to have a create and start functions, is that you can attach session listeners just after
         * creation, and before it is started. Starting a session may imply state transitions. It is not reasonable
         * to be able to attach observers after the inital transition executes and not before.
         *
         * @param callback {ConsumeCallback=}
         */
        start : function( callback ) {
            if ( this._started ) {
                throw "Session is already started.";
            }

            this._started= true;

            this._fda.startSession( this, callback );
        },

        /**
         * Never call this method directly.
         * For a given Automata event triggering function (state.onEnter, state.onExit, transition.onPre/PostGuard,
         * transition.onTransition), this method makes the appropriate call, either to the controller object, or to
         * the supplied callback function instead.
         * This method also sets an internal flag (_inCallMethod) which indicates that `session.consume` calls happening
         * inside a called method must not creat a message bucket, but queue messages in the current message bucket.
         */
        callMethod : function( /* method, argument1, ... */ ) {


            var args = Array.prototype.slice.call(arguments);
            var method = args.shift();

            if (null === method) {  // just in case.
                return;
            }

            args.splice(0, 0, this);

            this._inCallMethod = true;

            if (typeof method === "function") {
                method.apply(this.controller, args);
            } else {
                if ( this.controller ) {

                    if (this.controller && typeof this.controller[method] !== "undefined") {
                        this.controller[method].apply(this.controller, args);
                    } else {
                        // no method with given name on session object data.
                    }

                }
            }

            this._inCallMethod= false;
        },

        /**
         * Add an observer to this session.
         * @param sl {FSM.SessionListener}
         */
        addListener : function( sl ) {
            this.sessionListener.push( sl );
        },

        /**
         * Remove an observer from this session.
         * @param sl {FSM.SessionListener}
         */
        removeListener : function( sl ) {
            var pos= this.sessionListener.indexOf( sl );
            if ( -1!==pos ) {
                this.sessionListener.splice( pos, 1 );
            }
        },

        /**
         * Push and set up a new FSM.Context level.
         * The state must be an state from the FSM object this session belongs to.
         *
         * @param state {FSM.State}
         *
         */
        push : function( state ) {
            var sc= new FSM.SessionContext( state );

            this.sessionContextList.push( sc );
            this.fireContextCreated( sc );
            this.fireStateChanged( sc, null, state, {msgId : __InitialTransitionId} );
        },

        /**
         * Pop and reset the last FSM.Context object level.
         *
         * @param transition {FSM.Transition} the firing transition
         * @param msg {FSM.TransitionMessage} the message that triggered the transition
         *
         * @private
         */
        pop : function( transition, msg ) {
            var sc= this.sessionContextList.pop();
            sc.exit( this, transition, msg );

            this.fireContextRemoved( sc );

            if ( this.sessionContextList.length===0 ) {
                this.fireSessionEmpty();
            }
        },

        /**
         * Asynchronously consume a message.
         * @param msg {FSM.TransitionMessage}
         * @param endCallback  {ConsumeCallback?}
         */
        consume : function( msg, endCallback ) {

            if ( msg.msgId===__InitialTransitionId ) {
                this.push( this.getCurrentState().initialState );
                this.messageQueues.push( new FSM.SessionMessageQueue(null, endCallback) );
                this.getCurrentState().callOnEnter( this, null, msg );
            } else {

                // calling consume from a method call, not a user generated consume call.
                if ( this._inCallMethod ) {
                    this.messageQueues[0].push( msg, endCallback );
                } else {
                    this.messageQueues.push( new FSM.SessionMessageQueue( msg, endCallback ) );
                }
            }

            this.__doConsume();
        },

        __doConsume : function() {
            setTimeout(this.__processMessages.bind(this), 0);
        },

        isEmpty : function() {
            return this.sessionContextList.length===0
        },

        /**
         * Consume a message.
         * A message consumption may imply more messages to be consumed. The callback will be invoked
         * when no more messages are available to be processed.
         */
        __processMessages : function( ) {

            if ( this.messageQueues.length===0 ) {
                return;
            }

            if ( this.isEmpty() ) {
                throw "Empty Session";
            }

            var queue= this.messageQueues[0];
            // trivial exit
            if ( queue.getNumMessages()===0 ) {

                this.messageQueues.shift();
                queue.notify( this );
                if ( this.messageQueues.length>0 ) {
                    this.__doConsume();
                }
                // sanity clear
                this._inCallMethod= false;
                return;
            }

            /**
             * remove first message
             * @type FSM.MessageCallbackTuple
             */
            var pair= queue.shift();

            /**
             * @type {FSM.TransitionMessage}
             */
            var msg= pair.message;

            /**
             * @type {ConsumeCallback}
             */
            var callback= pair.callback;

            var firingTransition= null; // FSM.Transition
            var target=           null; // FSM.SessionContext
            var i;
            for( i= this.sessionContextList.length - 1; i>=0; i-- ) {
                target=             this.sessionContextList[i];
                firingTransition=   target.getTransitionFor( msg );
                if ( null!=firingTransition ) {
                    break;
                }
            }

            if ( !firingTransition ) {
                FSM.Log.e( "No transition on state "+this.getCurrentState().name+" for message "+msg.msgId );
                if ( callback ) {
                    callback(this);
                }
                this.__doConsume();
                return;
            }

            // check guard pre condition.
            try {
                firingTransition.checkGuardPreCondition( msg, this );
            } catch( e ) {
                if ( e instanceof FSM.GuardException ) {
                    FSM.Log.i(e.toString());
                    this.fireGuardPreCondition(firingTransition, msg, e);
                    if ( callback ) {
                        callback(this);
                    }
                    this.__doConsume();
                    return; // fails on pre-guard. simply return.
                } else {
                    FSM.Log.e("An error ocurred: "+ e.message);
                    this.printStackTrace();
                }
            }

            try {
                firingTransition.checkGuardPostCondition( msg, this );

                try {
                    for( var j= this.sessionContextList.length-1; j>i; j-- ) {
                        this.pop( firingTransition, msg );
                    }

                    firingTransition.firePreTransition( msg, this );

                        var currentState= this.getCurrentState();
                        var newState= firingTransition.finalState;
                        target.setCurrentState( newState );
                        this.fireStateChanged( target, currentState, newState, msg );

                    firingTransition.firePostTransition( msg, this );

                    while(
                        this.sessionContextList.length!==0 &&
                        this.getCurrentSessionContext().getState().isFinalState() ) {

                        this.pop( null, msg );
                    }
                } catch( ex ) {
                    FSM.Log.e("An error ocurred: "+ ex.message);
                    this.printStackTrace();
                }
            } catch( guardException ) {
                if ( guardException instanceof FSM.GuardException ) {
                    FSM.Log.i(guardException.toString());
                    this.fireGuardPostCondition(firingTransition, msg, guardException);
                    firingTransition.firePreTransitionGuardedByPostCondition( msg, this );
                        this.fireStateChanged( target, this.getCurrentState(), firingTransition.initialState, msg );
                    firingTransition.firePostTransitionGuardedByPostCondition( msg, this );
                } else {
                    FSM.Log.e("An error ocurred: "+ guardException.toString());
                    this.printStackTrace();
                }
            }

            if ( callback ) {
                callback(this);
            }

            if ( this.isEmpty() ) {
                var sess= this;
                // the session is empty.
                // notify main callback only.
                this.messageQueues.forEach( function(mq) {
                    mq.notify(sess);
                });
                this.messageQueues= [];
            }

            if ( this.messageQueues.length>0 ) {
                this.__doConsume();
            }

        },

        /**
         * Get the current execution context.
         *
         * @return FSM.SessionContext current session context.
         */
        getCurrentSessionContext : function() {
            return this.sessionContextList[ this.sessionContextList.length-1 ];
        },

        /**
         * Get current context's state.
         *
         * @return {FSM.State} current state.
         */
        getCurrentState : function() {
            try {
                return this.getCurrentSessionContext().getState();
            } catch( e ) {
                return null;
            }
        },

        /**
         * Print information about the context stack state.
         * For each stacked context, its current state and information will be printed.
         */
        printStackTrace : function() {
            if ( this.sessionContextList.length===0 ) {
                FSM.Log.d("session empty");
            } else {
                FSM.Log.d("session stack trace:");
                for( var i=0; i<this.sessionContextList.length; i++ ) {
                    this.sessionContextList[i].printStackTrace();
                }
            }
        },

        /**
         * Add a property. Used as a holder for onTimer information, as well as any user-defined per-session information.
         *
         * @param key {string}
         * @param value {object}
         */
        addProperty : function( key, value ) {
            this.properties[key]= value;
        },

        /**
         * Remove a property. The property will be nulled in the properties collection.
         *
         * @param key {string}
         */
        removeProperty : function( key ) {
            this.addProperty( key, null );
        },

        /**
         * Get a property value. if it does not exist, undefined will be returned.
         * Properties can exist with null values.
         *
         * @param key {string} property to get value.
         *
         * @return {object}
         */
        getProperty : function( key ) {
            return this.properties[key];
        },

        /////////////// firing methods //////////////

        fireSessionEmpty : function() {
            for( var i=0; i<this.sessionListener.length; i++ ) {
                this.sessionListener[i].finalStateReached( {
                    session: this
                });
            }
        },

        /**
         *
         * @param sessionContext {FSM.SessionContext}
         */
        fireContextCreated : function( sessionContext ) {
            for( var i=0; i<this.sessionListener.length; i++ ) {
                this.sessionListener[i].contextCreated( {
                    session: this,
                    context: sessionContext
                });
            }
        },

        /**
         *
         * @param sessionContext {FSM.SessionContext}
         */
        fireContextRemoved : function( sessionContext ) {
            for( var i=0; i<this.sessionListener.length; i++ ) {
                this.sessionListener[i].contextDestroyed( {
                    session: this,
                    context: sessionContext
                });
            }
        },

        /**
         *
         * @param sessionContext {FSM.SessionContext}
         * @param fromState {FSM.State}
         * @param newState {FSM.State}
         * @param msg {FSM.TransitionMessage}
         */
        fireStateChanged : function( sessionContext, fromState, newState, msg ) {

            // FDA, dont have message queues.
            var ium= this.messageQueues.length && this.messageQueues[0].isUserMessage(msg);

            for( var i=0; i<this.sessionListener.length; i++ ) {
                this.sessionListener[i].stateChanged( {
                    session         :   this,
                    context         :   sessionContext,
                    prevState       :   fromState,
                    state           :   newState,
                    message         :   msg,
                    isUserMessage   :  ium
                });
            }
        },

        /**
         *
         * @param firingTransition {FSM.Transition}
         * @param msg {FSM.TransitionMessage}
         * @param guardException {FSM.GuardException}
         */
        fireGuardPreCondition : function( firingTransition, msg, guardException ) {
            for( var i=0; i<this.sessionListener.length; i++ ) {
                this.sessionListener[i].guardPreCondition( {
                    session     : this,
                    transition  : firingTransition,
                    message     : msg,
                    exception   : guardException.toString()
                });
            }
        },

        /**
         *
         * @param firingTransition {FSM.Transition}
         * @param msg {FSM.TransitionMessage}
         * @param guardException {FSM.GuardException}
         */
        fireGuardPostCondition : function( firingTransition, msg, guardException ) {
            for( var i=0; i<this.sessionListener.length; i++ ) {
                this.sessionListener[i].guardPostCondition( {
                    session     : this,
                    transition  : firingTransition,
                    message     : msg,
                    exception   : guardException.toString()
                });
            }
        },

        /**
         *
         * @param obj {Object}
         */
        fireCustomEvent : function( obj ) {
            for( var i=0; i<this.sessionListener.length; i++ ) {
                this.sessionListener[i].customEvent( {
                    session: this,
                    data: obj
                });
            }
        }
    };

    /**
     * @memberOf FSM
     *
     * @class SessionListener
     * @classdesc
     *
     * A template object to set a session object observer.
     *
     * @constructor
     */
    FSM.SessionListener= function() {
        return this;
    };

    /**
     * @lend FSM.SessionListener.prototype
     */
    FSM.SessionListener.prototype= {

        /**
         * @param obj {FSM.SessionContextEvent}
         */
        contextCreated      : function( obj ) {},

        /**
         * @param obj {FSM.SessionContextEvent}
         */
        contextDestroyed    : function( obj ) {},

        /**
         * @param obj {FSM.SessionFinalStateReachedEvent}
         */
        finalStateReached   : function( obj ) {},

        /**
         *
         * @param obj {FSM.SessionStateChangeEvent}
         */
        stateChanged        : function( obj ) {},

        /**
         *
         * @param obj {FSM.SessionCustomEvent}
         */
        customEvent         : function( obj ) {},

        /**
         *
         * @param obj {FSM.TransitionGuardEvent}
         */
        guardPreCondition   : function( obj ) {},

        /**
         *
         * @param obj {FSM.TransitionGuardEvent}
         */
        guardPostCondition  : function( obj ) {},

        /**
         *
         * @param obj {FSM.SessionStateChangeEvent}
         */
        userStateChange : function( obj ) {}
    };

    /**
     * Create and initalize a fsmContext object.
     * This is the initial source of interaction with Automata engine.
     *
     * @type FSM.FSM
     */
    fsmContext= new FSM.FSMContext();

    /**
     * Register a FSM in Automata engine.
     * @param fsmd {FSMDefinition} A FSM object definition.
     */
    function registerFSM( fsmd ) {
        var fsm= new FSM.FSM( fsmd.name );

        var i;

        /**
         * @type {Array<FSMDefinitionState|FSMDefinitionSubState>}
         */
        var states_a= fsmd.state;
        var states= {};
        var initial_state= null;
        for( i=0; i<states_a.length; i++ ) {
            var state_def= states_a[i];
            var state;

            if ( state_def.subState ) {
                state= fsmContext.getFSM( state_def.subState );
            } else {

                state= new FSM.State( state_def.name );

                if ( state_def.initial ) {
                    if ( initial_state ) {
                        throw "More than one initial state set.";
                    }
                    initial_state= state;
                }

                if ( state_def.onEnter ) {
                    state.setOnEnter( state_def.onEnter );
                } else {
                    state.setOnEnter( state_def.name+"_enter" );
                }

                if ( state_def.onExit ) {
                    state.setOnExit( state_def.onExit );
                } else {
                    state.setOnExit( state_def.name+"_exit" );
                }

                if ( state_def.onTimer ) {
                    state.setOnTimer( state_def.onTimer );
                }
            }

            states[ state.name ]= state;
        }

        if ( null===initial_state ) {
            throw "No initial state defined.";
        }

        /**
         *
         * @type {Array<FSMDefinitionTransition>}
         */
        var transitions_a= fsmd.transition;
        for( i=0; i<transitions_a.length; i++ ) {
            var transition_def= transitions_a[i];

            var event=  transition_def.event;
            var sfrom=  transition_def.from;
            var from=   states[ sfrom ];
            var sto=    transition_def.to;
            var to=     states[ sto ];

            if ( typeof from==="undefined" ) {
                throw "Transition "+event+" no from state: "+sfrom;
            }
            if ( typeof to==="undefined" ) {
                throw "Transition "+event+" no to state: "+sto;
            }

            var transition= new FSM.Transition(
                event,
                from,
                to
            );

            if ( transition_def.onTransition ) {
                transition.setOnTransition( transition_def.onTransition );
            } else {
                transition.setOnTransition( transition_def.event+"_transition" );
            }

            if ( transition_def.onPreGuard ) {
                transition.setOnPreGuard( transition_def.onPreGuard );
            } else {
                transition.setOnPreGuard( transition_def.event+"_preGuard" );
            }

            if ( transition_def.onPostGuard ) {
                transition.setOnPostGuard( transition_def.onPostGuard );
            } else {
                transition.setOnPostGuard( transition_def.event+"_postGuard" );
            }

        }

        if ( fsmd.onExit ) {
            fsm.setOnExit( fsmd.onExit );
        }

        if ( fsmd.onEnter ) {
            fsm.setOnEnter( fsmd.onEnter );
        }

        fsm.initialize( initial_state );
        fsmContext.registerFSM( fsm.name, fsm );

        fsm.states = states;
    }

    /**
     * Create a given FSM session.
     *
     * @param data {FSM.SessionCreationData}
     */
    function createSession( data ) {
        return fsmContext.createSession( data );
    }

    function guardException( str ) {
        return new FSM.GuardException(str);
    }

    function newSessionListener( obj ) {
        var s= new FSM.SessionListener();
        for( var method in obj ) {
            if ( obj.hasOwnProperty(method) && "function"===typeof obj[method] ) {
                s[method]= obj[method];
            }
        }
        return s;
    }

    /**
     * node module definition.
     */
    var _export= {
        registerFSM         : registerFSM,
        registerFDA         : registerFSM,
        createSession       : createSession,
        newGuardException   : guardException,
        newSessionListener  : newSessionListener,
        deserializeSession  : FSM.Session.deserialize
    };

    if (typeof define!=='undefined' && define.amd) {              // AMD / RequireJS
        define('async', [], function () {
            return _export;
        });

    } else if (typeof module!=='undefined' && module.exports) {     // Node.js
        module.exports= _export;

    } else {
        root.Automata= _export;

    }

    root.exports = root.module.exports = _export;

})( typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {} );
