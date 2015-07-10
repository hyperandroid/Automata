#Automata - A finite state machine framework.

Current state of automata is version 2.x.x, which is not backward compatible with 1.x.x.

##Description

Automata is a formal finite state machine (FDA) framework.
It aims at offering a totally decoupled management of logic and data storage.
It features all the needed elements to have a modern and flexible
finite state machine framework like

* FDA registry
* Timed transitions
* Auto transition
* Sub states
* Guards
* FDA Session as message chroreographer
* Asynchronous execution

##How to

Automata works on browsers or Node and has no dependencies.

### To get it:

* npm install automata
or
* include automata.js script file

Automata will then expose an object with some functions:

```javascript
module.exports= {
 registerFSM,           // register a FDA object.
 registerFDA,           // same as registerFSM
 createSession,         // create a session for an FDA
 guardException,        // create a guard exception
 newSessionListener     // create a session listener overriding methods with the parameter object.
}
```

Or typescript definition:

```typescript
declare module Automata {

    export function registerFSM( object:FSM.FSMDefinition );
    export function registerFDA( object:FSM.FSMDefinition );
    export function createSession( fda_name : string, controller : any ) : FSM.Session;
    export function newGuardException( message : string ) : FSM.GuardException;
    export function newSessionListener( obj : any ) : FSM.SessionListener;

}
```

##How it works

In Automata, FDA (finite deterministic automaton) are declaratively defined. It is contstrained to `FSMDefinition`
object.
The Automata definition will be unique, and different execution `Session` objects will be created from there.
Think of the FDA as the class, and the `Session` as the object. 
For example, an FDA defines a Scrabble game. The sessions will be specific Scrabble games. Sessions keep track 
of the current State as well as per-session Data associated with a session controller object. This controller is an
arbitrary object you supply at session creation time.

So, first of all, one or more FDA must be registered in the system by calling either registerFSM (
register finite state machine) or registerFDA (register finite deterministic automaton). Both methods do the same, but
 I'd rather call `registerFDA`.
In the FDA definition one State must be labeled as initial. This will be the entry point. 

An example minimal state machine could be:

```javascript
fsmContext.registerFSM( {

    // FDA registry name
    name    : "Test",

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

Only one State must be labeled as `initial`.
To start using this machine, a `Session` must be created from a registered FDA. For example:

```javascript

// ControllerObject is an object that holds per-session data and FDA's activity function callbacks. 
// Will come to it later.
var session= fsmContext.createSession("Test", new SessionController() );

// The session must ultimately be started in order to track FDA's activity:
session.start();

```

To send notification events to a session object, call consume method:

```javascript
session.consume( { msgId: "12" } ); 
```

This is the most basic workflow, but some things must be taken into account:

### Why create a session then start ?

Session creation may internally trigger state changes.
If you want to have a `SessionListener` object registered to track all these state changes, the `Session` lifecycle must
be spanned in two different stages.

```javascript

var session= fsmContext.createSession( ... );
session.addListener( {
  ...
} );

session.start( function(session) {
  // session started
});
```

### Why a callback to `start` session or `consume` ?

As we said before, a `Session` creation may internally trigger state changes. 
For example, an FDA definition states that when entering its initial state, a message will be consumed which will fire
a transition from state 'initial' to another one. 
Since Automata's execution is fully asynchronous, by the time the call to `start` or `consume` ends, you definitely 
can't be sure whether the session ended starting or not.
The callback is guaranteed to be notified when `start` or `consume` methods and all internally triggered state changes 
end.

Another thing to note is that is will be fully safe to call `consume` right after ending a previous `consume` or 
`start` method call. Automata treates user issued `consume` calls differently than `consume` calls triggered by a
state or transition action execution.

### FDA messages

The `consume` method accepts as a valid message any object which conforms to the typedef `FSM.TransitionMessage`
which has the following form:

```json
{
  msgId : string,
  data? : object
}
```

msgId's values must be the value defined in the **event** attribute present in the Transition
 FDA definition block.

A session accepts messages until it has reached a final State. From then and beyond, the session will
toss exceptions if it has a message sent for consumption.

### Session execution

Until Automata V2, all session messages where synchronously consumed.
From V2, all messages are **asynchronously** consumed, which renders Automata V2 incompatible with Automata V1.X.
The synchronous consumption led to some unexpected problems like deep execution stack traces that could led to stackoverflow
errors.
In order to avoid execution callback errors, Automata V2 creates internal message queues. They work as follows:

* for each user called `session.consume(callback)` method, a new message queue will be created. This queue will not be
 executed until all the previous message queues (user issued session.consume calls) end processing their messages.
* for each framework called `session.consume(callback)` method, a new message will be added to the current message queue.
Framework consume calls happen in the controller object, when the FDA callbacks get executed.

When a message queue gets empty, the callback gets called.

## Controller object

The FDA logic and state are isolated. The developer supplies a custom FDA controller object when the `Session` is
created.
The `controller` object contains per session data, like for example the cards dealt in game, the authorization credentials,
or any other Session specific information. It also has callback functions for FDA specific hook points like 
entering/exiting a `State` or executing a `Transition`.

For both, State and Transitions, the calling **this** scope will be the logic object itself.

## Activy hooks

Automata offers many activy hooks on its activity. The following hooks are available:

State and FDA:

  * **onEnter**. Code fired on state enter.
  * **onExit**. Code fired on state exit.


Transition:

  * **onTransition**. Code fired when the transition fires.
  * **onPreGuard**. Code fired on transition fire but previously to onTransition. It can veto transition fire.
  * **onPostGuard**. Code fired after onTransition execution. Could veto transition fire by issuing an auto-transition.

A natural transition flow of executed actions for a transition from StateA to StateB will be:

```
StateA.onExit() -> Transition.onTransition() -> StateB.onEnter()
```

Those hooks are defined in the **FDA JSON** definition as in the example:


```javascript
/**
 * Define a session controller object.
 * @constructor
 */
