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

import {Automata,Message,Session,SessionObserverEvent} from "../src/automata";

class Controller {

    name : string;

    constructor( n : string ) {
        this.name = n;
    }

    _a_enter( session : Session<Controller>, state : string, msg : Message ) {
        console.log(this.name+" "+state+" enter ");
    }

    _a_exit( session : Session<Controller>, state : string, msg : Message ) {
        console.log(this.name+" "+state+" exit ");
    }

    _b_enter( session : Session<Controller>, state : string, msg : Message ) {
        console.log(this.name+" "+state+" enter ");
    }

    _b_exit( session : Session<Controller>, state : string, msg : Message ) {
        console.log(this.name+" "+state+" exit ");
    }

    _c_enter( session : Session<Controller>, state : string, msg : Message ) {
        console.log(this.name+" "+state+" enter ");
    }

    _c_exit( session : Session<Controller>, state : string, msg : Message ) {
        console.log(this.name+" "+state+" exit ");
    }

    _1_enter( session : Session<Controller>, state : string, msg : Message ) {
        console.log(this.name+" "+state+" enter ");
    }

    _1_exit( session : Session<Controller>, state : string, msg : Message ) {
        console.log(this.name+" "+state+" exit ");
    }

    _2_enter( session : Session<Controller>, state : string, msg : Message ) {
        console.log(this.name+" "+state+" enter ");
    }

    _2_exit( session : Session<Controller>, state : string, msg : Message ) {
        console.log(this.name+" "+state+" exit ");
    }

    _3_enter( session : Session<Controller>, state : string, msg : Message ) {
        console.log(this.name+" "+state+" enter ");
    }

    _3_exit( session : Session<Controller>, state : string, msg : Message ) {
        console.log(this.name+" "+state+" exit ");
    }

    SubStateTest_enter( session : Session<Controller>, state : string, msg : Message ) {
        console.log(this.name+" "+state+" enter ");
    }

    SubStateTest_exit( session : Session<Controller>, state : string, msg : Message ) {
        console.log(this.name+" "+state+" exit ");
    }

}

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

// register another FSM model

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

var session= Automata.CreateSession(
    new Controller("c1"),
    "Test4"
).then(

    function success( session : Session<Controller>, m : Message ) {

        session.dispatchMessage({msgId: "ab"});

        session.dispatchMessage({msgId: "bc"}).then(
            function success( s : Session<Controller>, m: Message ) {
                s.printStackTrace();
            }
        );

        session.dispatchMessage( { msgId : "cd" } ).then(
            function success( s : Session<Controller>, m: Message ) {
                s.printStackTrace();
            }
        );
    }
);

