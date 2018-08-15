"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Session_1 = require("./Session");
const Registry_1 = require("./Registry");
const repl = require("repl");
const json = [
    {
        name: "SubStateTest",
        state: ["_1", "_2", "_3"],
        initial: "_1",
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
    },
    {
        name: "Test4",
        state: ["a", "b", "@SubStateTest", "c"],
        initial: "a",
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
    }
];
Registry_1.default.Parse(json);
class SessionLogic {
    constructor(data) {
        this.numPlayers = 0;
        if (data !== void 0) {
            this.deserialize(data);
        }
    }
    serialize() {
        return {
            numPlayers: this.numPlayers
        };
    }
    deserialize(data) {
        if (data.numPlayers !== void 0) {
            this.numPlayers = data.numPlayers;
        }
    }
    static Deserialize(json) {
        return new SessionLogic(json);
    }
    b_enter(ctx) {
        if (ctx.session.currentState !== 'b') {
            throw new Error("aa");
        }
        console.log("#### b enter");
        session.postMessage({
            event: "bc"
        });
    }
    b_exit(ctx) {
        console.log("#### b exit");
    }
    a_exit(ctx) {
        console.log("#### a exit");
        this.numPlayers++;
    }
    a_enter(ctx) {
        console.log("#### a enter");
    }
    Test4_exit(ctx) {
        console.log("#### Test4 exit");
    }
    Test4_enter(ctx) {
        console.log("#### Test4 enter");
    }
    ab_transition(ctx) {
        console.log("#### ab transition");
    }
    ab_guard(ctx) {
        const ret = this.numPlayers == 2;
        console.log("#### checking ab guard: " + ret);
        // this.numPlayers++;
        return ret;
    }
    cd_guard(ctx) {
        // fail
        console.log("#### checking cd guard: false");
        return false;
    }
    SubStateTest_exit(ctx) {
        console.log("subStateTest exit");
    }
    SubStateTest_enter(ctx) {
        console.log("subStateTest enter");
    }
    _2_exit(ctx) {
        console.log("_2 exit");
    }
    _2_enter(ctx) {
        console.log("_2 enter");
    }
    _1_exit(ctx) {
        console.log("_1 exit");
    }
    _1_enter(ctx) {
        console.log("_1 enter");
    }
    c_enter(ctx) {
        console.log("c enter");
    }
    cd_transition(ctx) {
        console.log("cd transition");
    }
}
const session = Registry_1.default.SessionFor("Test4", new SessionLogic(), {
    finished: function (session) {
        console.log("Session ended.");
    },
    stateChanged: function (session, from, to, msg) {
        if (typeof msg !== 'undefined') {
            console.log(`       SessionObserver StateChanged ${from}-->${to} by ${msg.event}.`);
        }
        else {
            console.log(`       SessionObserver StateChanged ${from}-->${to}`);
        }
    },
    ready: function (session, message, isError) {
        console.log('Ready');
        session.transitions();
        // run( session );
        session.dispatchMessage({ "event": "ab" });
        session.dispatchMessage({ "event": "ab" }, new Session_1.SessionConsumeMessagePromise().then((session, message) => {
            const re = repl.start({
                prompt: '> ',
                useGlobal: true
            });
            re.context.session = session;
            re.context.Session = Session_1.default;
            const session2 = Session_1.default.Deserialize(session.serialize(), (data) => {
                return new SessionLogic(data);
            });
            session2.addObserver({
                stateChanged: function (session, from, to, msg) {
                    if (typeof msg !== 'undefined') {
                        console.log(`       SessionObserver StateChanged ${from}-->${to} by ${msg.event}.`);
                    }
                    else {
                        console.log(`       SessionObserver StateChanged ${from}-->${to}`);
                    }
                },
                finished: function (session) { },
                ready: function (session, message, isError) { }
            });
            re.context.session2 = session2;
        }, (session, message) => {
        }));
    }
});
function run(session) {
    session.dispatchMessage({
        event: "ab"
    }, new Session_1.SessionConsumeMessagePromise().then((session, message) => {
        console.log("----------- message fully consumed");
    }, (session, message) => {
    }));
    session.dispatchMessage({
        event: "ab"
    });
    session.dispatchMessage({
        event: "12"
    });
    session.dispatchMessage({
        event: "cd"
    }, new Session_1.SessionConsumeMessagePromise().then((session, message) => {
        console.log("----------- StackTrace");
        session.contexts_.forEach(c => {
            console.log(c.current.name);
        });
        console.log("----------- EndStackTrace");
        console.log("----------- DONEDONE");
    }, (session, message) => {
    }));
}
//# sourceMappingURL=Test.js.map