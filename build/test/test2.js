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
"use strict";
var automata_1 = require("../src/automata");
automata_1.Automata.RegisterFSM({
    name: "Test2",
    state: ["a", "b", "c"],
    initial_state: "a",
    transition: [
        {
            event: "ab",
            from: "a",
            to: "b",
            timeout: {
                millis: 4000,
                data: {}
            }
        },
        {
            event: "bc",
            from: "b",
            to: "c"
        }
    ]
});
var __index = 0;
var Controller = (function () {
    function Controller(n) {
        this.name = n || "controller_" + __index++;
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
    ;
    Controller.prototype.ab_transition = function (session, state, msg) {
        console.log(this.name + " " + "transition: " + msg.msgId);
    };
    ;
    Controller.prototype.bc_transition = function (session, state, msg) {
        console.log(this.name + " " + "transition: " + msg.msgId);
    };
    ;
    Controller.prototype.Test2_enter = function (session, state, msg) {
        console.log(this.name + " " + state + " enter ");
    };
    ;
    Controller.prototype.Test2_exit = function (session, state, msg) {
        console.log(this.name + " " + state + " exit ");
    };
    ;
    return Controller;
}());
automata_1.Automata.CreateSession(new Controller("c1"), "Test2");
automata_1.Automata.CreateSession(new Controller("c2"), "Test2").then(function success(s, m) {
    s.dispatchMessage({ msgId: "ab" });
});
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
//# sourceMappingURL=test2.js.map