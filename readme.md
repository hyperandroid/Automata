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
* FSM Session as message chroreographer

##How to

Automata is valid to be used directly as a node js module or directly on browsers.
To get it:

* npm install automata
* include automata.js script file

Automata exposes an object with two functions:

```javascript
module.exports= {
 registerFSM
 createSession
}
```

First of all, one or more FSM must be registered in the system. One State must be labeled as initial,
which will be the entry point. A minimal state machine could be:

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

A session accepts messages until it has reached a final State at its top level. From then and beyond, the session will
toss exceptions if it has a message sent.

##Logic object

The FSM logic and state are isolated. The developer supplies a custom object to the FSM via the **logic** value.
This must be a constructor function and will create a new object per **session**.
Methods on this object can be automatically invoked by the framework by assigning them to the activity hook values
available on State and Transition objects.
The hooks points can be either an string, identifying a logic object function or a callback function. In either case, the
 function is of the form:

```javascript
function( session, state, transition, msg );
```

In either case, the calling **this** scope will be the logic object itself.

##Activy hooks

Automata offers many activy hooks on its activity. The following hooks are available:

State and FSM:

  * **onEnter**. Code fired on state enter.
  * **onExit**. Code fired on state exit.


Transition:

  * **onTransition**. Code fired when the transition fires.
  * **onPreGuard**. Code fired on transition fire but previously to onTransition. It can veto transition fire.
  * **onPostGuard**. Code fired after onTransition execution. Could veto transition fire by issuing an auto-transition.

A natural transition flow of executed actions for a transition from StateA to StateB will be:

<code>
StateA.onExit() -> Transition.onTransition() -> StateB.onEnter()
</code>

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

Function hooks will be addressed in two ways:

* **By convention**. The FSM engine will look for an unspecified method with the following rules:

    state/fsm enter action:   state.name+"_enter"
    state/fsm exit action:    state.name+"_exit"

    transition action:        transition.event+"_transition"
    transition preGuard:      transition.event+"_preGuard"
    transition postGuard:     transition.event+"_postGuard"

* **By configuration**. Defining onEnter, onExit or onTransition in the FSM JSON file.

In any case, those functions will be automatically called if they exist in the logic object.

##Guards

Guard prevent a transition from being fired. In Automata there're two available guard points out of the box.
One on preTransitionFire and the other on postTransitionFire.
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

A natural transition flow of executed actions for a transition from StateA to StateB with preGuard and postGuard actions
will be:

<code>
if preGuard throws exception
    // nothing will happen
    nil;
else
    if postGuard throws exception
        // auto-transition. State change to StateA will be notified to observers.
        StateA.onExit -> transition.onTransition -> StateA.onEnter
    else
        // this is the regular execution path for a non-guarded transition. State change to
        // StateB will be notified to observers.
        StateA.onExit -> Transition.onTransition -> StateB.onEnter
    endif
endif
</code>

 The way to instrument the engine that a guard veto has been launched, will be by throwing an exception from the
 pre/post-transition functions. A Guard is expected to throw a GuardException object by calling
  <code>transition.createThrowable</code> method.
 Those functions are optional, and must be set in the "transition" block of the
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

 If no onPreGuard/onPostGuard attributes are specified, Automata DFA engine will assume a call to a convention method
 of the form:

 ```
 <event>_preGuard / <event>_postGuard.
 ```

 In this case:
 * AB_preGuard
 * AB_postGuard


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

(Warning, offending ascii art. States between parenthesis, transitions between square brackets.)
<pre>
(ROOT)
  |
  |
  v
(S1) --[T_S1_S2]--> (SUB_STATE) --[T_SS_S3]--> (S3)
                         |
                         +---> (SS1) --[TSS1_SS2]--> (SS2)
</pre>


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

on the session at state SS1, SS1 will be removed from the stack (since SS2 is a final state), and the session will
transize to S3 state.
Additionally, this session will be finished since S3 is a final State (this nesting level will be removed from the stack too),
and so it is ROOT, which causes the session to be emptied.


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

* **contextCreated**:     function( session, context )
* **contextDestroyed**:   function( session, context )
* **finalStateReached**:  function( session )
* **stateChanged**:       function( session, context, newState, message )
* **customEvent**:        function( session, message )

In all cases:

* **session**:    is the FSM created session.
* **context**:    is an internal FSM object. A context is just a holder for the current state for each subState the system enters.
* **newState**:   a FSM state object.
* **message**:    a message object. The only constraint for these message objects is they must have a "msgId" field.

##Custom events

The preferred way for sending custom events will by calling:
```javascript
session.fireCustomEvent( a_json_object );
```

and have a listener/observer object attached to the sending FSM session.
This method will be notified on the method

```javascript
customEvent         : function( { session: session, customEvent: a_json_object } ) {
```




