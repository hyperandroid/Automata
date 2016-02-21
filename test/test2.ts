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

import {Automata,Message,Session} from "../src/automata";

context.registerFSM( {

    name    : "Test2",

    state  : ["a","b","c"],
    initial_state : "a",
    transition : [
        {
            event       : "ab",
            from        : "a",
            to          : "b",
            timeout     : 4000
        },
        {
            event   : "bc",
            from    : "b",
            to      : "c"
        }
    ]
} );

Automata.CreateSession( new Controller(), "Test2" );
Automata.CreateSession( new Controller(), "Test2" ).then(
    function success( s : Session<Controller>, m : Message ) {
        s.dispatchMessage({msgId: "ab"});
    }
);

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

