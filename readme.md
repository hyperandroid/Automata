# Automata - A finite state machine framework.

Current state of automata is version 2.x.x, which is not backward compatible with 1.x.x.

## Description

Automata is a formal finite state machine (FDA) framework.
It aims at offering a totally decoupled management of logic and data.
It features all the needed elements to have a modern and flexible
finite state machine framework like

* FDA registry
* Timed transitions
* Auto transition
* Sub states
* Guards
* FDA Session as message chroreographer
* Asynchronous execution

## How to

Automata works on browsers or Node and has no dependencies.

### To get it:

* npm install automata
or
* include automata.js script file

Automata will then expose an object with some functions:

#### Typescript
```typescript
export class Automata {
    static RegisterFSM( file : string|FSMJson );
    static CreateSession<T>( controller : T, fsm_name : string, o? : SessionObserver<T> ) : SessionConsumeMessagePromise<T>;
}
```

#### Javascript
```javascript
{
    Automata : {
        CreateSession(controller, name, session_observer?),
        RegisterFSM( automata_def )
    }
}
```

## How it works

In Automata, FDA (finite deterministic automaton) are declaratively defined. Their definition can be found in `FSMDefinition` object.
The Automata definition will be unique, and properly registered in an internal registry.
`Session` objects will be created from the automata. Think of the FDA as the class, and the `Session` as the object.
 
For example, an FDA defines a Scrabble game. The sessions will be specific Scrabble games. Sessions keep track 
of the current State as well as per-session Data associated with a session controller object. This controller is an
arbitrary object you supply at session creation time.

A minimal example state machine could be:

```javascript
Automata.RegisterFSM({
    name :          "Test1",
    state :         ["a","b","c"],
    initial_state : "a",
    transition :    [
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
});
```

To start using this machine, a `Session` must be created from a registered FDA. For example:

```typescript

const Controller = (function () {
    function Controller() {
    }
    Controller.prototype.a_enter = function (session, state, msg) {
        console.log(state + " enter ");
    };
    ;
    Controller.prototype.a_exit = function (session, state, msg) {
        console.log(state + " exit ");
    };
    ;
    Controller.prototype.b_enter = function (session, state, msg) {
        console.log(state + " enter ");
    };
    ;
    Controller.prototype.b_exit = function (session, state, msg) {
        console.log(state + " exit ");
    };
    ;
    Controller.prototype.c_exit = function (session, state, msg) {
        console.log(state + " exit");
    };
    ;
    Controller.prototype.c_enter = function (session, state, msg) {
        console.log(state + " enter");
    };
    ;
    Controller.prototype.ab_transition = function (session, state, msg) {
        console.log("transition: " + msg.msgId);
    };
    ;
    Controller.prototype.bc_transition = function (session, state, msg) {
        console.log("transition: " + msg.msgId);
    };
    ;
    Controller.prototype.Test1_enter = function (session, state, msg) {
        console.log(state + " enter ");
    };
    ;
    Controller.prototype.Test1_exit = function (session, state, msg) {
        console.log(state + " exit ");
    };
    ;
    return Controller;
}());


Automata.CreateSession(
    new Controller(),
    "Test1"
).then(
    function success( s : Session<Controller>, m : Message ) {
        // session has been created and the controller object correctly attached.
    },
    function error( s : Session<Controller>, m : Error ) {
        // something went wrong.
    }
);
```

To send notification events to a session object, call dispatchMessage method:

```typescript
session.dispatchMessage( { msgId: "12" } ); 
```

This is the most basic workflow, but some things must be taken into account:

### Why create a session then success. Can't it be a synchronous call ?

Session creation may internally trigger state changes, so you never may be sure what Transition or State code defined
in the Controller object will do. Also, you can dispatch a message to a session that is currently executing other dispatched
 messages, or there may be a few other messages queued for the session.
By nature, dispatching a message is totally asynchronous.

### How can i be notified of all FSM activity.

You can be notified of all the FSM activity bound to a `Session` by attaching an observer to the `Session` object.
Since starting a `Session` may trigger internal state changes, you may want to pass the listener as the third optional
parameter of type `SessionObserver<T>` to `Automata.CreateSession` like:

