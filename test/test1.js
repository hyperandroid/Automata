/**
 * @author Ibon Tolosana, @hyperandroid
 *
 * See LICENSE file.
 *
 *
 *
 * Sample 1 - Simple FSM
 *
 * This sample shows how to define common FSM session callback points.
 * Either on logic object, or by defining a callback.
 * In both cases, 'this' is defined to be the session's logic object.
 *
 */

context= require("automata");

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
    ],

    onEnter : function( session, state, transition, msg ) {
        console.log(" --> FSM enter");
    },

    onExit : function( session, state, transition, msg ) {
        console.log(" --> FSM exit");
    }
} );

var session= context.createSession("Test1");
session.dispatch( { msgId: "ab" } );

var session2= context.createSession("Test1");
session2.dispatch( { msgId: "ab" } );