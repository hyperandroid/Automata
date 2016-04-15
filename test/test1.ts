import {Automata,Message,Session} from "../src/automata";

class Controller {

    constructor() {

    }

    a_enter( session : Session<Controller>, state : string, msg : Message ) {
        console.log(state+" enter ");
    };

    a_exit( session : Session<Controller>, state : string, msg : Message ) {
        console.log(state+" exit ");
    };

    b_enter( session : Session<Controller>, state : string, msg : Message ) {
        console.log(state+" enter ");
    };

    b_exit( session : Session<Controller>, state : string, msg : Message ) {
        console.log(state+" exit ");
    };

    c_exit( session : Session<Controller>, state : string, msg : Message ) {
        console.log(state+" exit");
    };

    c_enter( session : Session<Controller>, state : string, msg : Message ) {
        console.log(state+" enter");
    };

    ab_transition( session : Session<Controller>, state : string, msg : Message ) {
        console.log("transition: "+msg.msgId);
    };

    bc_transition( session : Session<Controller>, state : string, msg : Message ) {
        console.log("transition: "+msg.msgId);
    };

    Test1_enter( session : Session<Controller>, state : string, msg : Message ) {
        console.log(state+" enter ");
    };

    Test1_exit( session : Session<Controller>, state : string, msg : Message ) {
        console.log(state+" exit ");
    };
}

Automata.RegisterFSM( {

    name    : "Test1",
    state  : ["a","b","c"],
    initial_state : "a",
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

Automata.CreateSession(
    new Controller(),
    "Test1"
).then(
    function success( s : Session<Controller>, m : Message ) {

        console.log("-------------- by message "+m.msgId);

        s.dispatchMessage( { msgId: "ab" } ).then(
            function success( s : Session<Controller>, m : Message ) {
                console.log("-------------- by message "+m.msgId);
            }
        );

        s.dispatchMessage( { msgId: "bc" } ).then(
            function success( s : Session<Controller>, m : Message ) {
                console.log("-------------- by message "+m.msgId);
            }
        );
    },
    function error( s : Session<Controller>, m : string ) {

        console.log("Error creating Session of type Test1, reason: '"+m+"'");
    }
);


