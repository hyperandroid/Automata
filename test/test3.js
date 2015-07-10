/**
 * @author Ibon Tolosana, @hyperandroid
 *
 * See LICENSE file.
 *
 *
 *
 * Sample 3 - Guards
 *
 * This sample shows how transition guards work on Automata. To fire a transition, first of all an optional **pre-guard**
 * function is tested. If this function throws an exception, Automata interprets a veto on this transition fire. During
 * pre-guard stage, a veto means transition disposal, so no auto-transition is performed. This is useful for example, in
 * a multiplayer game where while playing, a user abbadons the game and the game can continue playing. So instead of
 * transitioning from State-playing to State-EndGame, a guard can decide to veto the transition.
 *
 * By definition, a guard **should not** modify the model, in this case, a Logic object.
 *
 * In the example, the guard will fail two times until the count reaches 3.
 * At this moment, the transition is fired (its onTransition method is executed if exists), and after that,
 * the **post-guard** condition is checked. PostGuard semantics are completely different.
 * After firing the transition, the postGuard is checked. If this function **throws an exception** the transition
 * turns into auto-transition, that means firing state change to current-state, and entering again current state.
 * If not, the transition continues its natural flow and transition's next state is set as current state.
 */

context= require("automata");


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