```typescript
Automata.CreateSession(
    new Controller(),
    "Test1",
    {
        contextCreated   : ( e : SessionObserverEvent<T> ) => {},
        contextDestroyed : ( e : SessionObserverEvent<T> ) => {},
        sessionEnded     : ( e : SessionObserverEvent<T> ) => {},
        customEvent      : ( e : SessionObserverEvent<T> ) => {},
        stateChanged     : ( e : SessionObserverEvent<T> ) => {}    
    }
).then(
    function success( s : Session<Controller>, m : Message ) {
        // session has been created and the controller object correctly attached.
    },
    function error( s : Session<Controller>, m : Error ) {
        // something went wrong.
    }
);
```

or Attach a listener at a later time by calling

```typescript
session.addObserver( ... )
```

### FDA messages

The `session.dispatchMessage` and `session.postMessage` methods accepts as a valid message any object which conforms to 

```json
{
  msgId : string,
  data? : object
}
```

msgId's values must be the value defined in the **event** attribute present in the Transition
 FDA definition block. So, for a given `State`, a call to `session.dispatchMessage` will match an exit transition with
 the passed-in message. 
 
* If found, it  will start the process of State transition.
* If not found, the message will be discarded by notifying an Error of `unknown exit transition for State 's'`

A session accepts messages until it has reached a final State. From then and beyond, the session will
toss Errors any message is dispatched or posted to it.

### Dispatch vs Post message.

A session exposes two well defined method to interact with it.

`session.postMessage`, is expected to by the internal submission point of messages for a given Session. Controller methods
 that wanted to trigger a State change request must call this method.

`session.dispatchMessage`, is expected to be the external submission point of messages for a given Session. Each call to 
`dispatchMessage` will create an internal messages queue. This queue will be fed with all the internal State change 
requests, which means `postMessage` will add messages to the currently executing Session's messages queue.

The signature for `postMessage` is:

`postMessage( m : Message )`

while the signature for `dispatchMessage` is:

`dispatchMessage<U extends Message>( m : U ) : SessionConsumeMessagePromise<T>` or in javascript> `dispatchMessage( message ) : SessionConsumeMessagePromise`
The promise-like object returned by dispatchMessage will be invoked when the associated messages queue gets empty.
This brings a level of execution isolation where once a message has been dispatched, all activity derived from it will
be treated as an asynchronous atomic operation. It is thus guaranteed that this object will be notified only after all 
internal transitions have ended. 

## Controller object

The FDA logic and state are isolated. The developer supplies a custom FDA controller object when the `Session` is
created.
The `controller` object contains per session data, like for example the cards dealt in a game, the authorization credentials,
or any other Session specific information. It also has callback functions for FDA specific hook points like 
entering/exiting a `State` or executing a `Transition`.

For both, State and Transitions, the calling **this** scope will be the logic object itself.

## Activy hooks

Automata offers many activity hooks:

State and FDA:

  * **_enter**. Code fired on state enter.
  * **_exit**. Code fired on state exit.


Transition:

  * **_transition**. Code fired when the transition fires.
  * **_preGuard**. Code fired on transition fire but previously to onTransition. It can veto transition fire.
  * **_postGuard**. Code fired after onTransition execution. Could veto transition fire by issuing an auto-transition.

A natural transition flow of executed actions for a transition from StateA to StateB will be:

```
// For an automata defined as follows:

...
state : ['a', 'b', 'c'],
initial_state : 'a',
transition : [
  {
    from : 'a',
    to : 'b',
    event : 'ab'
  }
]
...

StateA.onExit() -> Transition.onTransition() -> StateB.onEnter()

// which translate into the following Controller methods (should they exist)

a_exit( ... );
ab_transition( ... );
b_enter( ... );

```

The controller object can only be notified automatically about Session changes  by Convention: 
the framework will automatically try to find methods in the controller object as follows:

* * State enter:            state.getName() + "_enter" 
* * State exit:             state.getName() + "_exit" 
* * Transition fire:        transition.getEvent() + "_transition" 
* * Transition pre-guard:   transition.getEvent() + "_preGuard" 
* * Transition post-guard:  transition.getEvent() + "_postGuard" 

State and Transition activity callbacks are of the form:

```javascript
( session : Session<Controller_Type>, 
  state : string, 
  msg : Message ) => void;
```
Those functions will be automatically called **only if** they exist in the logic object.

## Guards

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
 pre/post-transition functions. A Guard is expected to throw an Error object by calling.
 
 Guards are optional, and will be invoked only if they exist in the Controller object. The method names must be of the form:

 ```
 <event>_preGuard / <event>_postGuard.
 ```

Event is the 'event' defined in the FSM definition transition block.

## Timed transitions