#Samples

##Sample 1 - Simple FSM

This sample shows how to define common FSM session callback points. Either on logic object, or by defining a callback.
In either case, **this** is defined to be the session's logic object.

```javascript

context= module.exports;

var Logic= function() {

    this.enter= function( session, state, transition, msg ) {
        console.log("enter "+state.toString());
    };

    this.exit= function( session, state, transition, msg ) {
        console.log("exit "+state.toString());
    };

    this.action= function( session, state, transition, msg ) {
        console.log("transition: "+transition.toString());
    };
};

context.registerFSM( {

    name    : "Test1",
    logic   : Logic,

    state  : [
        {
            name    : "a",
            initial : true,
            onEnter : "enter",
            onExit  : "exit"
        },
        {
            name    : "b",
            onEnter : "enter",
            onExit  : "exit"
        },
        {
            name    : "c",
            onEnter : function( session, state, transition, msg ) {
                console.log("Enter c");
            },
            onExit  : function( session, state, transition, msg ) {
                console.log("Exit c");
            }
        }
    ],

    transition : [
        {
            event       : "ab",
            from        : "a",
            to          : "b",
            onTransition: "action"
        },
        {
            event   : "bc",
            from    : "b",
            to      : "c",
            onTransition: "action"
        }
    ]
} );

var session= context.createSession("Test1");
session.dispatch( { msgId: "ab" } );

var session2= context.createSession("Test1");
session2.dispatch( { msgId: "ab" } );

```

##Sample 2 - FSM with timed events

This sample show how to define a timed transition.

```javascript

context= module.exports;

context.registerFSM( {

    name    : "Test2",
    logic   : function() { return this; },

    state  : [
        {
            name    : "a",
            initial : true,
            onExit  : function( session, state, transition, msg ) {
                console.log("Exit a");
            },
            onTimer : {         // <-- Timed transition.
                timeout: 4000,  //  after 4 seconds
                event: {
                    msgId: "ab" //  fire transition identified by "ab" if exists.
                }
            }
        },
        {
            name    : "b",
            onEnter : function( session, state, transition, msg ) {
                console.log("Enter b");
            }
        },
        {
            name    : "c"
        }
    ],

    transition : [
        {
            event       : "ab",
            from        : "a",
            to          : "b"
        },
        {
            event   : "bc",
            from    : "b",
            to      : "c"
        }
    ]
} );

var session1= context.createSession("Test2");

var session2= context.createSession("Test2");
session2.dispatch( {msgId : "ab"} );

/*
will print:

immediately
Exit a
Enter b
from session2 which has triggered a transition change

and
Exit a
Enter b
after 4 seconds from session1.
*/

```

## Sample 3 - Guards

This sample shows how transition guards work on Automata. To fire a transition, first of all an optional **pre-guard**
function is tested. If this function throws an exception, Automata interprets a veto on this transition fire. During
pre-guard stage, a veto means transition disposal, so no auto-transition is performed. This is useful for example, in
a multiplayer game where while playing, a user abbadons the game and the game can continue playing. So instead of
transitioning from State-playing to State-EndGame, a guard can decide to veto the transition.

By definition, a guard **should not** modify the model, in this case, a Logic object.

In the example, the guard will fail two times until the count reaches 3.
At this moment, the transition is fired (its onTransition method is executed if exists), and after that,
the **post-guard** condition is checked. PostGuard semantics are completely different.
After firing the transition, the postGuard is checked. If this function **throws an exception** the transition
turns into auto-transition, that means firing state change to current-state, and entering again current state.
If not, the transition continues its natural flow and transition's next state is set as current state.

