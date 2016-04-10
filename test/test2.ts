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

Automata.RegisterFSM( {

    name    : "Test2",
    state  : ["a","b","c"],
    initial_state : "a",
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
        {
            event   : "bc",
            from    : "b",
            to      : "c"
        }
    ]
} );

let __index= 0;

class Controller {

    name : string;

    constructor( n : string ) {
        this.name = n || "controller_"+__index++;
    }

    a_enter( session : Session<Controller>, state : string, msg : Message ) {
        console.log(this.name+" "+state+" enter ");
    };

    a_exit( session : Session<Controller>, state : string, msg : Message ) {
        console.log(this.name+" "+state+" exit ");
    };

    b_enter( session : Session<Controller>, state : string, msg : Message ) {
        console.log(this.name+" "+state+" enter ");
    };

    b_exit( session : Session<Controller>, state : string, msg : Message ) {
        console.log(this.name+" "+state+" exit ");
    };

    c_exit( session : Session<Controller>, state : string, msg : Message ) {
        console.log(this.name+" "+state+" exit");
    };

    c_enter( session : Session<Controller>, state : string, msg : Message ) {
        console.log(this.name+" "+state+" enter");
    };

    ab_transition( session : Session<Controller>, state : string, msg : Message ) {
        console.log(this.name+" "+"transition: "+msg.msgId);
    };

    bc_transition( session : Session<Controller>, state : string, msg : Message ) {
        console.log(this.name+" "+"transition: "+msg.msgId);
    };

    Test2_enter( session : Session<Controller>, state : string, msg : Message ) {
        console.log(this.name+" "+state+" enter ");
    };

    Test2_exit( session : Session<Controller>, state : string, msg : Message ) {
        console.log(this.name+" "+state+" exit ");
    };
}

Automata.CreateSession( new Controller("c1"), "Test2" );
Automata.CreateSession( new Controller("c2"), "Test2" ).then(
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

