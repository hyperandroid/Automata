/**
 * See LICENSE file.
 *
 */

/**
 * requireJS available ???
 */
var module= module || {};

(function(root) {

    function extend(subc, superc) {
        var subcp = subc.prototype;

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
        for (var method in subcp) {
            if (subcp.hasOwnProperty(method)) {
                subc.prototype[method] = subcp[method];
            }
        }
    }

    Function.prototype.bind= Function.prototype.bind || function( /* this */ ) {

        var fn=     this;                                   // the function
        var args=   Array.prototype.slice.call(arguments);  // copy the arguments.
        var obj=    args.shift();                           // first parameter will be context 'this'

        return function() {
            fn.apply( obj, args.concat( Array.prototype.slice(arguments) ) );
        };
    };


    var __TimerIndex= 0;
    var __StateIndex= 0;
    var __InitialTransitionId= "__initial_transition_id";
    var fsmContext= null;

    var FSM= {};

    /**
     * FSMTimerTask
     *
     * @constructor
     * @param session
     * @param event
     * @param time
     * @param id
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

        isConsumed  : function() {
            return this.consumed;
        },

        isExpired : function( t ) {
            return this.scheduleTime + this.triggerTime < t;
        },

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

        __checkTimers : function() {

            var time= new Date().getTime();

            for( var i=0; i < this.timerTasks.length; i++ ) {
                var timerTask= this.timerTasks[i];
                if ( timerTask.consume( time ) ) {
                    this.timerTasks.splice( i,1 );
                }
            }
        },

        initialize : function() {
            this.timerId= root.setInterval( this.__checkTimers.bind(this), 200 );
            return this;
        },

        destroy : function() {
            root.clearInterval( this.timerId );
        },

        registerFSM : function( name, fsm ) {
            this.registry[ name ]= fsm;
        },

        getFSM : function( name ) {
            return this.registry[ name ];
        },

        createSession : function( fromFSM ) {

            var fsm= this.registry[ fromFSM ];
            if ( typeof fsm==="undefined" ) {
                throw "FSM "+fromFSM+" does not exist.";
            }

            return fsm.createSession();
        },

        addTimerTask : function( session, event, time ) {
            var id= __TimerIndex++;
            this.timerTasks.push( new FSM.TimerTask( session, event, time, id ) );
            return id;
        },

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

        getEvent : function() {
            return this.event;
        },

        setOnPreGuard : function( m ) {
            this.onPreGuard= m;
            return this;
        },

        setOnPostGuard : function( m ) {
            this.onPostGuard= m;
            return this;
        },

        setOnTransition : function( m ) {
            this.onTransition= m;
            return this;
        },

        firePreTransition : function( msg, session) {
            if ( this.initialState!=null ) {
                this.initialState.callOnExit( session, this, msg );
            }

            session.callMethod( this.onTransition, this.initialState, this, msg );
        },

        firePostTransition : function( msg, session) {
            this.finalState.callOnEnter( session, this, msg );
        },


        firePreTransitionGuardedByPostCondition : function( msg, session ) {
            if ( this.initialState!=null ) {
                this.initialState.callOnExit( session, this, msg );
            }

            session.callMethod( this.onTransition, this.initialState, this, msg);
        },

        firePostTransitionGuardedByPostCondition : function( msg, session ) {
            if ( this.initialState!=null ) {
                session.callMethod( this.initialState.onEnter, this.initialState, this, msg );
            }
        },

        checkGuardPreCondition : function( msg, session ) {
            session.callMethod( this.onPreGuard, this.initialState, this, msg );
        },

        checkGuardPostCondition : function( msg, session ) {
            session.callMethod( this.onPostGuard, this.initialState, this, msg );
        },

        fireTransition : function( msg, session ) {
            if ( this.initialState!==null ) {
                this.initialState.callOnExit( session, this, msg );
            }

            session.callMethod( this.onTransition, this.initialState,this,msg );
            this.finalState.callOnEnter( session, this, msg );
        }
    };

    /**
     * FSMState
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
         *
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

        isFinalState : function() {
            return this.exitTransitions.count===0;
        },

        setOnEnter : function( c ) {
            this.onEnter= c;
            return this;
        },

        setOnExit : function( c ) {
            this.onExit= c;
            return this;
        },

        setOnTimer : function( c ) {
            this.onTimer= c;
        },

        setSubState : function( c ) {
            this.subState= c;
        },

        getTransitionFor : function( msg ) {
            return this.exitTransitions[ msg.msgId ];
        },

        __getTimerKey : function( ) {
            return this.name + "#" + this.onTimer.event;
        },

        callOnEnter : function( session, transition, msg ) {
            if ( this.onTimer ) {
                session.addProperty(
                    this.__getTimerKey( ),
                    fsmContext.addTimerTask( session, this.onTimer.event, this.onTimer.timeout )
                );
            }
            session.callMethod( this.onEnter, this, transition, msg );
        },

        callOnExit : function( session, transition, msg ) {
            if( this.onTimer ) {
                fsmContext.removeTimerTask( session.getProperty( this.__getTimerKey() ) );
            }
            session.callMethod( this.onExit, this, transition, msg );
        }

    };

    /**
     * FSM
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

        initialize : function( initialState ) {

            var me= this;

            this.setOnEnter( function( state, transition, session, msg ) {
                me.initialTransition.fireTransition( {
                        msgId : __InitialTransitionId
                    },
                    session );
            } );

            this.initialState=                  initialState;
            this.initialTransition=             new FSM.Transition(__InitialTransitionId, null, initialState );
            this.initialTransition.setOnTransition( function( state, transition, session, msg ) {
                session.push( me.initialState );
            });
        },

        createSession : function() {

            if ( !this.sessionObjectFactory ) {
                return null;
            }

            var session= new FSM.Session( new this.sessionObjectFactory() );
            session.push( this );
            this.initialTransition.fireTransition( __InitialTransitionId, session );

            return session;
        }
    };

    extend( FSM.FSM, FSM.State );


    /**
     * SessionContext
     *
     * @constructor
     */
    FSM.SessionContext= function( state ) {
        this.currentState= state;

        return this;
    };

    FSM.SessionContext.prototype= {

        currentState    : null,

        setCurrentState : function( s ) {
            this.currentState= s;
        },

        getState : function() {
            return this.currentState;
        },

        getTransitionFor : function( msg ) {
            return this.currentState.getTransitionFor( msg );
        },

        exit : function( session, transition, msg) {
            this.currentState.callOnExit(session, transition, msg);
        },

        printStackTrace : function() {
            root.console.log("  "+this.currentState.name);
        }


    };

    /**
     * FSM.Session
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

        callMethod : function( /* method, argument1, ... */ ) {
            var args= Array.prototype.slice.call( arguments );
            var method= args.shift();

            if ( null===method ) {  // just in case.
                return;
            }

            if ( typeof method==="function" ) {
                method.call( this.logic, args[0], args[1], this, args[2] );
            } else {
                if ( typeof this.logic[method]!=="undefined" ) {
                    this.logic[ method ].call( this.logic, args );
                }
            }
        },

        addListener : function( sl ) {
            this.sessionListener.push( sl );
        },

        removeListener : function( sl ) {
            var pos= this.sessionListener.indexOf( sl );
            if ( -1!==pos ) {
                this.sessionListener.splice( pos, 1 );
            }
        },

        push : function( state ) {
            var sc= new FSM.SessionContext( state );

            this.sessionContextList.push( sc );
            this.fireContextCreated( sc );
            this.fireStateChanged( sc, state, __InitialTransitionId );
        },

        pop : function( transition, msg ) {
            var sc= this.sessionContextList.pop();
            sc.exit( this, transition, msg );

            this.fireContextRemoved( sc );

            if ( this.sessionContextList.length===0 ) {
                this.fireSessionEmpty();
            }
        },

        dispatch : function( msg ) {
            setTimeout( this.processMessage.bind( this, msg ), 0 );
        },

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

        getCurrentSessionContext : function() {
            return this.sessionContextList[ this.sessionContextList.length-1 ];
        },

        getCurrentState : function() {
            try {
                return this.getCurrentSessionContext().getState();
            } catch( e ) {
                return null;
            }
        },

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

        addProperty : function( key, value ) {
            this.properties[key]= value;
        },

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


    fsmContext= new FSM.FSMContext().initialize();

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

        fsm.initialize( initial_state );
        fsmContext.registerFSM( fsm.name, fsm );
    }

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
