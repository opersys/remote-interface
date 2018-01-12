/*
 * Copyright (C) 2015-2018 Opersys inc.
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

var process_connect = function (daemonName, proc, successCb) {
    var self = this;
    var debug = require("debug")("RI.Proc." + daemonName);
    var isConn = false;
    var client;

    async.doUntil(
        // Loop code.
        (function (loopCb) {
            if (!isConn) {
                debug("Connecting to socket: " + this.socketName());
                client = abs.connect('\0' + this.socketName(), function () {
                    isConn = true;
                    loopCb();
                });

                client.on('error', function (e) {
                    debug("Connection failed: " + e);
                    setTimeout(loopCb, 200);
                });
            }
        }).bind(proc),

        // Test if the connection is established.
        function () {
            return isConn /*|| self.isStopped()*/;
        },

        // Finish
        function () {
            if (isConn) {
                debug("Connected to socket: " + proc.socketName());
                successCb.apply(self, [client]);
            }
        }
    );
};

module.exports = {
    process_connect: process_connect
};