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
var signals = require("signals");
var debug = require("debug")("RI.sw");
var path = require("path");
var util = require("util");

var CommandServer = function (/*props*/) {
    this.rotationSignal = new signals.Signal();
    this.infoSignal = new signals.Signal();
    this.errorSignal = new signals.Signal();
    this.stopSignal = new signals.Signal();

    this._sw = null;
};

CommandServer.prototype.send = function (cmd) {
    if (!this._sw) return;
    this._sw.stdin.write(util.format("%s\n", cmd));
};

CommandServer.prototype.start = function start() {
    var self = this;

    debug("Starting CommandServer");

    process.env["CLASSPATH"] = path.join("_bin", "cmdserver.apk");

    this._sw = cp.spawn("/system/bin/app_process", [".", "com.opersys.remoteinterface.CommandServer"]);

    this._sw.stdout.on("data", function (data) {
        var r, rots = data.toString();

        r = rots.trim().split(/\n/);
        if (!r)
            debug("Received " + rots + " instead of full line, discarding");
        else {
            try {
                var ev = JSON.parse(rots);

                if (ev.event == "rotation")
                    self.rotationSignal.dispatch(ev.rotation);
                else if (ev.event == "info")
                    self.infoSignal.dispatch(ev.actualResolution, ev.rotation);
                else
                    debug("Unhandled event: " + ev.event);
            } catch (e) {
                debug("JSON parse error: " + e);
            }
        }
    });

    this._sw.on("close", function () {
        self.stopSignal.dispatch();
    });

    this._sw.on("error", function (err) {
        self.errorSignal.dispatch(err);

        debug("Error launching CommandServer: " + err);
    });
};

CommandServer.prototype.stop = function stop() {
    debug("Stopping CommandServer");

    if (this._sw) {
        this._sw.kill();
        this._sw = null;
    }
};

module.exports = CommandServer;