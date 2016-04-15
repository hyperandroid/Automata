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


import {Automata,Message,Session,SessionObserverEvent} from "../src/automata";

class Controller {

    name : string;
    count : number = 0;

    constructor( n : string ) {
        this.count = 0;
        this.name = n;
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
    }

    ab_transition( session : Session<Controller>, state : string, msg : Message ) {
        console.log(this.name+" "+"transition: "+msg.msgId);
    }

    bc_transition( session : Session<Controller>, state : string, msg : Message ) {
        console.log(this.name+" "+"transition: "+msg.msgId);
    }

    Test2_enter( session : Session<Controller>, state : string, msg : Message ) {
        console.log(this.name+" "+state+" enter ");
    }

    Test2_exit( session : Session<Controller>, state : string, msg : Message ) {
        console.log(this.name+" "+state+" exit ");
    }

    bc_preGuard(session : Session<Controller>, state : string, msg : Message ) : boolean {
        this.count++;
        console.log("count= "+this.count);
        if ( this.count<3 ) {
            return true;
        }

        console.log("Ok, go.");
        return false;
    }

    bc_postGuard(session : Session<Controller>, state : string, msg : Message ) : boolean {
        this.count++;
        console.log("count= "+this.count);
        return this.count>=5;
    }

}

Automata.RegisterFSM( {

    name    : "Test3",
    state  : ["a","b","c","d"],
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
        },
        {
            event   : "cd",
            from    : "b",
            to      : "c"
        }
    ]
} );

Automata.CreateSession(
    new Controller("c1"),
    "Test3",
    {
        contextCreated : function(     e : SessionObserverEvent<Controller> ) {
        },

        contextDestroyed : function(   e : SessionObserverEvent<Controller> ) {
        },

        sessionEnded : function(       e : SessionObserverEvent<Controller> ) {
            console.log("SessionListener finalStateReached ", e.message );
        },

        customEvent : function(        e : SessionObserverEvent<Controller> ) {
        },

        stateChanged : function(       e : SessionObserverEvent<Controller> ) {
            console.log("SessionListener stateChanged "+e.prev_state_name+" --> "+e.current_state_name );
        }
    }
).then(
    function success( session : Session<Controller>, m : Message ) {
        console.log("");
        console.log("Sent 'ab'");
        session.dispatchMessage( { msgId: "ab" } );

        // fail on pre-guard. count=1, but no notification of state change sent.
        console.log("");
        console.log("Sent 'bc'");
        session.dispatchMessage( { msgId: "bc" } );

        // fail on pre-guard. count=2, but no notification of state change sent.
        console.log("");
        console.log("Sent 'bc'");
        session.dispatchMessage( { msgId: "bc" } );

        // on pre-guard. count=3.
        // Ok go transition.
        // Fail on post-guard
        // so onExit State-b and onEnter State-b ( auto-transition ). Vetoed transition from State-b to State-c.
        // notification of 'stateChanged' on the observer.
        console.log("");
        console.log("Sent 'bc'");
        session.dispatchMessage( { msgId: "bc" } );

        console.log("");
        console.log("Sent 'bc'");
        session.dispatchMessage( { msgId: "bc" } );
    }
);


