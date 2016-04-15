"use strict";
var automata_1 = require("../src/automata");
var Controller = (function () {
    function Controller() {
    }
    Controller.prototype.a_enter = function (session, state, msg) {
        console.log(state + " enter ");
    };
    ;
    Controller.prototype.a_exit = function (session, state, msg) {
        console.log(state + " exit ");
    };
    ;
    Controller.prototype.b_enter = function (session, state, msg) {
        console.log(state + " enter ");
    };
    ;
    Controller.prototype.b_exit = function (session, state, msg) {
        console.log(state + " exit ");
    };
    ;
    Controller.prototype.c_exit = function (session, state, msg) {
        console.log(state + " exit");
    };
    ;
    Controller.prototype.c_enter = function (session, state, msg) {
        console.log(state + " enter");
    };
    ;
    Controller.prototype.ab_transition = function (session, state, msg) {
        console.log("transition: " + msg.msgId);
    };
    ;
    Controller.prototype.bc_transition = function (session, state, msg) {
        console.log("transition: " + msg.msgId);
    };
    ;
    Controller.prototype.Test1_enter = function (session, state, msg) {
        console.log(state + " enter ");
    };
    ;
    Controller.prototype.Test1_exit = function (session, state, msg) {
        console.log(state + " exit ");
    };
    ;
    return Controller;
}());
automata_1.Automata.RegisterFSM({
    name: "Test1",
    state: ["a", "b", "c"],
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
        }
    ]
});
automata_1.Automata.CreateSession(new Controller(), "Test1").then(function success(s, m) {
    console.log("-------------- by message " + m.msgId);
    s.dispatchMessage({ msgId: "ab" }).then(function success(s, m) {
        console.log("-------------- by message " + m.msgId);
    });
    s.dispatchMessage({ msgId: "bc" }).then(function success(s, m) {
        console.log("-------------- by message " + m.msgId);
    });
}, function error(s, m) {
    console.log("Error creating Session of type Test1, reason: '" + m + "'");
});
//# sourceMappingURL=test1.js.map