Automata offers out of the box timed transitions by defining an **timeout** block in a transition definition block. For example:

```javascript
 fsmContext.registerFSM( {

    ...,

    transition : [
        {
            event       : "ab",
            from        : "a",
            to          : "b",
            timeout     : {
                millis : 4000,
                data   : {}
            }
        },
    ...

 } );
 ```

This instruments the engine that after 4 seconds of entering `state a`, an event `{msgId: "ab"}` will be dispatched to the 
`Session`. The timer is handled automatically, and set/canceled on state enter/exit respectively.
Timers are set by calling `setTimeout`, and automatically handled by the javascript engine.

## SubStates

Automata allows to nest as much as needed substates. In fact, by defining a single FDA, the engine stacks two levels,
one for the FDA, and the other, initially for the FDA's initial state. To define different levels, you must
register more than one FDA in the registry, and then reference one of them as a substate in the "state" section:

```typescript
// Register one FSM model.
Automata.RegisterFSM( {
    name    : "SubStateTest",
    state  : ["_1","_2","_3"],
    initial_state : "_1",
    transition : [
        {
            event       : "12",
            from        : "_1",
            to          : "_2"
        },
        {
            event       : "23",
            from        : "_2",
            to          : "_3"
        }
    ]
} );
```

To reference another Automata as substate, use the prefix `FSM:` for the state name:

```typescript

Automata.RegisterFSM( {

    name    : "Test4",
    state  : ["a","b","FSM:SubStateTest","c"],
    initial_state : "a",
    transition : [
        {
            event       : "ab",
            from        : "a",
            to          : "b",
        },
        {
            event   : "bc",
            from    : "b",
            to      : "SubStateTest",
        },
        {
            event   : "cd",
            from    : "SubStateTest",
            to      : "c",
        }
    ]
} );
```

## Transition from Substates

The way in which Automata manages state changes is made hierarchycally. That means, the engine will try to find a
suitable transition for a given incoming message regardless of its depth level.
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


For example, to a `Session` which is currently in `State S1`,

```typescript
session.dispatchMessage( {msgId : "T_S1_S2" } );
```

will make the session change state to `SS1`, and the stackTrace will be the following:

`ROOT, SUB_STATE, SS1`

By calling
```javascript
session.dispatchMessage( {msgId : "T_SS_S3" } );
```

on the session at state SS1, SS1 will be removed from the stack (since SS2 is a final state), and the session will
transize to S3 state.
Additionally, this session will be finished since S3 is a final State (this nesting level will be removed from the stack too),
and so it is ROOT, which causes the session to be emptied.

## FDA listeners

Any FDA `Session` activity can be monitored by adding one or more observers to it.
For example:

```javascript
session.addObserver( {
    contextCreated(     e : SessionObserverEvent<T> ) : void;   // fired when the Session creates a new depth level
    contextDestroyed(   e : SessionObserverEvent<T> ) : void;   // fired when the Session destroys a depth level
    sessionEnded(       e : SessionObserverEvent<T> ) : void;   // session reached one of its final states.
    customEvent(        e : SessionObserverEvent<T> ) : void;   // fire something by calling session.fireCustomEvent. 
                                                                // for example, from the Controller object 
    stateChanged(       e : SessionObserverEvent<T> ) : void;   // Session changed state (new and previous are available).

 });
```

The event parameter for the observer methods is:

```typescript
export interface SessionObserverEvent<T> {
    session :               Session<T>;
    message :               Message;
    custom_message? :       Message;
    current_state_name :    string;
    prev_state_name :       string;
}

```

## Custom events

The preferred way for sending custom events will be by calling:
```javascript
session.fireCustomEvent( a_json_object );
```

and have a listener/observer object attached to the sending FDA session.
This method will be notified on the method

```javascript
customEvent         : function( ev : FSM.CustomEvent ) {
```

# Samples

## Sample 1 - Simple FDA

This sample shows how to define common FDA session callback points. Either on logic object, or by defining a callback.
In either case, **this** is defined to be the session's logic object.

## Sample 2 - FDA with timed events

This sample show how to define a timed transition.

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

## Sample 4 - SubStates

Sub States is an Automata feature which allows to nest different registered FDA as states of other FDA.
The mechanism is straightforward, just define a **substate** block in an FDA **state** definition block.
Automata will handle automatically all the nesting procedure, call the FDA action hooks and set the system's new
current state.

A substate, or a FDA does not define neither onEnter nor onExit function callbacks.