```javascript

context= module.exports;

var Logic= function() {

    this.count= 0;

    this.enter_b= function() {
        console.log("enter b");
        this.count++;
    }

    this.enter= function( session, state, transition, msg ) {
        console.log("enter "+state.toString());
    };

    this.exit= function( session, state, transition, msg ) {
        console.log("exit "+state.toString());
    };

    this.action= function( session, state, transition, msg ) {
        console.log("transition: "+transition.toString());
    };

    this.pre_guard_tr_bc= function() {
        this.count++;
        console.log("count= "+this.count);
        if ( this.count<3 ) {
            throw "PreGuard_tr_BC";
        } else {
            console.log("Ok, go.");
        }
    };

    this.post_guard_tr_bc= function() {
        this.count++;
        console.log("count= "+this.count);
        if ( this.count<5 ) {
            throw "PostGuard_tr_BC";
        }
    };

    return this;
};

context.registerFSM( {

    name    : "Test3",
    logic   : Logic,

    state  : [
        {
            name    : "a",
            initial : true,
            onEnter : "enter",
            onExit  : "exit"
        },
        {
            name    : "b",
            onEnter : "enter_b",
            onExit  : "exit"
        },
        {
            name    : "c",
            onEnter : "enter",
            onExit  : "exit"
        },
        {
            name    : "d",
            onEnter : "enter",
            onExit  : "exit"
        },
    ],

    transition : [
        {
            event       : "ab",
            from        : "a",
            to          : "b",
            onTransition: "action"
        },
        {
            event   : "bc",
            from    : "b",
            to      : "c",
            onTransition: "action",
            onPreGuard  : "pre_guard_tr_bc",
            onPostGuard : "post_guard_tr_bc"
        },
        {
            event   : "cd",
            from    : "b",
            to      : "c",
            onTransition: "action"
        }
    ]
} );

var session= context.createSession("Test3");

session.addListener( {
    contextCreated      : function( obj ) {    },
    contextDestroyed    : function( obj ) {    },
    finalStateReached   : function( obj ) {
        console.log("SessionListener finalStateReached");
    },
    stateChanged        : function( obj ) {
        console.log("SessionListener stateChanged");
    },
    customEvent         : function( obj ) {    }
} );

console.log("");
console.log("Sent 'ab'");
session.processMessage( { msgId: "ab" } );

// fail on pre-guard. count=1, but no notification of state change sent.
console.log("");
console.log("Sent 'bc'");
session.processMessage( { msgId: "bc" } );

// fail on pre-guard. count=2, but no notification of state change sent.
console.log("");
console.log("Sent 'bc'");
session.processMessage( { msgId: "bc" } );

// on pre-guard. count=3.
// Ok go transition.
// Fail on post-guard
// so onExit State-b and onEnter State-b ( auto-transition ). Vetoed transition from State-b to State-c.
// notification of 'stateChanged' on the observer.
console.log("");
console.log("Sent 'bc'");
session.processMessage( { msgId: "bc" } );

console.log("");
console.log("Sent 'bc'");
session.processMessage( { msgId: "bc" } );

```


## Sample 4 - SubStates

Sub States is an Automata feature which allows to nest different registered FSM as states of other FSM.
The mechanism is straightforward, just define a **substate** block in an FSM **state** definition block.
Automata will handle automatically all the nesting procedure, call the FSM action hooks and set the system's new
current state.

A substate, or a FSM does not define neither onEnter nor onExit function callbacks.

It is done as follows:

```javascript

var context= module.exports;

var Logic= function() {

    this.enter= function( session, state, transition, msg ) {
        console.log("Enter "+state.toString());
    };

    this.exit= function( session, state, transition, msg ) {
        console.log("Exit "+state.toString());
    };

    this.transition= function(session, state, transition, msg ) {
        console.log("transition "+transition.toString());
    };

    return this;
};

// Register one FSM model.
context.registerFSM( {
    name    : "SubStateTest",

    // in a sub state FSM a Logic object constructor function is optional

    state  : [
        {
            name    : "1",
            initial : true,
            onEnter : "enter",
            onExit  : "exit"
        },
        {
            name    : "2",
            onEnter : "enter",
            onExit  : "exit"
        },
        {
            name    : "3",
            onEnter : "enter",
            onExit  : "exit"
        }
    ],

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

// register another FSM model

context.registerFSM( {

    name    : "Test4",
    logic   : Logic,

    state  : [
        {
            name    : "a",
            initial : true,
            onEnter : "enter",
            onExit  : "exit"
        },
        {
            name    : "b",
            onEnter : "enter",
            onExit  : "exit"
        },
        {
            subState: "SubStateTest"
        },
        {
            name    : "c",
            onEnter : "enter",
            onExit  : "exit"
        }
    ],

    transition : [
        {
            event       : "ab",
            from        : "a",
            to          : "b",
            onTransition: "transition"
        },
        {
            event   : "bc",
            from    : "b",
            to      : "SubStateTest",
            onTransition: "transition"
        },
        {
            event   : "cd",
            from    : "SubStateTest",
            to      : "c",
            onTransition: "transition"
        }
    ]
} );

var session= context.createSession("Test4");
session.processMessage( { msgId : "ab" } );
session.processMessage( { msgId : "bc" } );

// The session is now in State-1 on STest FSM.
session.printStackTrace();

// The stack trace is:
//   Test4
//   SubStateTest
//   1

session.processMessage( { msgId : "cd" } );

// Although neither State-1 on SubStateTest, nor SubStateTest have a transition to "cd", Automata's engine traverses
// current Session's stack trace upwards trying to find a suitable State with an exit transition to "cd". In this case,
// SubStateTest itself consumes the transition, meaning the last Session's context will be poped out and the control flow
// will be transitioning from SubStateTest to State-c.

// After that call, the session will be empty, since State-c is final, and every context is poped out the session.
session.printStackTrace();

// prints: session empty.

```