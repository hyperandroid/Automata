import {FSMCollectionJson} from "./FSM";
import {Message} from "./Transition";
import Session, {SessionConsumeMessagePromise} from "./Session";
import {StateInvocationParams} from "./SessionStateHelper";
import Registry from "./Registry";

import * as repl from "repl";

const json: FSMCollectionJson = [
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
        name    : "Test4",
        state  : ["a","b","@SubStateTest","c"],
        initial: "a",
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

    }
];

Registry.Parse(json);

class SessionLogic {

    numPlayers = 0;

    constructor( data?: any ) {
        if (data!==void 0) {
            this.deserialize(data)
        }
    }

    serialize() : any {
        return {
            numPlayers : this.numPlayers
        };
    }

    deserialize(data: any) : void {
        if (data.numPlayers!==void 0) {
            this.numPlayers = data.numPlayers;
        }
    }

    static Deserialize( json: any ) : SessionLogic {
        return new SessionLogic(json);
    }

    b_enter( ctx: StateInvocationParams<SessionLogic> ) {

        if (ctx.session.currentState!=='b') {
            throw new Error("aa");
        }

        console.log("#### b enter");

        session.postMessage({
            event: "bc"
        });
    }

    b_exit( ctx: StateInvocationParams<SessionLogic> ) {
        console.log("#### b exit");
    }

    a_exit( ctx: StateInvocationParams<SessionLogic> ) {
        console.log("#### a exit");
        this.numPlayers++;
    }

    a_enter( ctx: StateInvocationParams<SessionLogic> ) {
        console.log("#### a enter");
    }

    Test4_exit( ctx: StateInvocationParams<SessionLogic> ) {
        console.log("#### Test4 exit");
    }

    Test4_enter( ctx: StateInvocationParams<SessionLogic> ) {
        console.log("#### Test4 enter");
    }

    ab_transition( ctx: StateInvocationParams<SessionLogic> ) {
        console.log("#### ab transition")
    }

    ab_guard( ctx: StateInvocationParams<SessionLogic> ) {
        const ret= this.numPlayers==2;
        console.log("#### checking ab guard: "+ret);
        // this.numPlayers++;
        return ret;
    }

    cd_guard( ctx: StateInvocationParams<SessionLogic> ) {
        // fail
        console.log("#### checking cd guard: false");
        return false;
    }

    SubStateTest_exit(ctx: StateInvocationParams<SessionLogic> ) {
        console.log("subStateTest exit");
    }

    SubStateTest_enter(ctx: StateInvocationParams<SessionLogic> ) {
        console.log("subStateTest enter");
    }

    _2_exit(ctx: StateInvocationParams<SessionLogic> ) {
        console.log("_2 exit");
    }

    _2_enter(ctx: StateInvocationParams<SessionLogic> ) {
        console.log("_2 enter");
    }

    _1_exit(ctx: StateInvocationParams<SessionLogic> ) {
        console.log("_1 exit");
    }

    _1_enter(ctx: StateInvocationParams<SessionLogic> ) {
        console.log("_1 enter");
    }

    c_enter(ctx: StateInvocationParams<SessionLogic> ) {
        console.log("c enter");
    }

    cd_transition(ctx: StateInvocationParams<SessionLogic> ) {
        console.log("cd transition");
    }
}

const session = Registry.SessionFor(
    "Test4",
    new SessionLogic(),
    {
        finished: function ( session: Session<SessionLogic> ) {
            console.log("Session ended.");
        },

        stateChanged: function (session: Session<SessionLogic> , from: string, to: string, msg?: Message) {
            if (typeof msg !== 'undefined') {
                console.log(`       SessionObserver StateChanged ${from}-->${to} by ${msg.event}.`);
            } else {
                console.log(`       SessionObserver StateChanged ${from}-->${to}`);
            }
        },

        ready: function( session: Session<SessionLogic>, message: Message|Error, isError: boolean ) {
            console.log('Ready');

            session.transitions();
            // run( session );


            session.dispatchMessage({"event":"ab"});
            session.dispatchMessage({"event":"ab"}, new SessionConsumeMessagePromise<SessionLogic>().then(
                (session: Session<SessionLogic>, message?: Message) => {

                        const re= repl.start({
                            prompt:'> ',
                            useGlobal:true
                        });

                        re.context.session = session;
                        re.context.Session = Session;

                        const session2 = Session.Deserialize(session.serialize(), (data: any) : SessionLogic => {
                            return new SessionLogic(data);
                        });
                        session2.addObserver({
                            stateChanged: function(session: Session<SessionLogic> , from: string, to: string, msg?: Message) {
                                if (typeof msg !== 'undefined') {
                                    console.log(`       SessionObserver StateChanged ${from}-->${to} by ${msg.event}.`);
                                } else {
                                    console.log(`       SessionObserver StateChanged ${from}-->${to}`);
                                }
                            },
                            finished: function( session: Session<SessionLogic> ) {},
                            ready: function( session: Session<SessionLogic>, message: Message|Error, isError: boolean ) {}
                        });

                        re.context.session2 = session2
                    },
                    (session: Session<SessionLogic>, message?: Error) => {
                    }
            ));

        }
    });


function run( session: Session<SessionLogic> ) {
    session.dispatchMessage({
            event: "ab"
        }, new SessionConsumeMessagePromise<SessionLogic>().then(
        (session: Session<SessionLogic>, message?: Message) => {
            console.log("----------- message fully consumed");
        },
        (session: Session<SessionLogic>, message?: Error) => {

        })
    );

    session.dispatchMessage({
        event: "ab"
    });

    session.dispatchMessage({
        event: "12"
    });
    
    session.dispatchMessage({
            event: "cd"
        }, new SessionConsumeMessagePromise<SessionLogic>().then(
        (session: Session<SessionLogic>, message?: Message) => {

            console.log("----------- StackTrace");
            session.contexts_.forEach(c => {
                console.log(c.current.name);
            });
            console.log("----------- EndStackTrace");

            console.log("----------- DONEDONE");
        },
        (session: Session<SessionLogic>, message?: Error) => {

        })
    );
}