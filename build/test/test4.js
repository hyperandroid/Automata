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
"use strict";
var automata_1 = require("../src/automata");
var Controller = (function () {
    function Controller(n) {
        this.name = n;
    }
    Controller.prototype._a_enter = function (session, state, msg) {
        console.log(this.name + " " + state + " enter ");
    };
    Controller.prototype._a_exit = function (session, state, msg) {
        console.log(this.name + " " + state + " exit ");
    };
    Controller.prototype._b_enter = function (session, state, msg) {
        console.log(this.name + " " + state + " enter ");
    };
    Controller.prototype._b_exit = function (session, state, msg) {
        console.log(this.name + " " + state + " exit ");
    };
    Controller.prototype._c_enter = function (session, state, msg) {
        console.log(this.name + " " + state + " enter ");
    };
    Controller.prototype._c_exit = function (session, state, msg) {
        console.log(this.name + " " + state + " exit ");
    };
    Controller.prototype._1_enter = function (session, state, msg) {
        console.log(this.name + " " + state + " enter ");
    };
    Controller.prototype._1_exit = function (session, state, msg) {
        console.log(this.name + " " + state + " exit ");
    };
    Controller.prototype._2_enter = function (session, state, msg) {
        console.log(this.name + " " + state + " enter ");
    };
    Controller.prototype._2_exit = function (session, state, msg) {
        console.log(this.name + " " + state + " exit ");
    };
    Controller.prototype._3_enter = function (session, state, msg) {
        console.log(this.name + " " + state + " enter ");
    };
    Controller.prototype._3_exit = function (session, state, msg) {
        console.log(this.name + " " + state + " exit ");
    };
    Controller.prototype.SubStateTest_enter = function (session, state, msg) {
        console.log(this.name + " " + state + " enter ");
    };
    Controller.prototype.SubStateTest_exit = function (session, state, msg) {
        console.log(this.name + " " + state + " exit ");
    };
    return Controller;
}());
// Register one FSM model.
automata_1.Automata.RegisterFSM({
    name: "SubStateTest",
    state: ["_1", "_2", "_3"],
    initial_state: "_1",
    transition: [
        {
            event: "12",
            from: "_1",
            to: "_2"
        },
        {
            event: "23",
            from: "_2",
            to: "_3"
        }
    ]
});
// register another FSM model
automata_1.Automata.RegisterFSM({
    name: "Test4",
    state: ["a", "b", "FSM:SubStateTest", "c"],
    initial_state: "a",
    transition: [
        {
            event: "ab",
            from: "a",
            to: "b",
        },
        {
            event: "bc",
            from: "b",
            to: "SubStateTest",
        },
        {
            event: "cd",
            from: "SubStateTest",
            to: "c",
        }
    ]
});
var session = automata_1.Automata.CreateSession(new Controller("c1"), "Test4").then(function success(session, m) {
    session.dispatchMessage({ msgId: "ab" });
    session.dispatchMessage({ msgId: "bc" }).then(function success(s, m) {
        s.printStackTrace();
    });
    session.dispatchMessage({ msgId: "cd" }).then(function success(s, m) {
        s.printStackTrace();
    });
});
//# sourceMappingURL=test4.js.map