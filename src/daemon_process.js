/*
 * Copyright (C) 2015 Opersys inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var cp = require("child_process");
var debug = require("debug")("RI.Proc");
var signals = require("signals");
var util = require("util");

var P_IDLE = 1;
var P_STARTING = 2;
var P_STARTED = 3;
var P_STOPPING = 4;
var P_STOPPED = 5;
var P_RESTARTING = 6;

var statesString = {
    1: "P_IDLE",
    2: "P_STARTING",
    3: "P_STARTED",
    4: "P_STOPPING",
    5: "P_STOPPED"
};

var processCount = 0;

var DaemonProcess = function () {
    this._state = P_IDLE;

    this.id = processCount++;
    this.startingSignal = new signals.Signal();
    this.startedSignal = new signals.Signal();
    this.stoppingSignal = new signals.Signal();
    this.stoppedSignal = new signals.Signal();
};

DaemonProcess.prototype._setState = function (newState) {
    if (!newState || newState < P_IDLE || newState > P_RESTARTING)
        throw new Error("Invalid state: " + newState);

    debug(util.format("Process %d %s -> %s", this.id, statesString[this._state], statesString[newState]));

    this._state = newState;
};

DaemonProcess.prototype._onStop = function () {
    this._setState(P_STOPPED);
    this.stoppedSignal.dispatch();
};

DaemonProcess.prototype._onError = function (err) {
    this.stoppedSignal.dispatch(err);
};

DaemonProcess.prototype._onData = function () {
    if (this._state == P_STARTING) {
        this._setState(P_STARTED);
        this.startedSignal.dispatch();
    }
};

DaemonProcess.prototype._start = function (exec, args) {
    if (this._cp) return;

    this._setState(P_STARTING);

    this._cp = cp.spawn(exec, args);

    this._cp.on("close", this._onStop.bind(this));
    this._cp.on("error", this._onError.bind(this));
    this._cp.stdout.on("data", this._onData.bind(this));
    this._cp.stderr.on("data", this._onData.bind(this));
};

DaemonProcess.prototype.start = function () {
    this.startingSignal.dispatch();
};

DaemonProcess.prototype.stop = function () {
    if (this._cp) {
        this.stoppingSignal.dispatch();

        this._setState(P_STOPPING);
        this._cp.kill("SIGKILL");
    }
};

DaemonProcess.prototype.isStopped = function () {
    return this._state == P_STOPPED || this._state == P_STOPPING;
};

module.exports = DaemonProcess;