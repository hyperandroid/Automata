/**
 * @author Ibon Tolosana, @hyperandroid
 *
 * See LICENSE file.
 *
 *
 * Sample 2 - FSM with timed events
 *
 * This sample show how to define a timed transition.
 *
 */

context= require("automata");

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

