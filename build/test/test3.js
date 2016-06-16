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
"use strict";
var automata_1 = require("../src/automata");
var Controller = (function () {
    function Controller(n) {
        this.count = 0;
        this.count = 0;
        this.name = n;
    }
    Controller.prototype.a_enter = function (session, state, msg) {
        console.log(this.name + " " + state + " enter ");
    };
    ;
    Controller.prototype.a_exit = function (session, state, msg) {
        console.log(this.name + " " + state + " exit ");
    };
    ;
    Controller.prototype.b_enter = function (session, state, msg) {
        console.log(this.name + " " + state + " enter ");
    };
    ;
    Controller.prototype.b_exit = function (session, state, msg) {
        console.log(this.name + " " + state + " exit ");
    };
    ;
    Controller.prototype.c_exit = function (session, state, msg) {
        console.log(this.name + " " + state + " exit");
    };
    ;
    Controller.prototype.c_enter = function (session, state, msg) {
        console.log(this.name + " " + state + " enter");
    };
    Controller.prototype.ab_transition = function (session, state, msg) {
        console.log(this.name + " " + "transition: " + msg.msgId);
    };
    Controller.prototype.bc_transition = function (session, state, msg) {
        console.log(this.name + " " + "transition: " + msg.msgId);
    };
    Controller.prototype.Test2_enter = function (session, state, msg) {
        console.log(this.name + " " + state + " enter ");
    };
    Controller.prototype.Test2_exit = function (session, state, msg) {
        console.log(this.name + " " + state + " exit ");
    };
    Controller.prototype.bc_preGuard = function (session, state, msg) {
        this.count++;
        console.log("count= " + this.count);
        if (this.count < 3) {
            return true;
        }
        console.log("Ok, go.");
        return false;
    };
    Controller.prototype.bc_postGuard = function (session, state, msg) {
        this.count++;
        console.log("count= " + this.count);
        return this.count >= 5;
    };
    return Controller;
}());
automata_1.Automata.RegisterFSM({
    name: "Test3",
    state: ["a", "b", "c", "d"],
    initial_state: "a",
    transition: [
        {
            event: "ab",
            from: "a",
            to: "b"
        },
        {
            event: "bc",
            from: "b",
            to: "c"
        },
        {
            event: "cd",
            from: "b",
            to: "c"
        }
    ]
});
automata_1.Automata.CreateSession(new Controller("c1"), "Test3", {
    contextCreated: function (e) {
    },
    contextDestroyed: function (e) {
    },
    sessionEnded: function (e) {
        console.log("SessionListener finalStateReached ", e.message);
    },
    customEvent: function (e) {
    },
    stateChanged: function (e) {
        console.log("SessionListener stateChanged " + e.prev_state_name + " --> " + e.current_state_name);
    }
}).then(function success(session, m) {
    console.log("");
    console.log("Sent 'ab'");
    session.dispatchMessage({ msgId: "ab" });
    // fail on pre-guard. count=1, but no notification of state change sent.
    console.log("");
    console.log("Sent 'bc'");
    session.dispatchMessage({ msgId: "bc" });
    // fail on pre-guard. count=2, but no notification of state change sent.
    console.log("");
    console.log("Sent 'bc'");
    session.dispatchMessage({ msgId: "bc" });
    // on pre-guard. count=3.
    // Ok go transition.
    // Fail on post-guard
    // so onExit State-b and onEnter State-b ( auto-transition ). Vetoed transition from State-b to State-c.
    // notification of 'stateChanged' on the observer.
    console.log("");
    console.log("Sent 'bc'");
    session.dispatchMessage({ msgId: "bc" });
    console.log("");
    console.log("Sent 'bc'");
    session.dispatchMessage({ msgId: "bc" });
    session.dispatchMessage({ msgId: "bc" }).then(function () { }, function (session, err) { console.error(err.message); });
});
//# sourceMappingURL=test3.js.map