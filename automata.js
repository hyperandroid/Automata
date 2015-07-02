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
     * @name TransitionCallback
     * @type function
     * @param state {FSM.State}
     * @param transition {FSM.Transition}
     * @param message {object}
     */

    /**
     * @name StateCallback
     * @type function
     * @param state {FSM.State}
     * @param transition {FSM.Transition}
     * @param message {object}
     */

    /**
     * @name StateTimeTransitionInfo
     * @type object
     * @param event {object}
     * @param timeout {number}
     */


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
     * @name FSM
     * @namespace
     *
     * Local module definition.
     */
    var FSM= {};

    /**
     * @memberOf FSM
     *
     * @class FSMTimerTask
     * @classdesc
     *
     * This object encapsulates a task timer.
     * They are automatically defined by setting an onTimer block in a state definition.
     *
     * @constructor
     * @param session <FSM.Session> a session object
     * @param event   <Object> a message object.
     * @param time    <number> an integer specifying milliseconds.
     */
    FSM.TimerTask= function( session, event, time ) {

        /**
         * Session to forward the event to on timeout.
         * @name session
         * @memberOf FSM.TimerTask
         * @type {FSM.Session}
         */
        this.session=       session;

        /**
         * This event will be forwarded to the task session owner when timeout.
         * This is an event to be sent to a transition.
         * @name event
         * @memberOf FSM.TimerTask
         * @type {Object}
         */
        this.event=         event;

        /**
         * Milliseconds to consider this task expired.
         * @name triggerTime
         * @memberOf FSM.TimerTask
         * @type {number}
         */
        this.triggerTime=   time;

        /**
         * TimerTask id.
         * This id is returned whenever a timed-transition is set. Thus, timed events can be cancelled.
         * @name id
         * @memberOf FSM.TimerTask
         * @type {number}
         */
        this.id=            __TimerIndex++;

        /**
         * Cache session's current state. When the task times-out, it is checked whether the session is still in the
         * same state. If so, the timeout event is sent.
         * @name contextState
         * @memberOf FSM.TimerTask
         * @type {FSM.State}
         */
        this.contextState=  session.getCurrentState();

        /**
         * Time when the timer task was created. More or less at scheduleTime + triggerTime the task times out.
         * @mame scheduleTime
         * @memberOf FSM.TimerTask
         * @type {number}
         */
        this.scheduleTime=  new Date().getTime();

        /**
         * Internal flag of timer task validity.
         * @name consumed
         * @memberOf FSM.consumed
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
         * @memberOf FSM.FSMContext
         * @type {Array<FSM.TimerTask>}
         */
        this.timerTasks=    [];

        /**
         * Registry of State machines.
         * From each entry a FSM session object can be built.
         *
         * @name registry
         * @memberOf FSM.FSMContext
         * @type {map<string, FSM.FSM>}
         */
        this.registry=      {};

        /**
         * This timer is used to check all the TimerTask timeouts.
         * @name timerId
         * @memberOf FSM.FSMContext
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
         * @private
         */
        getFSM : function( name ) {
            return this.registry[ name ];
        },

        /**
         * Create a given FSM session.
         * @param fromFSM {string} a FSM name. Must be previously registered by calling registerFSM function.
         * @param args {Array.<*>} an array of parameters passed from context.createSession()
         * @return {FSM.Session} an initialized session object.
         */
        createSession : function( fromFSM, args ) {

            var fsm= this.registry[ fromFSM ];
            if ( typeof fsm==="undefined" ) {
                throw "FSM "+fromFSM+" does not exist.";
            }

            return fsm.createSession(args);
        },

        /**
         * Add a new Timer Task.
         * A timer task means sending a message to a given FSM session after elapsing some time.
         * It is automatically managed by onTimer block definition.
         *
         * Should not be called directly.
         *
         * @param session {FSM.Session} a session object
         * @param event {object} a message object
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
     * @param msg {Object}
     * @returns {FSM.GuardException}
     * @constructor
     */
    FSM.GuardException= function(msg) {
        this.msg= msg;

        this.toString= function() {
            return this.msg.toString();
        };

        return this;
    };

    /**
     * @memberOf FSM
     *
     * @class FSMTransition
     * @classdesc
     *
     * An Automata framework transition.
     * This class is private and should not be used directly.
     * Any given Transition which belongs to a FSM object is a unique instance.
     *
     * @constructor
     */
    FSM.Transition= function( event, initialState, finalState ) {

        /**
         * An string identifying an event this transition will be fired by.
         * @name event
         * @memberOf FSM.Transition
         * @type string
         */
        this.event=         event;

        /**
         * Transition initial State.
         * All transition but the 'inititial transition' have a initial state.
         * @name initialState
         * @memberOf FSM.Transition
         * @type FSM.State
         */
        this.initialState=  initialState;

        /**
         * Transition final State.
         * @name finalState
         * @memberOf FSM.Transition
         * @type FSM.State
         */
        this.finalState=    finalState;

        /**
         * On transition action. Fired when the FSM changes state.
         * If it is a string, the system will find and call a session method with this name.
         * If a function, it will be invoked.
         *
         * @name onTransition
         * @memberOf FSM.Transition
         * @type {string|TransitionCallback}
         */
        this.onTransition=  null;

        /**
         * On pre guard action. Fired when the transition pre-guard fails.
         * If it is a string, the system will find and call a session method with this name.
         * If a function, it will be invoked.
         *
         * @name onPreGuard
         * @memberOf FSM.Transition
         * @type {string|TransitionCallback}
         */
        this.onPreGuard=    null;

        /**
         * On post guard action. Fired when the transition post-guard fails.
         * If it is a string, the system will find and call a session method with this name.
         * If a function, it will be invoked.
         *
         * @name onPreGuard
         * @memberOf FSM.Transition
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


        /**
         * @return {string} transition's firing event.
         */
        getEvent : function() {
            return this.event;
        },

        /**
         * Set this transition's pre guard function or function name form the logic object.
         *
         * @param m {TransitionCallback|string}
         */
        setOnPreGuard : function( m ) {
            this.onPreGuard= m;
            return this;
        },

        /**
         * Create a GuardException.
         * @param msg {object}
         */
        createThrowable : function( msg ) {
            throw new FSM.GuardException(msg);
        },

        /**
         * Set this transition's post guard function or function name form the logic object.
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
         * @param msg {object}
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
         * @param msg {object}
         * @param session {FSM.Session}
         */
        firePostTransition : function( msg, session) {
            this.finalState.callOnEnter( session, this, msg );
        },

        /**
         * Do this transition's pre-transition code. Though it may seem equal to firePreTransition it is handled
         * in another function because an exception could be throws. In such case a pre-guard is assumed to have
         * been fired.
         * @param msg {object}
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
         * @param msg {object}
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
         * @param msg {object}
         * @param session {FSM.Session}
         */
        checkGuardPreCondition : function( msg, session ) {
            session.callMethod( this.onPreGuard, this.initialState, this, msg );
        },

        /**
         * Fire post-Guard code.
         * If the method throws an exception, this transition is vetoed, and it will issue an auto-transition instead
         * of a state-to-state transition.
         * @param msg {object}
         * @param session {FSM.Session}
         */
        checkGuardPostCondition : function( msg, session ) {
            session.callMethod( this.onPostGuard, this.initialState, this, msg );
        },

        /**
         * Notify observers about this transition fire event.
         * @param msg {object} the message which fired this transition
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
     * @class FSMState
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
         * @memberOf FSM.State
         * @name exitTransitions
         */
        this.exitTransitions=       {};

        /**
         * Number of exit transitions. Needed to know which State is a final state (no exit transitions).
         * @name FSM.State.exitTransitionsCount
         * @type {number}
         * @memberOf FSM.State
         */
        this.exitTransitionsCount=  0;

        /**
         * State name.
         *
         * @type {string}
         * @memberOf FSM.State
         * @name name
         */
        this.name=                  name || ( "state"+__StateIndex++ );

        /**
         * On State Enter action.
         * @type {string|StateCallback}
         * @name onEnter
         * @memberOf FSM.State
         */
        this.onEnter=               null;

        /**
         * On State Exit action.
         * @type {string|StateCallback}
         * @name onEnter
         * @memberOf FSM.State
         */
        this.onExit=                null;

        /**
         * Described a timed transition to this State.
         * @type {StateTimeTransitionInfo}
         * @name onTimer
         * @memberOf FSM.State
         */
        this.onTimer=               null;

        /**
         * Whether this State is a whole FSM substate. (Nested FSM.FSM objects)
         *
         * @type {FSM.FSM}
         * @name subState
         * @memberOf FSM.State
         */
        this.subState=              null;

        return this;
    };

    /**
     * @lend FSM.State.prototype
     */
    FSM.State.prototype= {

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
         * @param c {StateTimeTransitionInfo}
         */
        setOnTimer : function( c ) {
            this.onTimer= c;
        },

        /**
         * Get a transition for the defined typeof message.
         * @param msg {string}
         */
        getTransitionFor : function( msg ) {
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
         * @param msg {object}
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
         * @param msg {object}
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
     * @param sessionObjectFactory {Function} object factory
     * @param name {string} FSM name
     *
     */
    FSM.FSM= function( sessionObjectFactory, name ) {

        FSM.FSM.superclass.constructor.call(this, name);

        /**
         * Session factory.
         *
         * @name sessionObjectFactory
         * @memberOf FSM.FSM
         * @type {Function}
         */
        this.sessionObjectFactory=  sessionObjectFactory;

        /**
         * @type {string}
         * @private
         */
        this._onEnter=              this.name+"_enter";

        /**
         * FSM initial transition.
         *
         * @name initialTransition
         * @type {FSM.Transition}
         * @memberOf FSM.FSM
         */
        this.initialTransition=     null;

        return this;
    };

    /**
     * @lend FSM.FSM.prototype
     */
    FSM.FSM.prototype= {


        /**
         * Initialize a Finite State Machine.
         * Create the initial transition to the supplied state.
         * A FSM is a single State reached by calling the initial transition. This state drills down to the
         * FSM definition.
         *
         * @param initialState {FSM.State}
         */
        initialize : function( initialState ) {

            var me= this;

            FSM.FSM.superclass.setOnEnter.call( this, function( session, state, transition, msg ) {
                me.initialTransition.fireTransition( {
                        msgId : __InitialTransitionId
                    },
                    session );
            } );

            this.initialState=                  initialState;
            this.initialTransition=             new FSM.Transition(__InitialTransitionId, null, initialState );
            this.initialTransition.setOnTransition( function( session, state, transition, msg ) {
                session.push( initialState );
            });
        },

        /**
         * Set FSM on enter callback.
         * @param m {string|StateCallback}
         */
        setOnEnter : function( m ) {
            this._onEnter= m;
            return this;
        },

        /**
         * Override State callOnEnter.
         * When a substate is entered, its onEnter action is called and then, substate's initial state's onEnter action.
         *
         * @param session {FSM.Session}
         * @param transition {FSM.Transition}
         * @param msg {object}
         */
        callOnEnter : function( session, transition, msg ) {
            session.callMethod( this._onEnter, this, transition, msg );
            FSM.FSM.superclass.callOnEnter.call( this, session, transition, msg );
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
         * @param args {object} session factory initialization parameters.
         */
        createSession : function(args) {

            if ( !this.sessionObjectFactory ) {
                return null;
            }

            var session= new FSM.Session( new this.sessionObjectFactory(session, args) );
            session.push( this );
            this.callOnEnter( session, null, null );

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
         * @memberOf FSM.SessionContext
         */
        this.currentState= state;

        return this;
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
         * @param msg {object}
         */
        getTransitionFor : function( msg ) {
            return this.currentState.getTransitionFor( msg );
        },

        /**
         * Call this current State onExit callback function.
         * @param session {FSM.Session}
         * @param transition {FSM.Transition}
         * @param msg {object}
         */
        exit : function( session, transition, msg) {
            this.currentState.callOnExit(session, transition, msg);
        },

        /**
         * Print this context current state info.
         */
        printStackTrace : function() {
            FSM.Log.d("  "+this.currentState.name);
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
     * @param logic {object} an object coming from the FSM session factory object.
     */
    FSM.Session= function( logic ) {

        /**
         * Each sub-state accessed during the FSM execution will generated a new context object.
         * This is the stack-trace of the different sub-states a FSM currently is in.
         * @type {Array.<FSM.SessionContext>}
         * @name sessionContextList
         * @memberOf FSM.Session
         */
        this.sessionContextList=    [];

        /**
         * A collection of session listener objects.
         * A session listener exposes all information for activity, from creating context objects to setting properties,
         * etc.
         *
         * @name sessionListeners
         * @memberOf FSM.Session
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
         * @memberOf FSM.Session
         * @type {map<string,object>}
         */
        this.properties=            {};

        /**
         * Session data. An object created form the FSM factory constructor function.
         *
         * @name logic
         * @memberOf FSM.Session
         * @type {object} an object returned from the FSM factory constructor.
         */
        this.logic=                 logic;

        /**
         * When a message is sent to a session, that message consumtion may fire new messages sent to the session.
         * These messages are not consumed immediately.
         *
         * @name messages
         * @memberOf FSM.Session
         * @type {Array.<object>}
         */
        this.messages =             [];

        return this;
    };

    FSM.Session.prototype= {


        /**
         * Never call this method directly.
         * For a given Automata event triggering (state.onEnter, state.onExit, transition.onPre/PostGuard,
         * transition.onTransition), this method makes the appropriate call, either to the logic object, or to
         * the supplied callback function instead.
         */
        callMethod : function( /* method, argument1, ... */ ) {
            var args= Array.prototype.slice.call( arguments );
            var method= args.shift();

            if ( null===method ) {  // just in case.
                return;
            }

            args.splice(0,0,this);

            if ( typeof method==="function" ) {
                method.apply( this.logic, args );
            } else {
                if ( typeof this.logic[method]!=="undefined" ) {
                    this.logic[ method ].apply( this.logic, args );
                } else {
                    // no method with given name on session object data.
                }
            }
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
         * @private
         */
        push : function( state ) {
            var sc= new FSM.SessionContext( state );

            this.sessionContextList.push( sc );
            this.fireContextCreated( sc );
            this.fireStateChanged( sc, state, __InitialTransitionId );
        },

        /**
         * Pop and reset the last FSM.Context object level.
         *
         * @param transition {FSM.Transition} the firing transition
         * @param msg {object} the message that triggered the transition
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
         * @param msg {object}
         * @param endCallback  {function}
         */
        consume : function( msg, endCallback ) {
            this.messages.push( msg );
            if ( !this.transitioning ) {
                this.__processMessages(endCallback);
            }
        },

        /**
         * Consume a message.
         * A message consumption may imply more messages to be consumed. The callback will be invoked
         * when no more messages are available to be processed.
         *
         * @param endCallback {function} a callback function fired when there're no pending messages to be processed.
         */
        __processMessages : function( endCallback ) {

            if ( this.sessionContextList.length===0 ) {
                throw "Empty Session";
            }

            // remove first message
            var msg= this.messages.shift();

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
                throw "No transition on state "+this.getCurrentState().name+" for message "+msg.msgId;
            }

            // check guard pre condition.
            try {
                firingTransition.checkGuardPreCondition( msg, this );
            } catch( e ) {
                if ( e instanceof FSM.GuardException ) {
                    this.fireGuardPreCondition(firingTransition, msg, e);
                    return; // fails on pre-guard. simply return.
                } else {
                    FSM.Log.e("An error ocurred: "+ e.message);
                    this.printStackTrace();
                }
            }

            this.transitioning= true;

            try {
                firingTransition.checkGuardPostCondition( msg, this );

                try {
                    for( var j= this.sessionContextList.length-1; j>i; j-- ) {
                        this.pop( firingTransition, msg );
                    }

                    firingTransition.firePreTransition( msg, this );

                        var newState= firingTransition.finalState;
                        target.setCurrentState( newState );
                        this.fireStateChanged( target, newState, msg );

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
                    this.fireGuardPostCondition(firingTransition, msg, guardException);
                    firingTransition.firePreTransitionGuardedByPostCondition( msg, this );
                        this.fireStateChanged( target, firingTransition.initialState, msg );
                    firingTransition.firePostTransitionGuardedByPostCondition( msg, this );
                } else {
                    FSM.Log.e("An error ocurred: "+ guardException.toString());
                    this.printStackTrace();
                }
            }


            if ( this.messages.length===0 ) {
                this.transitioning = false;
                if ( endCallback ) {
                    endCallback();
                }
            } else {
                // differ to next tick execution
                setTimeout( this.consume.bind( this, endCallback ), 0 );
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

        fireContextCreated : function( sessionContext ) {
            for( var i=0; i<this.sessionListener.length; i++ ) {
                this.sessionListener[i].contextCreated( {
                    session: this,
                    context: sessionContext
                });
            }
        },

        fireContextRemoved : function( sessionContext ) {
            for( var i=0; i<this.sessionListener.length; i++ ) {
                this.sessionListener[i].contextDestroyed( {
                    session: this,
                    context: sessionContext
                });
            }
        },

        fireStateChanged : function( sessionContext, newState, msg ) {
            for( var i=0; i<this.sessionListener.length; i++ ) {
                this.sessionListener[i].stateChanged( {
                    session : this,
                    context : sessionContext,
                    state   : newState,
                    message : msg
                });
            }
        },

        fireGuardPreCondition : function( firingTransition, msg, guardException ) {
            for( var i=0; i<this.sessionListener.length; i++ ) {
                this.sessionListener[i].guardPreCondition( {
                    session     : this,
                    transition  : firingTransition,
                    message     : msg,
                    exception   : guardException
                });
            }
        },

        fireGuardPostCondition : function( firingTransition, msg, guardException ) {
            for( var i=0; i<this.sessionListener.length; i++ ) {
                this.sessionListener[i].guardPostCondition( {
                    session     : this,
                    transition  : firingTransition,
                    message     : msg,
                    exception   : guardException
                });
            }
        },

        fireCustomEvent : function( msg ) {
            for( var i=0; i<this.sessionListener.length; i++ ) {
                this.sessionListener[i].customEvent( {
                    session: this,
                    message: msg
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
        contextCreated      : function( obj ) {},
        contextDestroyed    : function( obj ) {},
        finalStateReached   : function( obj ) {},
        stateChanged        : function( obj ) {},
        customEvent         : function( obj ) {},
        guardPreCondition   : function( obj ) {},
        guardPostCondition  : function( obj ) {}
    };

    /**
     * Create and initalize a fsmContext object.
     * This is the initial source of interaction with Automata engine.
     */
    fsmContext= new FSM.FSMContext();

    /**
     * Register a FSM in Automata engine.
     * @param fsmd {object} A FSM object definition.
     */
    function registerFSM( fsmd ) {
        var fsm= new FSM.FSM( fsmd.logic, fsmd.name );

        var i;
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
    }

    /**
     * Create a given FSM session.
     * @param fsm <string> a FSM registered name.
     */
    function createSession( fsm ) {
        var args= Array.prototype.slice.call(arguments);
        args.shift();
        return fsmContext.createSession( fsm, args );
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
        newSessionListener  : newSessionListener
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

    exports = module.exports = _export;

})( typeof window!=='undefined' ? window : global );
