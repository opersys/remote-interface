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

var abs = require("abstract-socket");
var async = require("async");
var util = require("util");
var debug = require("debug")("RI.helper");

var process_connect = function (daemonName, proc, successCb) {
    var goodStream, self = this;

    async.doUntil(
        // Loop code.
        (function (loopCb) {
            var newStream;

            try {
                debug("Connecting to socket: " + this.socketName());
                newStream = abs.connect('\0' + this.socketName());
            } catch (e) {
                debug(util.format("Failed connection on %s instance %d: " + e), daemonName, this.id);
            }

            if (!this.isStopped()) {
                if (newStream) {
                    goodStream = newStream;
                    loopCb();
                } else
                    setTimeout(loopCb, 100);
            } else
                debug(util.format("Lost %s instance: %d", daemonName, this.id));

        }).bind(proc),

        // Test if the connection is established.
        function () {
            return goodStream != null;
        },

        // Finish
        function () {
            debug(util.format("Connected to %s instance no %d", daemonName, proc.id));
            successCb.apply(self, [goodStream]);
        }
    );
};

module.exports = {
    process_connect: process_connect
};