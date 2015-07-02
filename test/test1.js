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
    logic   : Logic,

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

var session= context.createSession("Test1");
session.consume( { msgId: "ab" } );
session.consume( { msgId: "bc" } );

