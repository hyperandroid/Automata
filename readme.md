#Automata - A finite state machine framework.

##Description

Automata is a formal finite state machine (FSM) framework.
Its aims at offering a totally decoupled management of logic and data storage.
It features all the needed elements to have a modern and flexible
finite state machine framework like

* FSM registry
* Timed transitions
* Auto transition
* Sub states
* Guards
* FSM Session
*

##How to

Automata is valid to be used directly as a node js module. Exposes an object with two functions:

```javascript
module.exports= {
 registerFSM
 createSession
}
```

First of all, one or more FSM must be registered in the system. A minimal state machine could be:

```javascript
fsmContext.registerFSM( {

    // FSM registry name
    name    : "Test",
    logic   : constructor_func,

    // States
    state  : [
        {
            name    : "1",
            initial : true,
        },
        {
            name    : "2",
        },
        {
            name    : "3"
        }
    ],

    // transitions
    transition : [
        {
            event       : "12",
            from        : "1",
            to          : "2"
        },
        {
            event       : "23",
            from        : "2",
            to          : "3"
        }
    ]
} );
```

To start using this machine, a FSM session must created out of a registered FSM. For example:

```javascript
var session= fsmContext.createSession("Test");
```

To send notification events to a session object, call either:

```javascript

// asynchronous call ( setTimeout with 0 )
session.dispatch( { msgId: "12" } );

// synchronous call
session.processMessage( {msgId: "12"} );
```

These methods accept as a valid message any object which contains a field called **msgId**. To trigger a transition,
 any message object's msgId value must be the value defined in the **event** attribute present in the transition
 FSM definition block.

##Logic object

The FSM logic and state is ketp apart on a custom object the developer supplies to the FSM via the logic value.
This must be a constructor function and will create a new object per session.
Methods on this object can be automatically invoked by the framework by assigning them to the activity hook values
available on State and Transition objects.
The hooks points can be either an string, identifying a function in the logic object, or a callback function of the form:

```javascript
function( state, transition, session, msg );
```

In either case, the calling **this** scope will be the logic object itself.

##Activy hooks

Automata offers many activy hooks on its activity. The following hooks are available:

State:
  * **onEnter**. Code fired on state enter.
  * **onExit**. Code fired on state exit.


Transition:
  * **onTransition**. Code fired when the transition fires.
  * **onPreGuard**. Code fired on transition fire but previously to onTransition. It can veto transition fire.
  * **onPostGuard**. Code fired after onTransition execution. Could veto transition fire by issuing an auto-transition.

Those hooks are defined in the **FSM JSON** definition as in the example:

For example:

```javascript
/**
 * Define a logic constructor function.
 */
function constructor_func() {

    this.count= 0;

    this.B_onEnter= function() {
        console.log("Enter state B");
        this.count++;
    };

    this.A_onExit= function() {
        console.log("Exit state A");
    };

    this.TR_AB= function() {
        console.log("Transition fire code");
    }

    return this;
}

/**
 * Define a FSM
 */
 fsmContext.registerFSM( {

     // FSM registry name
     name    : "Test",
     logic   : constructor_func,

     // States
     state  : [
         {
             name    : "A",
             initial : true,
             onExit  : "A_onExit"
         },
         {
             name    : "B",
             onEnter : "B_onEnter"
         },
         {
            name    : "C"
         }
     ],

     transition : [
         {
             event       : "AB",
             from        : "A",
             to          : "B",
             onTransition: "TR_AB",
         },
         {
             event       : "BC",
             from        : "B",
             to          : "C"
         }
     ]
 } );

 var session= fsmContext.createSession("Test");
 session.dispatch( { msgId: "AB" } );
 // this will print:
 //  Exit state A
 //  Transition fire code
 //  Enter state B
```

##Guards

Guard prevent a transition from being fired. In Automata there're two available guard points out of the box.
One on preTransitionFire and the otheron postTransitionFire.
The difference is straight:

 * The **pre-transition guard**, if fired, aborts the transition firing procedure as if it had never ocurred.
   That means, that neither the onExit function, nor a sefl transition event will be fired by the engine.
   A good usage of this situation is for counting states. For example, in a multiplayer game where 3 players
   must be present to start the game, an transition from state WaitPlayers to StartGame will be defined.
   The pre-transition guard will allow to set a count up, so that whenever a new player enters the game, the
   count increments, and will fail until the desired amount is reached. This procedure won't affect the state
   machine, nor its observers.
 * The **post-transition guard**, if fired, maked the transition behave as a self-transition trigger, and the following
   action sequence will be fired: Exit_State_A, Transition Fire, Enter_State_A.

 The way to instrument the engine that a guard veto has been launched, will be by throwing an exception from the
 pre/post-transition functions. Those functions are optional, and must be set in the "transition" block of the
 FSM definition as follows:

```javascript
 fsmContext.registerFSM( {
   ...,

   transition : [
        {
            event        : "AB",
            from         : "A",
            to           : "B",
            onTransition : "TR_AB",
            onPreGuard   : "pre_guard_function",
            onPostGuard  : "post_guard_function",
        },
        ...
    ],

    ...
 }
```

##Timed transitions

Automata offers out of the box timed transitions by defining an **onTimer** block in a state definition. For example:

```javascript
 fsmContext.registerFSM( {

    ...,

    state  : [
         {
             name    : "1",
             initial : true,
             onTimer : {
                 timeout : 2000,
                 event   : "12"
             },
        }
    ],

    ...

 } );
 ```

This instruments the engine that after 2 seconds of entering this state, a transition by a transition with an
event id like "12" will be sent to the FSM session. The timer is handled automatically, and set/canceled on state
enter/exit respectively.

##SubStates

Automata allows to nest as much as needed substates. In fact, by defining a single FSM, the engine stacks two levels,
one for the FSM, and the other, initially for the FSM's initial state. To define different levels, you must
register more than one FSM in the registry, and then reference one of them as a substate in the "state" section:

```javascript
 fsmContext.registerFSM( {
    ...
    state  : [
        {
            name    : "a",
            initial : true,
            onEnter : "enter_a",
            onExit  : "exit_a"
        },
        {
            subState: "STest"
        },

        ...

    ],

    ...
 } );
```

Then, the transition section will identify this FSM as a substate by its name, STest. A "subState" can't have a
 regular name, nor onEnter/onExit functions.

 The stacking of different subStates is done transparently, and they are handled by the "session" object. For each
 stacked level, a FSM.Context object is created. A context object is just a holder for the current state for each nesting level.

##Transition from Substates

The way in which Automata manages state changes is made hierarchycally. That means, the engine will try to find a
suitable transition for a given incoming message regardless of its nesting level.
So for any given FSM stacktrace, the engine will traverse upwards trying to find a suitable state to fire a
transition for the dispatched event.

(ROOT)
  |
  |
  v
(S1) --[T_S1_S2]--> (SUB_STATE) --[T_SS_S3]--> (S3)
                         |
                         |---> (SS1) --[TSS1_SS2]--> (SS2)

For example, given the previous example,

```javascript
session.dispatch( {msgId : "T_S1_S2" } );
```

means the session is on state SS1, and the stackTrace will be the following:

ROOT, SUB_STATE, SS1

By calling
```javascript
session.dispatch( {msgId : "T_SS_S3" } );
```

on the session at state SS1, SS1 will be removed from the stack, and the session will transize to S3 state.
Additionally, this session will be finished since S3 is a final State (this nesting level will be removed from the stack too), and ROOT is also a final state, causing the session to be emptied.


##FSM listeners

Any FSM session activity can be monitored by adding a listener.
For example:

```javascript
session.addListener( {
    contextCreated      : function( obj ) {
        console.log("SessionListener contextCreated");
    },
    contextDestroyed    : function( obj ) {
        console.log("SessionListener contextDestroyed");
    },
    finalStateReached   : function( obj ) {
        console.log("SessionListener finalStateReached");
    },
    stateChanged        : function( obj ) {
        console.log("SessionListener stateChanged");
    },
    customEvent         : function( obj ) {
        console.log("SessionListener customEvent");
    }
} );
```

The obj parameter for each listener object function contains the following parameters:

* contextCreated:     function( session, context )
* contextDestroyed:   function( session, context )
* finalStateReached:  function( session )
* stateChanged:       function( session, context, newState, message )
* customEvent:        function( session, message )

In all cases:

session:    is the FSM created session.
context:    is an internal FSM object. A context is just a holder for the current state for each subState the system enters.
newState:   a FSM state object.
message:    a message object. The only constraint for these message objects is they must have a "msgId" field.

##Custom events