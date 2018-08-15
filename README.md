## Automata

A finite state machine framework.

Supports:

+ declarative definition
+ nested states
+ internal/external transitions
+ guards

### Why

Switch/Case blocks, or even worse, logic stored in multiple variables are a poor design choice.
Automata brings in logic control by managing your system's complexity automatically. 
The idea is simple: Automata enforces code organization by convention, and handles the
logic behind state change in a simple event-based protocol.

The result is deterministically predictable execution of code for the same starting conditions.
Or put it another way: reach the same bugs for the same initial conditions and sequence of events. 

### Example how-to:

```typescript
// define an automata.
const json: FSMCollectionJson = [
    {
        name    : "Test",           // FSM name
        state  : ["a","b","c"],
        initial: "a",
        transition : [
            {
                event       : "ab",
                from        : "a",
                to          : "b",
            },
            {
                event   : "bc",
                from    : "b",
                to      : "c",
            }
        ]

    }
];

// register automata definition for later reference.
FSMRegistry.Parse(json);

// get a session for a given automata.
const session = FSMRegistry.SessionFor("Test");

// let the system handle complexity.
session.dispatch("ab"); // change state A to B
session.dispatch("ef"); // discard this message. State B has no 'ef' transition
session.dispatch("bc");
```

### Automata components

#### FSM, States and transitions

In Automata, a FSM is an immutable entity, so are the states and transitions that conform it.
It is just a directed graph of nodes (`States`) connected by `Transitions`.

These are defined in the simplest JSON format possible:

```
{
  name    : string;   // automata name
  state   : string[]; // state names
  initial : string;   // initial state name.
  transition : {
    event : string;     // event triggering state change
    from  : string;     // from state name 
    to    : string;     // to state name
  }[]                 // array of transition
}
``` 

#### State entry/exit and Transition Actions.

When entering or exiting an State, and when a Transition is triggered, Automata calls
function hooks associated to these events.

For example, when a Transition from `State A` to `State B` by `Event E` is triggered,
the following sequence of functions is called:

+ call `State A exit` action.
+ call `Transition E` action.
+ call `State B enter` action.

These actions are optional, and are defined in the `Session client state` object.

#### Session

The session object has two main responsibilities:
+ it keeps track of one specific internal FSM state. 
+ it keeps a reference to client state, which links `State` with an arbitrary state object.

For example, we can define an FSM for a game like Word With Friends. A session will keep
track of the internal State (e.g. changing_tiles), and the game state object, which keeps bound 
information for the board, player's tiles, etc. 

State enter/exit actions, will be functions of the form: `<state_name>_enter` and `<state_name>_exit`
respectively. Transition actions will be functions of the form: `<transition_name>_transition`.
These function are defined in the Session client state.

For example, a Session object for the previous FSM definition could be:

```typescript

// external FSM state.
// your game state, like board, player's tiles, decks, etc.
class SessionClientState {

    numPlayers = 0;

    constructor() {}

    b_enter( ctx: StateInvocationParams<SessionLogic> ) {}

    b_exit( ctx: StateInvocationParams<SessionLogic> ) {
        // guaranteed session.currentState.name==='b'
    }

    a_exit( ctx: StateInvocationParams<SessionLogic> ) {
        this.numPlayers++;
    }
    
    ab_transition( ctx: StateInvocationParams<SessionLogic> ) {}

    // not all States or Transition need their actions defined.
    // Automata will call only the existing ones.
}

// a session, binding FSM state with external state.
const session = FSMRegistry.SessionFor(
    "Test", 
    new SessionClientState()                // attach client state to automata state.
);
```
 
How you interact with the session is simple:

```typescript
session.dispatchMessage({
    event: "ab"
});

// this will invoke `a_exit`, `ab_transition`, and `b_enter` functions if any are defined in the SessionClientState object.
// if the current state does not recognize this message (defined in transitions block of the FSM),
// this dispatch has no effect.
````

#### Nested states

In Automata, FSM are States by definition.
Nested `State` mean that a  given FSM state, can refer another FSM. 
To keep this structure a `Session` object keeps an stack of states called `SessionContext`.
Even the most basic `Session` object, like the example `Test` FSM, will have two contexts. 
If at any given time a `Session` is in `State a`, the context stack would be like:

```
    State a
    Test
```

As such, entering any FSM, triggers the following sequence of actions:

```
+ execute Test initial_Transition
+ execute Test_enter action
+ execute a_enter action
```

For each entered FSM, the `Session` will contain an additional `SessionContext`, thus keeping track of entered substates.

You can refer to another FSM in any FSM definition, by naming the State as `@<state name>`. For example:

```
const json: FSMCollectionJson = [
    {
        name: "SubStateTest",
        state: ["_1", "_2", "_3"],
        initial: "_1",
        transition: [...]
    },
    {
        name    : "Test",
        state  : ["a","b","@SubStateTest","c"],
        initial: "a",
        transition : [...]
    }
];
``` 

#### Exiting Hierarchically nested states

Entering hierarchies of States is easy, but exiting nested States can be misleading.

When transitioning, Automata will always try to find a valid `Transition` for the `current state`. 
This means that the whole stack of contexts will be checked for a valid transition.

For example, taking the previous substate stacktrace as base, to find a suitable Transition 
for current State `_1`, Automata will also check in `SubStateTest` state and `Test4` for a valid
transition. In this sample FSM definition, assuming a session for `Test4` which references
another FSM as `@Sub`: 

```
  
  +- Test4 -------------------------------------------+
  |                                                   |
  |     +---+             +------+             +---+  |
  |-->  | A |  -- ab -->  | @Sub |  -- sb -->  | B |  |
  |     +---+             +------+             +---+  |
  |                                                   |
  +---------------------------------------------------+

  +- Sub ------------------------------------------+
  |                                                |
  |     +---+             +---+             +---+  |
  |-->  | 1 |  -- 12 -->  | 2 |  -- 23 -->  | 3 |  |
  |     +---+             +---+             +---+  |
  |                                                |
  +------------------------------------------------+

