"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * A session keeps track of FSM state path,
 * and binds it to a SessionState object.
 *
 * This SessionState is any object a user would like to attach to a Session.
 */
const SessionContext_1 = require("./SessionContext");
const Transition_1 = require("./Transition");
const SessionStateHelper_1 = require("./SessionStateHelper");
const Registry_1 = require("./Registry");
const INITIAL_TR = "__initial_transition_id__";
class SessionConsumeMessagePromise {
    constructor() {
    }
    then(ok, error) {
        this._success = ok;
        this._error = error;
        return this;
    }
    __success(s, m) {
        this._success && this._success(s, m);
    }
    __error(s, message) {
        this._error && this._error(s, message);
    }
}
exports.SessionConsumeMessagePromise = SessionConsumeMessagePromise;
class SessionMessageQueue {
    constructor(session, m, callback) {
        this.session_ = session;
        this.callback_ = typeof callback !== "undefined" ? callback : null;
        this.triggering_message_ = m;
        this.messages_queue_ = [m];
    }
    postMessage(m) {
        this.messages_queue_.push(m);
    }
    __consumeMessage() {
        let ret;
        if (this.messages_queue_.length) {
            const m = this.messages_queue_.shift();
            try {
                this.session_.__consumeMessage(m);
                ret = false;
            }
            catch (e) {
                // console.error(`consume for message '${m.msgId}' got exception: `, e);
                this.messages_queue_ = [];
                this.callback_.__error(this.session_, e);
                ret = true;
            }
        }
        else {
            ret = true;
            if (this.callback_) {
                this.callback_.__success(this.session_, this.triggering_message_);
            }
        }
        return ret;
    }
}
class SessionMessagesManager {
    constructor(session) {
        this.session_ = session;
        this.message_queues_ = [];
        this.consuming_ = false;
    }
    dispatchMessage(m, callback) {
        this.message_queues_.push(new SessionMessageQueue(this.session_, m, callback));
        this.__consumeMessage();
    }
    postMessage(m) {
        this.message_queues_[0].postMessage(m);
        this.__consumeMessage();
    }
    __consumeMessage() {
        if (!this.consuming_) {
            this.consuming_ = true;
            setImmediate(this.__consumeOne.bind(this));
        }
    }
    __consumeOne() {
        if (this.message_queues_.length) {
            if (this.message_queues_[0].__consumeMessage()) {
                this.message_queues_.shift();
            }
        }
        if (this.message_queues_.length) {
            setImmediate(this.__consumeOne.bind(this));
        }
        else {
            this.consuming_ = false;
        }
    }
}
class Session {
    constructor(state) {
        this.observers_ = [];
        this.contexts_ = [];
        this.state_ = null;
        this.state_ = state;
        this.messagesManager_ = new SessionMessagesManager(this);
    }
    initialize(fsm, o) {
        if (typeof o !== 'undefined') {
            this.addObserver(o);
        }
        // run initial transition (kind of)
        this.messagesManager_.dispatchMessage({
            event: INITIAL_TR,
            payload: fsm
        }, new SessionConsumeMessagePromise().then((session, message) => {
            if (o !== void 0) {
                o.ready(this, message, false);
            }
        }, (session, message) => {
            if (o !== void 0) {
                o.ready(this, message, true);
            }
        }));
    }
    addObserver(so) {
        this.observers_.push(so);
    }
    removeObserver(so) {
        const index = this.observers_.indexOf(so);
        if (index !== -1) {
            this.observers_.splice(index, 1);
        }
    }
    __emitFinished() {
        for (let o of this.observers_) {
            o.finished(this);
        }
    }
    __emitStateChanged(from, to, message, transition) {
        SessionStateHelper_1.default.Transition(this, typeof message !== 'undefined' ? message.event : undefined, {
            session: this,
            transition: transition,
            msg: message
        });
        SessionStateHelper_1.default.EnterState(this, to, {
            session: this,
            transition: transition,
            msg: message
        });
        for (let o of this.observers_) {
            o.stateChanged(this, from, to, message);
        }
    }
    __transitionForEvent(event) {
        for (let i = this.contexts_.length - 1; i >= 0; i--) {
            const sc = this.contexts_[i];
            const tr = sc.current.transitionForEvent(event);
            if (tr !== null) {
                return { tr, sc };
            }
        }
        return { tr: null, sc: null };
    }
    get currentContext() {
        if (this.contexts_.length === 0) {
            return null;
        }
        return this.contexts_[this.contexts_.length - 1];
    }
    get currentState() {
        return this.currentContext.current.name;
    }
    get isFinished() {
        return this.contexts_.length > 0 && this.currentContext.current.isFinal;
    }
    __guardAllowsTransition(transition, msg) {
        return SessionStateHelper_1.default.CheckGuard(this, msg.event, {
            session: this,
            transition: transition,
            msg: msg
        });
    }
    dispatchMessage(msg, cb) {
        this.messagesManager_.dispatchMessage(msg, cb);
    }
    postMessage(m) {
        this.messagesManager_.postMessage(m);
    }
    static __InitialTransition(st) {
        return new Transition_1.default(null, st, INITIAL_TR);
    }
    __consumeMessage(msg) {
        console.log(" ");
        console.log(" consuming: " + msg.event);
        if (msg.event === INITIAL_TR) {
            this.pushContext(msg.payload, Session.__InitialTransition(msg.payload));
            return;
        }
        if (this.isFinished) {
            throw new Error(`Can't dispatch on finalized session.`);
        }
        const { tr, sc } = this.__transitionForEvent(msg.event);
        // exists a transition for the incoming event ?
        if (tr !== null) {
            // find a suitable state context
            this.popContext(sc.current, msg, tr);
            const prevCurrentState = sc.current;
            let newCurrentState = null;
            // exit state A
            SessionStateHelper_1.default.ExitState(this, sc.current.name, {
                session: this,
                transition: tr,
                msg: msg,
            });
            let guarded = false;
            // if guard allows, enter B
            if (this.__guardAllowsTransition(tr, msg)) {
                newCurrentState = tr.to;
                this.currentContext.current = newCurrentState;
                SessionStateHelper_1.default.Transition(this, typeof msg.event !== 'undefined' ? msg.event : undefined, {
                    session: this,
                    transition: tr,
                    msg: msg
                });
            }
            else {
                // else auto transition A-A
                // no transition notification, since it has not fired (guard prevented it from happening).
                newCurrentState = prevCurrentState;
                this.currentContext.current = newCurrentState;
                guarded = true;
            }
            // call STATENAME_enter if exists.
            SessionStateHelper_1.default.EnterState(this, newCurrentState.name, {
                session: this,
                transition: tr,
                msg: msg,
                guarded: guarded
            });
            // notify observers about state change.
            // guard = false : A -> B
            // guard = true  : A -> A
            for (let o of this.observers_) {
                o.stateChanged(this, prevCurrentState.name, newCurrentState.name, msg);
            }
            // enter State.
            newCurrentState.onEnter(this, tr);
            if (this.isFinished) {
                this.__emitFinished();
            }
        }
    }
    pushContext(state, tr) {
        if (this.isFinished) {
            throw new Error(`Can't dispatch on finalized session.`);
        }
        let current = null;
        if (this.contexts_.length > 0) {
            current = this.contexts_[this.contexts_.length - 1].current;
        }
        const newContext = new SessionContext_1.default(current, state);
        this.contexts_.push(newContext);
        this.__emitStateChanged(current != null ? current.name : "", state.name, { event: INITIAL_TR }, tr);
        if (!state.isFinal) {
            state.onEnter(this, tr);
        }
        else {
            this.__emitFinished();
        }
    }
    popContext(state, message, transition) {
        let from = state;
        while (this.contexts_.length > 0) {
            if (this.currentContext.current !== state) {
                const sc = this.contexts_.pop();
                SessionStateHelper_1.default.ExitState(this, sc.current.name, {
                    session: this,
                    transition: transition,
                    msg: message
                });
                SessionStateHelper_1.default.EnterState(this, this.currentContext.current.name, {
                    session: this,
                    transition: transition,
                    msg: message
                });
                for (let o of this.observers_) {
                    o.stateChanged(this, sc.current.name, from.name, message);
                }
                from = sc.current;
            }
            else {
                break;
            }
        }
    }
    get state() {
        return this.state_;
    }
    transitions() {
        if (this.currentContext === null || this.currentContext.current === null) {
            console.error("No transitions. Current state is unknown");
            return;
        }
        console.log("");
        console.log(`valid transitions for ${this.currentState}`);
        let count = 0;
        const fsmName = this.contexts_[this.contexts_.length - 2].current.name;
        const fsm = Registry_1.default.Get(fsmName);
        fsm.transitions_.forEach(t => {
            if (t.from === this.currentContext.current) {
                console.log(`   ${t.event}`);
                count++;
            }
        });
        if (count === 0) {
            console.log(`   no transitions for event. isFinal=${this.currentContext.current.isFinal}`);
        }
    }
    serialize() {
        if (this.state_.serialize === void 0) {
            throw new Error("State has no serialize function.");
        }
        return {
            fsm: this.contexts_[0].current.serialize(),
            context: this.__serializeContext(),
            state: this.state_.serialize()
        };
    }
    __serializeContext() {
        return this.contexts_.map(c => c.serialize());
    }
    static Deserialize(json, sessionDigester) {
        Registry_1.default.PushRegistry();
        // register FSM
        for (let i = json.fsm.length - 1; i >= 0; i--) {
            Registry_1.default.Parse([json.fsm[i]]);
        }
        // generate session context
        const context = [];
        json.context.forEach((jctx, i) => {
            let fsm;
            let st;
            if (i < json.context.length - 1) {
                // an fsm
                fsm = Registry_1.default.Get(jctx.current.fsm);
            }
            else {
                fsm = Registry_1.default.Get(json.context[json.context.length - 2].current.name);
            }
            st = fsm.__findStateByName(jctx.current.name);
            context.push(new SessionContext_1.default(null, st));
        });
        // resolve session context prev state
        for (let i = 0; i < context.length - 1; i++) {
            context[i + 1].previous_ = context[i].current;
        }
        let sessionState = sessionDigester(json.state);
        const session = new Session(sessionState);
        session.contexts_ = context;
        Registry_1.default.PopRegistry();
        return session;
    }
}
exports.default = Session;
//# sourceMappingURL=Session.js.map