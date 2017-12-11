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

var util = require("util");
var path = require("path");
var fs = require("fs");
var uuid = require("uuid");

var DaemonProcess = require("./daemon_process.js");

var Minitouch = function (props) {
    DaemonProcess.call(this, ["minitouch"]);
    this._props = props;
};

util.inherits(Minitouch, DaemonProcess);

Minitouch.prototype.socketName = function () {
    return this._socketName;
};

Minitouch.prototype.start = function () {
    var self = this;

    this._socketName = uuid.v1();

    var abi = this._props["ro.product.cpu.abi"];
    var sdk = this._props["ro.build.version.sdk"];
    var exec, bin;

    bin = sdk >= 16 ? "minitouch" : "minitouch-nopie";

    var args = [
        "-n", self._socketName
    ];
    exec = path.join(process.cwd(), "_bin", "minitouch", abi, bin);

    self._start(exec, args);
};

module.exports = Minitouch;