```

When trying to `Transition` from `2`, by a message of type `{event:"sb"}`, automata will find
a valid transition from `@Sub -- to --> B`, resulting in the following action calls:  

+ state 2 exit
+ state Sub exit
+ transition sb
+ state B enter

#### Guards

A `Guard` is a condition associated to a `Transition` which can prevent the normal 
flow of events triggered by the transition.

They are implemented as a function in the `SessionClientState` object of the form:

`( ctx: StateInvocationParams<SessionLogic> ) => boolean`

For example, we want to have a transition from `State A`, to `State B` by `Transition AB`
if the guard function returns false, the Transition is prevented, and instead of a 
`A -> Transition -> B`, the execution flow would be: `A -> Transition -> A`.
This important fact is indicated in the `StateInvocationParams` object, by having is optional
variable `guarded` set to true.

#### Local vs External transitions 

FSM interaction happen primarily by calling `dispatchMessage` which dispatchs a message to a `Session` object.
Each dispatched message, generates an internal messages queue, where internal messages can be queued.
When a given FSM `Action` needs to post a message it must use `postMessage`. Posted messages will
be queued in the current execution unit, before `dispatched` messages. This way, an auto-transition
can happen safely.
An `Action` can as well `dispatchMessage` at any time, but the difference is clear: dispatched messages
will be queued after all previously dispatched messages w/o any guarantee of order of execution.

It is important to note that all messages, dispatched or posted, run in the context of `setImmediate`
calls. This has important implications like the fact that `dispatchMessage` is
fully asynchronous. It accepts a second parameter to get notifications of when
the message has been fully consumed. This is specially important when a given FSM Action, posts new
messages to be consumed in the same unit of execution.

The full `dispatchMessage` signature is:

```
session.dispatchMessage(
    {"event":"ab"}, 
    new SessionConsumeMessagePromise<SessionClientState>().then(
        (session: Session<SessionLogic>, message?: Message) => {
            // event succesfully fully consumed (all post messages included)
        },
        (session: Session<SessionLogic>, error?: Error) => {
            // event fully consumed (all post messages included).
            // there was an error in execution.
        }
    )
);
        
```

Also note that all events sent to Automata, execute in a `try/catch` block. The catch error will be
notified to the error function of the optional consumption execution promise.

### Session serialisation

By default, a Session serializes its FSM definition, and its internal state.
There's no way for Automata to know what parts of the ClientState are transient of how to
serialise them, so it delegates this step to the `ClientState` developer.

If the `ClientState` has a method `serialize`, it will be invoked and its result saved next to 
the `Session` serialization information.

Serialization process would then just be:

`const serialized_session = session.serialize()`

Analogously, deserialization of a `Session` object needs a `ClientState` builder function.
The call to have a fully fresh session built from a serialized object would be:

```
const session2 = Session.Deserialize(
    serialized_session, 
    (data: any) : SessionLogic => {
        // data is the serialized client state. 
        return new SessionClientState(data);
    });
```

The session serializes the FSM needed to build it, w/o polluting the FSM Registry.
The idea is to be self contained, so a `Session` knows how to restore its internal state.

### Session observers

While `Session` objects actions are choreographed by Automata framework, it is interesting to
know about certain important Session events.

The full creation of a session function call is:

```
Registry.SessionFor( 
    "Test4",                // a registered FSM
    new ClientState(),      // a client State object
    session_observer        // an optional session observer.
);
```

`SessionObserver` is of the form:
 
```
export interface SessionObserver<T> {

    // session finished. can't accept any other messages.
    finished(session: Session<T>);

    // session has fully processed the init event.
    // see Local vs External transitions.
    ready(session: Session<T>, message: Message|Error, isError: boolean);

    // the session changed State. Autotransitions and guarded transitions 
    // also notify this method.  
    stateChanged(session: Session<T>, from: string, to: string, message?: Message);
}
``` 

### FSM Registry

The `Registry` keeps FSM definitions and allows to create multiple sessions for the same FSM.
Serialized sessions don't add new FSM entries to the `Registry`.

To add new FSM definitions, you just call

`Registry.Parse( FSMJson[] );`

FSMJson definition is as follows:

```
export interface TransitionJson {
    from: string;
    to: string;
    event: string;
}

export interface FSMJson {
    name: string;
    state: string[];
    initial: string;
    transition: TransitionJson[];
}
```

Once registered, obtaining a session is quite simple:

`Registry.SessionFor<T>(s: string, state: T, observer?: SessionObserver<T>)`

e.g.

```
Registry.SessionFor( 
    "Test4",                // a registered FSM
    new ClientState()      // a client State object
);
```

### Examples

Going directly to the complex example.
I include the FSM definition of one of my multiplayer games, a full clone of Scrabble/Word with friends
type of games.