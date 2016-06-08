/**
 * Created by ibon on 2/8/16.
 */
"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var SessionConsumeMessagePromise = (function () {
    function SessionConsumeMessagePromise() {
    }
    SessionConsumeMessagePromise.prototype.then = function (ok, error) {
        this._success = ok;
        this._error = error;
        return this;
    };
    SessionConsumeMessagePromise.prototype.__success = function (s, m) {
        this._success && this._success(s, m);
    };
    SessionConsumeMessagePromise.prototype.__error = function (s, message) {
        this._error && this._error(s, message);
    };
    return SessionConsumeMessagePromise;
}());
exports.SessionConsumeMessagePromise = SessionConsumeMessagePromise;
var FSMRegistry = (function () {
    function FSMRegistry() {
    }
    FSMRegistry.FSMFromId = function (id) {
        return FSMRegistry._fsm[id];
    };
    FSMRegistry.register = function (fsm_json) {
        try {
            var fsm = new FSM(fsm_json);
            FSMRegistry._fsm[fsm.name] = fsm;
            console.log("Registered Automata '" + fsm.name + "'");
        }
        catch (e) {
            console.error(e);
        }
    };
    FSMRegistry.createSession = function (session_controller, fsm_id, o) {
        var promise = new SessionConsumeMessagePromise();
        var fsm = FSMRegistry._fsm[fsm_id];
        if (fsm) {
            var session = new Session(session_controller);
            if (o) {
                session.addObserver(o);
            }
            session.__initialize(fsm).then(function (session, m) {
                promise.__success(session, m);
            }, function (session, m) {
                promise.__error(session, m);
            });
        }
        else {
            setImmediate(function () {
                promise.__error(null, new Error("Unkonwn automata: '" + fsm_id + "'"));
            });
        }
        return promise;
    };
    FSMRegistry._fsm = {};
    return FSMRegistry;
}());
exports.FSMRegistry = FSMRegistry;
var State = (function () {
    function State(name) {
        this._name = name;
        this._exit_transitions = {};
        this._exit_transitions_count = 0;
        this._enter_action = null;
        this._exit_action = null;
        this._auto_transition = [];
    }
    State.prototype.transitionForMessage = function (m) {
        var tr = this._exit_transitions[m.msgId];
        return tr || null;
    };
    State.prototype.addExitTransition = function (t) {
        this._exit_transitions[t.event] = t;
        this._exit_transitions_count += 1;
    };
    Object.defineProperty(State.prototype, "name", {
        get: function () {
            return this._name;
        },
        enumerable: true,
        configurable: true
    });
    State.prototype.__onExit = function (s, m) {
        if (this._exit_action !== null) {
            this._exit_action(s, m);
        }
        this.__stopTimeoutTransitionElements();
        return this._exit_action !== null;
    };
    State.prototype.__onEnter = function (s, m) {
        if (this._enter_action !== null) {
            this._enter_action(s, m);
        }
        this.__startTimeoutTransitionElements(s);
        return this._enter_action !== null;
    };
    State.prototype.__startTimeoutTransitionElements = function (s) {
        var _this = this;
        this._auto_transition.forEach(function (sate) {
            sate.timer_id = setTimeout(_this.__notifyTimeoutEvent.bind(_this, s, sate.message), sate.millis);
        });
    };
    State.prototype.__stopTimeoutTransitionElements = function () {
        this._auto_transition.forEach(function (sate) {
            if (sate.timer_id !== -1) {
                clearTimeout(sate.timer_id);
                sate.timer_id = -1;
            }
        });
    };
    State.prototype.__notifyTimeoutEvent = function (s, m) {
        this.__stopTimeoutTransitionElements();
        s.dispatchMessage(m);
    };
    State.prototype.__setTimeoutTransitionInfo = function (millis, message) {
        this._auto_transition.push({
            millis: millis,
            message: message,
            timer_id: -1
        });
    };
    State.prototype.isFinal = function () {
        return this._exit_transitions_count === 0;
    };
    State.prototype.toString = function () {
        return this._name;
    };
    return State;
}());
exports.State = State;
var FSM = (function (_super) {
    __extends(FSM, _super);
    function FSM(fsm) {
        _super.call(this, fsm.name);
        this._states = [];
        this._transitions = [];
        this._initial_state = null;
        this.__createStates(fsm.state, fsm.initial_state);
        this.__createTransitions(fsm.transition);
    }
    Object.defineProperty(FSM.prototype, "initial_state", {
        get: function () {
            return this._initial_state;
        },
        enumerable: true,
        configurable: true
    });
    FSM.prototype.serialize = function () {
        return {
            name: this._name,
            state: this._states.map(function (st) { return st._name; }),
            initial_state: this._initial_state._name,
            transition: this._transitions.map(function (tr) {
                return {
                    event: tr._event,
                    from: tr._initial_state._name,
                    to: tr._final_state._name
                };
            })
        };
    };
    FSM.prototype.__createStates = function (states, initial) {
        for (var _i = 0, states_1 = states; _i < states_1.length; _i++) {
            var name_1 = states_1[_i];
            var st = void 0;
            if (name_1.lastIndexOf("FSM:") === -1) {
                st = new State(name_1);
            }
            else {
                var fsmname = name_1.substring(4);
                st = FSMRegistry._fsm[fsmname];
                if (!st) {
                    throw "Automata '" + this._name + "' referencing other non existent automata: '" + name_1 + "'";
                }
            }
            this._states.push(st);
            if (st.name === initial) {
                this.__setInitialState(st);
            }
        }
    };
    FSM.prototype.__setInitialState = function (st) {
        this._initial_state = st;
        this.__createInitialTransition();
        this.__createEnterAction();
    };
    FSM.prototype.__createInitialTransition = function () {
        this.addExitTransition(new Transition(this, this._initial_state, Transition.__InitialTransitionEvent));
    };
    FSM.prototype.__createEnterAction = function () {
        this._enter_action = function (session, message) {
            session.postMessage(Transition.__InitialTransitionMessage);
        };
    };
    FSM.prototype.__findStateByName = function (n) {
        for (var _i = 0, _a = this._states; _i < _a.length; _i++) {
            var s = _a[_i];
            if (s.name === n) {
                return s;
            }
        }
        return null;
    };
    FSM.prototype.__createTransitions = function (transitions) {
        var _this = this;
        transitions.forEach(function (v /*, index:number, arr:TransitionJson[] */) {
            var f = _this.__findStateByName(v.from);
            var t = _this.__findStateByName(v.to);
            var e = v.event;
            if (!f || !t) {
                throw "Wrongly defined Automata '" + _this.name + "'. Transition '" + v.event + "' refers unknown state:'" + (!f ? v.from : v.to) + "'";
            }
            _this._transitions.push(new Transition(f, t, e));
            // auto transition behavior.
            if (typeof v.timeout !== "undefined") {
                f.__setTimeoutTransitionInfo(v.timeout.millis, {
                    msgId: e,
                    data: v.timeout.data
                });
            }
        });
    };
    return FSM;
}(State));
exports.FSM = FSM;
var Transition = (function () {
    function Transition(from, to, event) {
        this._event = event;
        this._initial_state = from;
        this._final_state = to;
        if (from) {
            from.addExitTransition(this);
        }
    }
    Object.defineProperty(Transition.prototype, "event", {
        get: function () {
            return this._event;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Transition.prototype, "final_state", {
        get: function () {
            return this._final_state;
        },
        enumerable: true,
        configurable: true
    });
    Transition.prototype.toString = function () {
        return this._event;
    };
    Transition.__InitialTransitionEvent = "__INITIAL_EVENT";
    Transition.__InitialTransitionMessage = { msgId: Transition.__InitialTransitionEvent };
    return Transition;
}());
exports.Transition = Transition;
var SessionContext = (function () {
    function SessionContext(c, p) {
        this._current_state = c;
        this._prev_state = p;
    }
    SessionContext.prototype.serialize = function () {
        return {
            current_state: this._current_state._name,
            prev_state: this._prev_state ? this._prev_state._name : "",
        };
    };
    Object.defineProperty(SessionContext.prototype, "current_state", {
        get: function () {
            return this._current_state;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(SessionContext.prototype, "prev_state", {
        get: function () {
            return this._prev_state;
        },
        enumerable: true,
        configurable: true
    });
    SessionContext.prototype.currentStateName = function () {
        return this._current_state && this._current_state.name;
    };
    SessionContext.prototype.prevStateName = function () {
        return this._prev_state && this._prev_state.name;
    };
    SessionContext.prototype.printStackTrace = function () {
        console.log("  " + this._current_state.name);
    };
    return SessionContext;
}());
exports.SessionContext = SessionContext;
var Session = (function () {
    function Session(session_controller) {
        this._states = [];
        this._session_controller = session_controller;
        this._messages_controller = new SessionMessagesController(this);
        this._observers = [];
        this._fsm = null;
        this._ended = false;
        this._sessionEndPromise = null;
    }
    Session.prototype.__initialize = function (fsm) {
        this._fsm = fsm;
        this._states.push(new SessionContext(fsm, null));
        this.__invoke(fsm.name + "_enter", Transition.__InitialTransitionMessage);
        var promise = this.dispatchMessage(Transition.__InitialTransitionMessage);
        this._sessionEndPromise = promise;
        return promise;
    };
    Session.prototype.__serializeController = function () {
        var sc = this._session_controller;
        if (sc.serialize && typeof sc.serialize === "function") {
            return sc.serialize();
        }
        return {};
    };
    Session.prototype.serialize = function () {
        var serializedController = this.__serializeController();
        return {
            ended: this._ended,
            fsm: this._fsm.serialize(),
            states: this._states.map(function (st) { return st.serialize(); }),
            controller: serializedController
        };
    };
    Session.deserialize = function (s, deserializer) {
        var controller = deserializer(s.controller);
        var session = new Session(controller);
        session.__deserialize(s);
        return session;
    };
    Session.prototype.__deserialize = function (s) {
        var _this = this;
        FSMRegistry.register(s.fsm);
        this._fsm = FSMRegistry.FSMFromId(s.fsm.name);
        this._ended = s.ended;
        this._states = s.states.map(function (e) {
            var c = e.current_state === s.fsm.name ?
                _this._fsm :
                _this._fsm._states.filter(function (s) { return s._name === e.current_state; })[0];
            var p = e.prev_state === "" ?
                null :
                _this._fsm._states.filter(function (s) { return s._name === e.prev_state; })[0];
            return new SessionContext(c, p);
        });
    };
    Session.prototype.addObserver = function (o) {
        this._observers.push(o);
    };
    /**
     * User side message.
     */
    Session.prototype.dispatchMessage = function (m) {
        var _this = this;
        var c = new SessionConsumeMessagePromise();
        if (this._ended) {
            setTimeout(function () {
                c._error(_this, new Error('Session ended'));
            }, 0);
        }
        else {
            this._messages_controller.dispatchMessage(m, c);
        }
        return c;
    };
    /**
     * From SessionController internals.
     */
    Session.prototype.postMessage = function (m) {
        this._messages_controller.postMessage(m);
    };
    Session.prototype.__messageImpl = function (m) {
        if (m === Transition.__InitialTransitionMessage) {
            this.__consumeMessageForFSM(m);
        }
        else {
            this.__consumeMessageForState(m);
        }
    };
    Object.defineProperty(Session.prototype, "current_state", {
        get: function () {
            return this._states.length ?
                this._states[this._states.length - 1].current_state :
                null;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Session.prototype, "prev_state", {
        get: function () {
            return this._states.length ?
                this._states[this._states.length - 1].prev_state :
                null;
        },
        enumerable: true,
        configurable: true
    });
    Session.prototype.__onEnter = function (m) {
        var cs = this.current_state;
        if (cs !== null && !cs.__onEnter(this, m)) {
            this.__invoke(cs.name + "_enter", m);
        }
    };
    Session.prototype.__onExit = function (m) {
        var cs = this.current_state;
        if (cs !== null && !cs.__onExit(this, m)) {
            this.__invoke(cs.name + "_exit", m);
        }
    };
    Session.prototype.__invoke = function (method, m) {
        return this._session_controller[method] && this._session_controller[method](this, this.current_state_name, m);
    };
    Session.prototype.__consumeMessageForFSM = function (m) {
        var cs = this.current_state;
        var fsm = cs;
        var new_current_state = fsm.initial_state;
        this._states.push(new SessionContext(new_current_state, this.current_state));
        this.__notifyContextCreated(m);
        this.__onEnter(m);
    };
    Session.prototype.__findStateWithTransitionForMessage = function (m) {
        var sc = this._states;
        var state = null;
        for (var i = sc.length - 1; i >= 0; i--) {
            var current_state = sc[i].current_state;
            var tr = current_state.transitionForMessage(m);
            if (tr !== null) {
                state = current_state;
                break;
            }
        }
        return state;
    };
    Session.prototype.__exitAllStatesUpToStateWithTransitionForMessage = function (stateWitTransition, m) {
        while (this._states.length) {
            var cs = this._states[this._states.length - 1];
            this.__onExit(m);
            if (cs.current_state !== stateWitTransition) {
                this._states.pop();
                this.__notifyContextDestroyed(m);
            }
            else {
                break;
            }
        }
    };
    Session.prototype.__popAllStates = function (m) {
        while (this._states.length) {
            this.__onExit(m);
            this._states.pop();
            this.__notifyContextDestroyed(m);
        }
    };
    Session.prototype.__setCurrentState = function (s, m) {
        var prev = null;
        if (this._states.length) {
            prev = this._states.pop().current_state;
        }
        this._states.push(new SessionContext(s, prev));
        this.__notifyStateChange(m);
        this.__onEnter(m);
    };
    Session.prototype.__endSession = function (m) {
        this._ended = true;
        this.__notifySessionEnded(m);
    };
    Object.defineProperty(Session.prototype, "current_state_name", {
        get: function () {
            return this._states.length ?
                this._states[this._states.length - 1].currentStateName() :
                "<No current state>";
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Session.prototype, "prev_state_name", {
        get: function () {
            return this._states.length ?
                this._states[this._states.length - 1].prevStateName() :
                "<No prev state>";
        },
        enumerable: true,
        configurable: true
    });
    Session.prototype.__consumeMessageForState = function (m) {
        if (!this._ended) {
            var state_for_message = this.__findStateWithTransitionForMessage(m);
            if (null !== state_for_message) {
                this.__processMessage(state_for_message, m);
            }
            else {
                throw new Error("No message: '" + m.msgId + "' for state: '" + this.current_state_name + "'");
            }
        }
        else {
            throw new Error("Session is ended. Message " + m.msgId + " is discarded.");
        }
    };
    Session.prototype.__processMessage = function (state_for_message, m) {
        var tr = state_for_message.transitionForMessage(m);
        var transition_event = tr.event;
        if (!this.__invoke(transition_event + "_preGuard", m)) {
            this.__exitAllStatesUpToStateWithTransitionForMessage(state_for_message, m);
            this.__invoke(transition_event + "_transition", m);
            var next = void 0;
            if (!this.__invoke(transition_event + "_postGuard", m)) {
                next = tr.final_state;
            }
            else {
                next = state_for_message;
            }
            this.__setCurrentState(next, m);
            if (next.isFinal()) {
                this.__popAllStates(m);
                this.__endSession(m);
            }
        }
    };
    Session.prototype.fireCustomEvent = function (message) {
        for (var _i = 0, _a = this._observers; _i < _a.length; _i++) {
            var o = _a[_i];
            o.customEvent({
                session: this,
                message: null,
                current_state_name: this.current_state_name,
                prev_state_name: this.prev_state.name,
                custom_message: message
            });
        }
    };
    Session.prototype.__notifySessionEnded = function (m) {
        this.__notify(m, "sessionEnded");
    };
    Session.prototype.__notifyContextCreated = function (m) {
        this.__notify(m, "contextCreated");
    };
    Session.prototype.__notifyContextDestroyed = function (m) {
        this.__notify(m, "contextDestroyed");
    };
    Session.prototype.__notifyStateChange = function (m) {
        this.__notify(m, "stateChanged");
    };
    Session.prototype.__notify = function (m, method) {
        for (var _i = 0, _a = this._observers; _i < _a.length; _i++) {
            var o = _a[_i];
            o[method] && o[method]({
                session: this,
                message: m,
                current_state_name: this.current_state_name,
                prev_state_name: this.prev_state_name
            });
        }
    };
    Object.defineProperty(Session.prototype, "controller", {
        get: function () {
            return this._session_controller;
        },
        enumerable: true,
        configurable: true
    });
    Session.prototype.printStackTrace = function () {
        if (this._states.length === 0) {
            console.log("session empty");
        }
        else {
            console.log("session stack trace:");
            this._states.forEach(function (s) {
                s.printStackTrace();
            });
        }
    };
    return Session;
}());
exports.Session = Session;
var SessionMessageControllerMessageQueue = (function () {
    function SessionMessageControllerMessageQueue(session, m, callback) {
        this._session = session;
        this._callback = typeof callback !== "undefined" ? callback : null;
        this._triggering_message = m;
        this._messages_queue = [m];
    }
    SessionMessageControllerMessageQueue.prototype.postMessage = function (m) {
        this._messages_queue.push(m);
    };
    SessionMessageControllerMessageQueue.prototype.__consumeMessage = function () {
        var ret;
        if (this._messages_queue.length) {
            var m = this._messages_queue.shift();
            try {
                this._session.__messageImpl(m);
                ret = false;
            }
            catch (e) {
                // console.error(`consume for message '${m.msgId}' got exception: `, e);
                this._messages_queue = [];
                this._callback.__error(this._session, e);
                ret = true;
            }
        }
        else {
            ret = true;
            if (this._callback) {
                this._callback.__success(this._session, this._triggering_message);
            }
        }
        return ret;
    };
    return SessionMessageControllerMessageQueue;
}());
exports.SessionMessageControllerMessageQueue = SessionMessageControllerMessageQueue;
var SessionMessagesController = (function () {
    function SessionMessagesController(session) {
        this._message_queues = [];
        this._session = session;
        this._consuming = false;
    }
    SessionMessagesController.prototype.dispatchMessage = function (m, callback) {
        this._message_queues.push(new SessionMessageControllerMessageQueue(this._session, m, callback));
        this.__consumeMessage();
    };
    SessionMessagesController.prototype.postMessage = function (m) {
        this._message_queues[0].postMessage(m);
        this.__consumeMessage();
    };
    SessionMessagesController.prototype.__consumeMessage = function () {
        if (!this._consuming) {
            this._consuming = true;
            setImmediate(this.__consumeOne.bind(this));
        }
    };
    SessionMessagesController.prototype.__consumeOne = function () {
        if (this._message_queues.length) {
            if (this._message_queues[0].__consumeMessage()) {
                this._message_queues.shift();
            }
        }
        if (this._message_queues.length) {
            setImmediate(this.__consumeOne.bind(this));
        }
        else {
            this._consuming = false;
        }
    };
    return SessionMessagesController;
}());
exports.SessionMessagesController = SessionMessagesController;
var Automata = (function () {
    function Automata() {
    }
    Automata.RegisterFSM = function (file) {
        if (typeof file === "string") {
        }
        else {
            FSMRegistry.register(file);
        }
    };
    Automata.CreateSession = function (controller, fsm_name, o) {
        return FSMRegistry.createSession(controller, fsm_name, o);
    };
    return Automata;
}());
exports.Automata = Automata;
//# sourceMappingURL=automata.js.map