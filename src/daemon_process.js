/*
 * Copyright (C) 2015-2016 Opersys inc.
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
var signals = require("signals");
var util = require("util");
var fs = require("fs");

var P_IDLE = 1;
var P_STARTING = 2;
var P_STARTED = 3;
var P_STOPPING = 4;
var P_STOPPED = 5;
var P_RESTARTING = 6;
var P_ERROR = 7;

var statesString = {
    1: "P_IDLE",
    2: "P_STARTING",
    3: "P_STARTED",
    4: "P_STOPPING",
    5: "P_STOPPED",
    6: "P_RESTARTING",
    7: "P_ERROR"
};

var DaemonProcess = function (procName) {
    this._state = P_IDLE;
    this._stderrStr = "";
    this._stdoutStr = "";
    this._name = procName;
    this._debug = require("debug")("RI.Proc." + this._name);

    this.startingSignal = new signals.Signal();
    this.startedSignal = new signals.Signal();
    this.stoppingSignal = new signals.Signal();
    this.stoppedSignal = new signals.Signal();
    this.errorSignal = new signals.Signal();
};

DaemonProcess.prototype._setState = function (newState) {
    if (!newState || newState < P_IDLE || newState > P_ERROR)
        throw new Error("Invalid state: " + newState);

    this._debug(util.format("%s -> %s", statesString[this._state], statesString[newState]));

    this._state = newState;
};

DaemonProcess.prototype._onStop = function (code) {
    if (code != 0) {
        this._setState(P_ERROR);
        this.errorSignal.dispatch(null, this._stdoutStr, this._stderrStr);
    }

    this._setState(P_STOPPED);
    this.stoppedSignal.dispatch();
};

DaemonProcess.prototype._onError = function (err) {
    this._setState(P_ERROR);
    this.errorSignal.dispatch(err, this._stdoutStr, this._stderrStr);

    this._setState(P_STOPPED);
    this.stoppedSignal.dispatch(this._stdoutStr);
};

DaemonProcess.prototype._onStdoutData = function (data) {
    if (this._state == P_STARTING) {
        this._setState(P_STARTED);
        this.startedSignal.dispatch();
    }

    this._stdoutStr += data;
};

DaemonProcess.prototype._onStderrData = function (data) {
    if (this._state == P_STARTING) {
        this._setState(P_STARTED);
        this.startedSignal.dispatch();
    }

    this._stderrStr += data;
};

DaemonProcess.prototype._start = function (exec, args) {
    if (this._cp) return;

    this._setState(P_STARTING);

    // If the process file isn't executable, make it so! This happens when the project
    // is manually extracted and copied on a device.
    var stats = fs.statSync(exec);

    if (!(stats.mode & 0100)) {
        this._debug("chmod 0700 " + exec);
        fs.chmodSync(exec, 0700);
    }

    this._debug(exec + " " + args.join(" "));

    this._cp = cp.spawn(exec, args);

    this._cp.on("close", this._onStop.bind(this));
    this._cp.on("error", this._onError.bind(this));
    this._cp.stdout.on("data", this._onStdoutData.bind(this));
    this._cp.stderr.on("data", this._onStderrData.bind(this));
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