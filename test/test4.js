/**
 * @author Ibon Tolosana, @hyperandroid
 *
 * See LICENSE file.
 *
 * Sample 4 - SubStates
 *
 * Sub States is an Automata feature which allows to nest different registered FSM as states of other FSM.
 * The mechanism is straightforward, just define a **substate** block in an FSM **state** definition block.
 * Automata will handle automatically all the nesting procedure, call the FSM action hooks and set the system's new
 * current state.
 *
 * A substate, or a FSM does not define neither onEnter nor onExit function callbacks.
 *
 */

context= require("automata");


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
    ],

    onExit : function() {
        console.log("  --> Exit automata Test4");
    },

    onEnter : function() {
        console.log("  --> Enter automata Test4");
    }

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