function controller() {

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
 * Define a FDA
 */
 fsmContext.registerFSM( {

     // FDA registry name
     name    : "Test",

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

 var session= fsmContext.createSession("Test", new controller());
 
 session.start( function(session) {
    session.dispatch( { msgId: "AB" } );
     // this will print:
     //  Exit state A
     //  Transition fire code
     //  Enter state B
 });
 
```

The controller object can be notified automatically about Session changes in two different ways:

* Configuration: supply callback functions in the FDA definition object.
* Convention: the framework will automatically try to find methods in the controller object as follows:

* * State enter:            state.getName() + "_enter" 
* * State exit:             state.getName() + "_exit" 
* * Transition fire:        transition.getEvent() + "_transition" 
* * Transition pre-guard:   transition.getEvent() + "preGuard" 
* * Transition post-guard:  transition.getEvent() + "postGuard" 

State and Transition activity callbacks are of the form:

```javascript
function( session, state, transition, msg );
```

In any case, those functions will be automatically called if they exist in the logic object.

##Guards

Guards prevent a transition from being fired. In Automata there are two available guard points out of the box.
One on preTransitionFire and the other on postTransitionFire.
The difference is straight:

 * The **pre-transition guard**, if fired, aborts the transition firing procedure as if it had never occurred.
   That means, that neither the onExit function, nor a self transition event will be fired by the engine.
   A good usage of this situation is for counting states. For example, in a multi-player game where 3 players
   must be present to start the game, a transition from state WaitPlayers to state StartGame will be defined.
   The pre-transition guard will allow to set a count up, so that whenever a new player enters the game, the
   count increments, and will fail until the desired amount is reached. This procedure won't affect the state
   machine, nor its observers.
 * The **post-transition guard**, if fired, makes the transition behave as a self-transition trigger.
   For a Transition form State A to State B, a post-transition-guard would fire the following
   action sequence: Exit_State_A, Transition Fire, Enter_State_A. As opposed to Exit_State_A, Transition Fire, Enter_State_B.

A natural transition flow of executed actions for a transition from StateA to StateB with preGuard and postGuard actions
will be:

```
if preGuard throws guard-exception
    // nothing will happen
    nil;
else
    if postGuard throws guard-exception
        // auto-transition. State change to StateA will be notified to observers.
        StateA.onExit -> transition.onTransition -> StateA.onEnter
    else
        // this is the regular execution path for a non-guarded transition. State change to
        // StateB will be notified to observers.
        StateA.onExit -> Transition.onTransition -> StateB.onEnter
    endif
endif
```

 The way to instrument the engine that a guard veto has been fired, will be by throwing an exception from the
 pre/post-transition functions. A Guard is expected to throw a GuardException object by calling
  `transition.createThrowable` method or `module.newGuardException`.
 Those functions are optional, and must be set in the "transition" block of the
 FDA definition as follows:

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

 If no onPreGuard/onPostGuard attributes are specified, Automata FDA engine will assume a call to a convention method
 of the form:

 ```
 <event>_preGuard / <event>_postGuard.
 ```

 In this case:
 * AB_preGuard
 * AB_postGuard


##Timed transitions

Automata offers out of the box timed transitions by defining an **onTimer** block in a FDA definition. For example:

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

This instruments the engine that after 2 seconds of entering this state, an event {msgId: "12"} will be sent to the 
FDA session. The timer is handled automatically, and set/canceled on state enter/exit respectively.
The timers are checked every 200 milliseconds by the unique instance of FSMContext object. Thus, if you need to have
less than 200ms timers, you may want to change TIMER_CHECK_RESOLUTION in the automata.js file.

##SubStates

Automata allows to nest as much as needed substates. In fact, by defining a single FDA, the engine stacks two levels,
one for the FDA, and the other, initially for the FDA's initial state. To define different levels, you must
register more than one FDA in the registry, and then reference one of them as a substate in the "state" section:

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

Then, the transition section will identify this FDA as a substate by its name, STest. A "subState" can't have a
 regular name, nor onEnter/onExit functions. The name is the one of the FDA itself, and the activity hooks are
 overridden to do the stacking.

 The stacking of different subStates is done transparently, and they are handled by the "session" object. For each
 stacked level, a FDA.Context object is created. A context object is just a holder for the current state for each 
 nesting level.

##Transition from Substates

The way in which Automata manages state changes is made hierarchycally. That means, the engine will try to find a
suitable transition for a given incoming message regardless of its nesting level.
So for any given FDA stacktrace, the engine will traverse upwards trying to find a suitable state to fire a
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
session.consume( {msgId : "T_S1_S2" } );
```

means the session is on state SS1, and the stackTrace will be the following:

ROOT, SUB_STATE, SS1

By calling
```javascript
session.consume( {msgId : "T_SS_S3" } );
```

on the session at state SS1, SS1 will be removed from the stack (since SS2 is a final state), and the session will
transize to S3 state.
Additionally, this session will be finished since S3 is a final State (this nesting level will be removed from the stack too),
and so it is ROOT, which causes the session to be emptied.


##FDA listeners

Any FDA session activity can be monitored by adding a listener.
For example:

```javascript
session.addListener( new FDA.SessionListener() );
```

or

```javascript

// create a SessionListener and override the methods with the one in the parameter supplied.
session.addListener( module.newSessionListener( {
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
    } 
) );
```

The obj parameter for each listener object function contains the following parameters:

* **contextCreated**: FSM.SessionContextEvent
* **contextDestroyed**: FSM.SessionContextEvent
* **finalStateReached**: FSM.SessionFinalStateReachedEvent
* **stateChanged**: FSM.SessionStateChangeEvent
* **preGuard**: FSM.TransitionGuardEvent
* **postGuard**: FSM.TransitionGuardEvent
* **customEvent**: FSM.CustomEvent

##Custom events

The preferred way for sending custom events will be by calling:
```javascript
session.fireCustomEvent( a_json_object );
```

and have a listener/observer object attached to the sending FDA session.
This method will be notified on the method

```javascript
customEvent         : function( ev : FSM.CustomEvent ) {
```

#Samples

##Sample 1 - Simple FDA

This sample shows how to define common FDA session callback points. Either on logic object, or by defining a callback.
In either case, **this** is defined to be the session's logic object.

```javascript

context= module.exports;

var Controller= function() {

    this.a_enter= function( session, state, transition, msg ) {
        console.log("a enter "+state.toString());
    };

    this.a_exit= function( session, state, transition, msg ) {
        console.log("a exit "+state.toString());
    };

    this.b_enter= function( session, state, transition, msg ) {
        console.log("b enter "+state.toString());
    };

    this.b_exit= function( session, state, transition, msg ) {
        console.log("b exit "+state.toString());
    };

    this.c_exit= function( session, state, transition, msg ) {
        console.log("c exit "+state.toString());
    };

    this.ab_transition= function( session, state, transition, msg ) {
        console.log("transition: "+transition.toString());
    };

    this.bc_transition= function( session, state, transition, msg ) {
        console.log("transition: "+transition.toString());
    };

    this.Test1_enter= function( session, state, transition, msg ) {
        console.log("test1 enter "+state.toString());
    };

    this.Test1_exit= function( session, state, transition, msg ) {
        console.log("test1 exit "+state.toString());
    };
};

context.registerFSM( {

    name    : "Test1",

    state  : [
        {
            name    : "a",
            initial : true
        },
        {
            name    : "b"
        },
        {
            name    : "c",
            onEnter : function( session, state, transition, msg ) {
                console.log("Enter c");
            }
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

var session= context.createSession({
    fda: "Test1",
    controller: new Controller()
} );
session.start( function onStartProcessEnds(session) {
        session.consume( { msgId: "ab" } );
        session.consume( { msgId: "bc" } );
    }
);


```

##Sample 2 - FDA with timed events

This sample show how to define a timed transition. Note this example has no FDA Controller.

```javascript

context= module.exports;


context.registerFSM( {

    name    : "Test2",

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

var session1= context.createSession({
    fda: "Test2"
});
session1.start();

var session2= context.createSession({
    fda : "Test2"
} );

session2.start();
session2.consume( {msgId : "ab"} );

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

*/

```

## Sample 3 - Guards

This sample shows how transition guards work on Automata. To fire a transition, first of all an optional **pre-guard**
function is tested. If this function throws an exception, Automata interprets a veto on this transition fire. During
pre-guard stage, a veto means transition disposal, so no auto-transition is performed. This is useful for example, in
a multiplayer game where while playing, a user abandons the game and the game can continue playing. So instead of
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


var Controller= function() {

    this.count= 0;

    this.enter_b= function() {
        console.log("enter b");
    };

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
            throw context.newGuardException("PreGuard_tr_BC");
        } else {
            console.log("Ok, go.");
        }
    };

    this.post_guard_tr_bc= function() {
        this.count++;
        console.log("count= "+this.count);
        if ( this.count<5 ) {
            throw context.newGuardException("PostGuard_tr_BC");
        }
    };

    return this;
};

context.registerFSM( {

    name    : "Test3",

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

var session= context.createSession({
    fda: "Test3",
    controller: new Controller()
});

session.addListener( context.newSessionListener( {
    finalStateReached   : function( obj ) {
        console.log("SessionListener finalStateReached " );
    },

    /**
     *
     * @param obj {FSM.SessionStateChangeEvent}
     */
    stateChanged        : function( obj ) {
        var ps= obj.prevState ? obj.prevState.getName() : "none";
        console.log("SessionListener stateChanged "+ps+" --> "+obj.state.getName() );
    }
} ) );

// start session.
session.start();

console.log("");
console.log("Sent 'ab'");
session.consume( { msgId: "ab" } );

// fail on pre-guard. count=1, but no notification of state change sent.
console.log("");
console.log("Sent 'bc'");
session.consume( { msgId: "bc" } );

// fail on pre-guard. count=2, but no notification of state change sent.
console.log("");
console.log("Sent 'bc'");
session.consume( { msgId: "bc" } );

// on pre-guard. count=3.
// Ok go transition.
// Fail on post-guard
// so onExit State-b and onEnter State-b ( auto-transition ). Vetoed transition from State-b to State-c.
// notification of 'stateChanged' on the observer.
console.log("");
console.log("Sent 'bc'");
session.consume( { msgId: "bc" } );

console.log("");
console.log("Sent 'bc'");
session.consume( { msgId: "bc" } );

```


## Sample 4 - SubStates

Sub States is an Automata feature which allows to nest different registered FDA as states of other FDA.
The mechanism is straightforward, just define a **substate** block in an FDA **state** definition block.
Automata will handle automatically all the nesting procedure, call the FDA action hooks and set the system's new
current state.

A substate, or a FDA does not define neither onEnter nor onExit function callbacks.

It is done as follows:

```javascript

var context= module.exports;


var Controller= function() {

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
    ],

    onExit : function() {
        console.log("  --> Exit sub-automata SubStateTest");
    },

    onEnter : function() {
        console.log("  --> Enter sub-automata SubStateTest");
    }

} );

// register another FSM model

context.registerFSM( {

    name    : "Test4",

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
    ],

    onExit : function() {
        console.log("  --> Exit automata Test4");
    },

    onEnter : function() {
        console.log("  --> Enter automata Test4");
    }

} );

var session= context.createSession({
    fda : "Test4",
    controller : new Controller()
});

session.start( function(session) {

    session.consume({msgId: "ab"});
    session.consume({msgId: "bc"}, function () {

        // The session is now in State-1 on STest FSM.
        session.printStackTrace();

        // The stack trace is:
        //   Test4
        //   SubStateTest
        //   1

        session.consume( { msgId : "cd" }, function() {

            // Although neither State-1 on SubStateTest, nor SubStateTest have a transition to "cd", Automata's engine traverses
            // current Session's stack trace upwards trying to find a suitable State with an exit transition to "cd". In this case,
            // SubStateTest itself consumes the transition, meaning the last Session's context will be poped out and the control flow
            // will be transitioning from SubStateTest to State-c.

            // After that call, the session will be empty, since State-c is final, and every context is poped out the session.
            session.printStackTrace();

            // prints: session empty.
        } );

    });

});

```
