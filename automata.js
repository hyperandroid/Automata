/**
 * @author Ibon Tolosana, @hyperandroid
 *
 * See LICENSE file.
 *
 */

/**
 * requireJS available ???
 */
var module = module || {};

(function (root) {


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
     * Local module definition.
     */
    var FSM= {};

    /**
     * FSMTimerTask
     *
     * This object encapsulates a task timer.
     * They are automatically defined by setting an onTimer block in a state definition.
     *
     * @constructor
     * @param session <FSM.Session> a session object
     * @param event   <object> a message object.
     * @param time    <number> an integer specifying milliseconds.
     * @param id      <number> a unique integer value.
     */
    FSM.TimerTask= function( session, event, time, id ) {
        this.session=       session;
        this.event=         event;
        this.triggerTime=   time;
        this.id=            id;

        this.contextState=  session.getCurrentState();
        this.scheduleTime=  new Date().getTime();

        return this;
    };

    FSM.TimerTask.prototype= {
        session         : null,
        contextState    : null,
        event           : null,
        triggerTime     : 0,
        scheduleTime    : 0,
        consumed        : false,
        id              : 0,

        /**
         * Has this timer task already been fired ?
         */
        isConsumed  : function() {
            return this.consumed;
        },

        /**
         * Is this timer task on time so that it must be triggered ?
         * @param t
         */
        isExpired : function( t ) {
            return this.scheduleTime + this.triggerTime < t;
        },

        /**
         * This is the timer task control function.
         * @param t
         */
        consume : function( t ) {
            if ( this.isConsumed() ) {
                return true;
            }

            if ( this.isExpired( t ) ) {
                if ( this.contextState === this.session.getCurrentState() ) {
                    this.session.dispatch( this.event );
                }

                this.consumed= true;
                return true;
            }

            return false;
        }
    };

    /**
     *
     * FSMContext
     * FSMContext is the core of the Automata engine. It server as Finite State Machines registry, timer task
     * manager, FSM session creation, etc.
     * It is intended to be a unique object.
     *
     * @constructor
     *
     */
    FSM.FSMContext= function() {

        this.timerTasks=    [];
        this.registry=      {};

        return this;
    };

    FSM.FSMContext.prototype= {

        timerId     : null,
        timerTasks  : null,
        registry    : null,

        initialized : false,

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
         */
        initialize : function() {
            if ( this.initialized ) {
                throw "Automata already initialized.";
            }

            this.timerId= root.setInterval( this.__checkTimers.bind(this), 200 );
            this.initialized= true;
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
         * @param name <string> a FSM name.
         * @param fsm <FSM.FSM> an FSM object instance.
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
         * @param name
         * @private
         */
        getFSM : function( name ) {
            return this.registry[ name ];
        },

        /**
         * Create a given FSM session.
         * @param fromFSM <string> a FSM name. Must be previously registered by calling registerFSM function.
         *
         * @return <FSM.Session> an initialized session object.
         */
        createSession : function( fromFSM ) {

            var fsm= this.registry[ fromFSM ];
            if ( typeof fsm==="undefined" ) {
                throw "FSM "+fromFSM+" does not exist.";
            }

            return fsm.createSession();
        },

        /**
         * Add a new Timer Task.
         * A timer task means sending a message to a given FSM session after elapsing some time.
         * It is automatically managed by onTimer block definition.
         *
         * Should not be called directly.
         *
         * @param session <FSM.Session> a session object
         * @param event <object> a message object
         * @param time <number> an integer indicating milliseconds.
         *
         * @return <number> a unique timertask id.
         */
        addTimerTask : function( session, event, time ) {
            var id= __TimerIndex++;
            this.timerTasks.push( new FSM.TimerTask( session, event, time, id ) );
            return id;
        },

        /**
         * Remove a previously set timer task.
         * It is automatically managed by onTimer block definition.
         *
         * Should not be called directly.
         *
         * @param id
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
     * FSMTransition
     * An Automata framework transition.
     * This class is private and should not be dealed with directly.
     * Any given Transition which belongs to a FSM object is unique isntance.
     *
     * @constructor
     */
    FSM.Transition= function( event, initialState, finalState ) {
        this.event=         event;
        this.initialState=  initialState;
        this.finalState=    finalState;

        if ( this.initialState ) {
            this.initialState.addTransition(this);
        }

        return this;
    };

    FSM.Transition.prototype= {

        initialState    : null,
        finalState      : null,
        event           : "",

        onTransition    : null,
        onPreGuard      : null,
        onPostGuard     : null,

        /**
         * return this transition's firing event.
         */
        getEvent : function() {
            return this.event;
        },

        /**
         * Set this transition's pre guard function or function name form the logic object.
         *
         * @param m <function|string>
         */
        setOnPreGuard : function( m ) {
            this.onPreGuard= m;
            return this;
        },

        /**
         * Set this transition's post guard function or function name form the logic object.
         *
         * @param m <function|string>
         */
        setOnPostGuard : function( m ) {
            this.onPostGuard= m;
            return this;
        },

        /**
         * Set this transition's callback function executed when the transition is fired.
         * @param m <function|string>
         */
        setOnTransition : function( m ) {
            this.onTransition= m;
            return this;
        },

        /**
         * Do this transition's pre-transition code
         * @param msg <object>
         * @param session <FSM.Session>
         */
        firePreTransition : function( msg, session) {
            if ( this.initialState!=null ) {
                this.initialState.callOnExit( session, this, msg );
            }

            session.callMethod( this.onTransition, this.initialState, this, msg );
        },

        /**
         * Do this transition's post-transition code
         * @param msg <object>
         * @param session <FSM.Session>
         */
        firePostTransition : function( msg, session) {
            this.finalState.callOnEnter( session, this, msg );
        },

        /**
         * Do this transition's pre-transition code. Though it may seem equal to firePreTransition it is handled
         * in another function because an exception could be throws. In such case a pre-guard is assumed to have
         * been fired.
         * @param msg
         * @param session
         */
        firePreTransitionGuardedByPostCondition : function( msg, session ) {
            if ( this.initialState!=null ) {
                this.initialState.callOnExit( session, this, msg );
            }

            session.callMethod( this.onTransition, this.initialState, this, msg);
        },

        /**
         * Do this transition's post-transition code. Though it may seem equal to firePreTransition it is handled
         * in another function because an exception could be throws. In such case a pre-guard is assumed to have
         * been fired.
         * @param msg
         * @param session
         */
        firePostTransitionGuardedByPostCondition : function( msg, session ) {
            if ( this.initialState!=null ) {
                session.callMethod( this.initialState.onEnter, this.initialState, this, msg );
            }
        },

        /**
         * Fire pre-Guard code.
         * If the method throws an exception, this transition is aborted as if it hadn't been fired.
         * @param msg
         * @param session
         */
        checkGuardPreCondition : function( msg, session ) {
            session.callMethod( this.onPreGuard, this.initialState, this, msg );
        },

        /**
         * Fire post-Guard code.
         * If the method throws an exception, this transition is vetoed, and it will issue an auto-transition instead
         * of a state-to-state transition.
         * @param msg
         * @param session
         */
        checkGuardPostCondition : function( msg, session ) {
            session.callMethod( this.onPostGuard, this.initialState, this, msg );
        },

        /**
         * Notify observers about this transition fire event.
         * @param msg <object> the message which fired this transition
         * @param session <FSM.Session>
         *
         * @private
         */
        fireTransition : function( msg, session ) {
            if ( this.initialState!==null ) {
                this.initialState.callOnExit( session, this, msg );
            }

            session.callMethod( this.onTransition, this.initialState,this,msg );
            this.finalState.callOnEnter( session, this, msg );
        },

        toString : function() {
            return ""+this.event;
        }
    };

    /**
     * FSMState
     * This object defines a FSM state.
     *
     * @constructor
     */
    FSM.State= function( name ) {

        this.exitTransitions= {
            count: 0
        };
        this.name= name || ( "state"+__StateIndex++ );

        return this;
    };

    FSM.State.prototype= {
        exitTransitions : null,
        name            : "",
        onEnter         : null,
        onExit          : null,
        onTimer         : null,

        subState        : null,

        /**
         * Add an exit transition to this State instance.
         * This transition must be uniquely added.
         * @param tr <FSM.FSMTransition>
         */
        addTransition : function( tr ) {
            var event= tr.getEvent();

            if ( this.exitTransitions[event] ) {
                throw "Already set transition for event "+event;
            }

            this.exitTransitions[event]= tr;
            this.exitTransitions.count++;

            return this;
        },

        /**
         * Check whether this state has exiting transitions.
         * If not, will be defined as final.
         */
        isFinalState : function() {
            return this.exitTransitions.count===0;
        },

        /**
         * Set this state's onEnter callback function.
         * @param c <String|function>
         */
        setOnEnter : function( c ) {
            this.onEnter= c;
            return this;
        },

        /**
         * Set this state's onExit callback function.
         * @param c <String|function>
         */
        setOnExit : function( c ) {
            this.onExit= c;
            return this;
        },

        /**
         * Add a timed transition to this state.
         * @param c <object< timeout: <number>, event: <object> >
         */
        setOnTimer : function( c ) {
            this.onTimer= c;
        },

        /**
         * Get a transition for the defined typeof message.
         * @param msg <string>
         */
        getTransitionFor : function( msg ) {
            return this.exitTransitions[ msg.msgId ];
        },

        /**
         * @private
         */
        __getTimerKey : function( ) {
            return this.name + "#" + this.onTimer.event;
        },

        /**
         * Execute the procedure on entering this State.
         * It may seem to set a timer, and calling the optional onEnter callback function.
         * @param session <FSM.Session>
         * @param transition <FSM.Transition>
         * @param msg <object>
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
         * @param session <FSM.Session>
         * @param transition <FSM.Transition>
         * @param msg <object>
         */
        callOnExit : function( session, transition, msg ) {
            if( this.onTimer ) {
                fsmContext.removeTimerTask( session.getProperty( this.__getTimerKey() ) );
            }
            session.callMethod( this.onExit, this, transition, msg );
        },

        toString : function() {
            return ""+this.name;
        }

    };

    /**
     * FSM
     * FSM defines a complete finite state machine.
     * A FSM.FSM object extends a FSM.State object, so polymorphically a complete FSM is an State. This way, we can
     * supply with sub-states to Automata's engine.
     *
     * @constructor
     *
     */
    FSM.FSM= function( sessionObjectFactory ) {

        FSM.FSM.superclass.constructor.call(this);

        this.sessionObjectFactory= sessionObjectFactory;

        return this;
    };

    FSM.FSM.prototype= {

        sessionObjectFactory    : null,

        initialTransition       : null,
        initialState            : null,

        /**
         * Initialize a Finite State Machine.
         *
         * @param initialState <FSM.State>
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
                session.push( me.initialState );
            });
        },

        setOnEnter : function( m ) {
            this._onEnter= m;
            return this;
        },

        callOnEnter : function( session, transition, msg ) {
            session.callMethod( this._onEnter, session, transition, msg );
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
         */
        createSession : function() {

            if ( !this.sessionObjectFactory ) {
                return null;
            }

            var session= new FSM.Session( new this.sessionObjectFactory() );
            session.push( this );
            this.callOnEnter( session, null, null );

            return session;
        }
    };

    extend( FSM.FSM, FSM.State );


    /**
     * SessionContext
     * A session context is just a holder for a current state across the different nesting levels of a given FSM.
     * This class is some sugar to deal with an State.
     * A FSM.Session is an stack of different contexts.
     *
     * @constructor
     */
    FSM.SessionContext= function( state ) {
        this.currentState= state;

        return this;
    };

    FSM.SessionContext.prototype= {

        currentState    : null,

        /**
         * Set this context current state.
         * This method will be called by Automata's engine when a state change is fired.
         * @param s <FSM.State>
         */
        setCurrentState : function( s ) {
            this.currentState= s;
        },

        /**
         * Get this context's current state.
         * @return <FSM.State>
         */
        getState : function() {
            return this.currentState;
        },

        /**
         * Get an exiting transition defined by this message for the current State.
         * @param msg
         */
        getTransitionFor : function( msg ) {
            return this.currentState.getTransitionFor( msg );
        },

        /**
         * Call this current State onExit callback function.
         * @param session <FSM.Session>
         * @param transition <FSM.Transition>
         * @param msg <object>
         */
        exit : function( session, transition, msg) {
            this.currentState.callOnExit(session, transition, msg);
        },

        /**
         * Print this context current state info.
         */
        printStackTrace : function() {
            root.console.log("  "+this.currentState.name);
        }


    };

    /**
     * FSM.Session
     * A Session is the real artifact to deal with in Automata engine.
     * A session must be created and will the core object to send messages to. Automata framework will take care
     * of choreograph the calls, context push/pop, session observer notification, etc.
     *
     * @constructor
     */
    FSM.Session= function( logic ) {

        this.sessionContextList=    [];
        this.sessionListener=       [];
        this.properties=            {};

        this.logic=                 logic;

        return this;
    };

    FSM.Session.prototype= {

        id                  : null,
        sessionContextList  : null,
        sessionListener     : null,
        properties          : null,

        transitioning       : false,

        logic               : null,

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
                }
            }
        },

        /**
         * Add an observer to this session.
         * @param sl <FSM.SessionListener>
         */
        addListener : function( sl ) {
            this.sessionListener.push( sl );
        },

        /**
         * Remove an observer from this session.
         * @param sl <FSM.SessionListener>
         */
        removeListener : function( sl ) {
            var pos= this.sessionListener.indexOf( sl );
            if ( -1!==pos ) {
                this.sessionListener.splice( pos, 1 );
            }
        },

        /**
         * Push and set up a new FSM.Context level.
         * @param state <FSM.State>
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
         * @param transition <FSM.Transition> the firing transition
         * @param msg <object> the message that triggered the transition
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
         * @param msg <object>
         */
        dispatch : function( msg ) {
            setTimeout( this.processMessage.bind( this, msg ), 0 );
        },

        /**
         * Synchronoulsy consume a message.
         * @param msg <object>
         */
        processMessage : function( msg ) {
            if ( this.transitioning ) {
                throw "Processing message during transition";
            }

            if ( this.sessionContextList.length===0 ) {
                throw "Empty Session";
            }

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

            if ( null===firingTransition ) {
                throw "No transition on state "+this.getCurrentState().getName()+" for message "+msg.msgId;
            }

            // check guard pre condition.
            try {
                firingTransition.checkGuardPreCondition( msg, this );
            } catch( e ) {
                return; // fails on pre-guard. simply return.
            }

            this.transitioning= true;

            try {
                firingTransition.checkGuardPostCondition( msg, this );

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
            } catch( guardException ) {
                firingTransition.firePreTransitionGuardedByPostCondition( msg, this );
                    this.fireStateChanged( target, firingTransition.initialState, msg );
                firingTransition.firePostTransitionGuardedByPostCondition( msg, this );
            }

            this.transitioning= false;
        },

        /**
         * Get the current execution context.
         */
        getCurrentSessionContext : function() {
            return this.sessionContextList[ this.sessionContextList.length-1 ];
        },

        /**
         * Get current's context state.
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
         */
        printStackTrace : function() {
            if ( this.sessionContextList.length===0 ) {
                root.console.log("session empty");
            } else {
                root.console.log("session stack trace:");
                for( var i=0; i<this.sessionContextList.length; i++ ) {
                    this.sessionContextList[i].printStackTrace();
                }
            }
        },

        /**
         * Add a property. Used as a holder for onTimer information.
         * @param key <string>
         * @param value <object>
         */
        addProperty : function( key, value ) {
            this.properties[key]= value;
        },

        /**
         * Remove a property.
         * @param key <string>
         */
        removeProperty : function( key ) {
            this.properties.delete( key );
        },

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
     * SessionListener
     * A template object to set a session object observer.
     *
     * @constructor
     */
    FSM.SessionListener= function() {
        return this;
    };

    FSM.SessionListener.prototype= {
        contextCreated      : function( obj ) {},
        contextDestroyed    : function( obj ) {},
        finalStateReached   : function( obj ) {},
        stateChanged        : function( obj ) {},
        customEvent         : function( obj ) {}
    };

    /**
     * Create and initalize a fsmContext object.
     * This is the initial source of interaction with Automata engine.
     */
    fsmContext= new FSM.FSMContext().initialize();

    /**
     * Register a FSM in Automata engine.
     * @param fsmd <object> A FSM object definition.
     */
    function registerFSM( fsmd ) {
        var fsm= new FSM.FSM( fsmd.logic );

        fsm.name= fsmd.name || fsm.name;

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
                }

                if ( state_def.onExit ) {
                    state.setOnExit( state_def.onExit );
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
            }
            if ( transition_def.onPreGuard ) {
                transition.setOnPreGuard( transition_def.onPreGuard );
            }
            if ( transition_def.onPostGuard ) {
                transition.setOnPostGuard( transition_def.onPostGuard );
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
        return fsmContext.createSession( fsm );
    }

    /**
     * node module definition.
     */
    module.exports= {
        registerFSM     : registerFSM,
        createSession   : createSession
    };

})( typeof window!=='undefined' ? window : global );
