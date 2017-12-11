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

var util = require("util");
var path = require("path");
var fs = require("fs");
var uuid = require("uuid");

var props = require("./props.js");
var DaemonProcess = require("./daemon_process.js");
var debug = require("debug")("RI.Proc.Minicap");

var Minicap = function (props) {
    DaemonProcess.call(this, ["minicap"]);
    this._props = props;
};

util.inherits(Minicap, DaemonProcess);

Minicap.prototype.socketName = function () {
    return this._socketName;
};

Minicap.prototype._arguments = function (initialSize, currentSize, currentRotation, argsCallback) {
    var self = this;
    var abi = this._props["ro.product.cpu.abi"];
    var sdk = this._props["ro.build.version.sdk"];
    var rel = this._props["ro.build.version.release"];
    var bin, libdir, exec;

    bin = sdk >= 16 ? "minicap" : "minicap-nopie";
    var args = [
        "-d", "0",
        "-S",
        "-n", self._socketName,
        "-P", initialSize.x + "x" + initialSize.y +
        "@" + currentSize.x + "x" + currentSize.y + "/" + currentRotation
    ];

    libdir = path.join(process.cwd(), "_bin", "minicap", "android-" + rel, abi);

    if (!fs.existsSync(libdir))
        libdir = path.join(process.cwd(), "_bin", "minicap", "android-" + sdk, abi);

    process.env["LD_LIBRARY_PATH"] = libdir;
    this._debug("LD_LIBRARY_PATH = " + libdir);

    exec = path.join(process.cwd(), "_bin", "minicap", abi, bin);
    argsCallback(exec, args);
};

Minicap.prototype.startCapture = function (initialSize, currentSize, currentRotation) {
    var self = this;

    DaemonProcess.prototype.start.apply(this);

    this._socketName = uuid.v1();

    self._arguments(initialSize, currentSize, currentRotation, function (exec, args) {
        var fullArgs = args.concat(["-n", self._socketName]);
        self._start(exec, fullArgs);
    });
};

module.exports = Minicap;