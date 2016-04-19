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

var async = require("async");
var debug = require("debug")("RI.ws.input");
var util = require("util");
var path = require("path");
var signals = require("signals");
var uuid = require("uuid");

var Display = require("./display_info.js");
var Minitouch = require("./minitouch_process.js");
var MinitouchHelper = require("./daemon_process_helpers");

var CommWebSocketHandler = function (wss, commandServer, props) {
    this._props = props;
    this._banner = null;
    this._commandServer = commandServer;
    this._commandServer.rotationSignal.add(this.onRotation.bind(this));

    wss.on("connection", this.onCommWebsocketConnect.bind(this));
};

CommWebSocketHandler.prototype.onCommWebsocketConnect = function (ws) {
    var self = this;

    debug("Web socket connected");

    this.ws = ws;

    if (!this._minitouch)
        this.startOrRestartMinitouch();

    ws.on("close", this.onCommWebsocketClose.bind(this));
    ws.on("message", this.onCommWebsocketMessage.bind(this));

    self.ws.send(JSON.stringify({
        "event": "info",
        "data": {
            "displaySize": Display.getInitialDisplaySize(0),
            "rotation": Display.getRotation(this._props["ro.build.version.sdk"]),
            "model": this._props["ro.product.model"],
            "abi": this._props["ro.product.cpu.abi"],
            "manufacturer": this._props["ro.product.manufacturer"]
        }
    }));
};

CommWebSocketHandler.prototype.onCommWebsocketClose = function () {
    debug("Web socket disconnected");
};

CommWebSocketHandler.prototype.onRotation = function (rotation) {
    // Send the rotation event.
    if (this.ws)
        this.ws.send(JSON.stringify({event: "rotation", data: rotation}));
};

/*
  This workaround needs to be present for IdeaPad Yoga tablets but
  right now we have no way to activate it.

 https://github.com/openstf/stf/blob/58e25c0f653d239c7f37000ef0631dfa0d1e099c/lib/units/device/plugins/touch/index.js#L481

 'bottom left': {
   x: function(point) {
     return 1 - point.y;
   },
   y: function(point) {
     return point.x;
   }
 }

 */

/* This looks silly but preserves some consistancy with OpenSTF code. */
CommWebSocketHandler.prototype.origin = {
    x: function(point) {
        return point.x
    },
    y: function(point) {
        return point.y
    }
};

CommWebSocketHandler.prototype._nreadLine = function (socket, n, resultCb) {
    var lineBuf = "";
    var lines = [];

    function readLines() {
        var c = "", s;

        try {
            // Read as much data as we can from the stream.
            while (lines.length < n && c != null) {
                if ((c = socket.read(1)) != null)
                    lineBuf += c;

                if (c == "\n") {
                    lines.push(lineBuf);
                    lineBuf = "";
                }
            }

            if (c == null && lines.length < n)
                socket.once("readable", function () {
                    readLines();
                });
            else
                resultCb(lines);
        } catch (e) {
            debug("Read error: " + e);
        }
    }

    socket.once("readable", function () { readLines(); });
};

CommWebSocketHandler.prototype._readBanner = function(socket) {
    var self = this;

    function parseVersion(versionLine) {
        var args = versionLine.split(/ /g);
        switch (args[0]) {
            case 'v':
                self._banner.version = +args[1];
                break;
            default:
                throw util.format("Unexpected output \"%s\", expecting version line", versionLine);
        }
    }

    function parseLimits(limitsLine) {
        var args = limitsLine.split(/ /g);
        switch (args[0]) {
            case '^':
                self._banner.maxContacts = args[1];
                self._banner.maxX = args[2];
                self._banner.maxY = args[3];
                self._banner.maxPressure = args[4];
                break;
            default:
                throw util.format("Unknown output \"%s\", expecting limits line");
        }
    }

    function parsePid(pidLine) {
        var args = pidLine.split(/ /g);
        switch (args[0]) {
            case '$':
                self._banner.pid = +args[1];
                break;
            default:
                throw util.format("Unexpected output \"%s\", expecting pid line");
        }
    }

    self._banner = {
        pid: -1,
        version: 0,
        maxContacts: 0,
        maxX: 0,
        maxY: 0,
        maxPressure: 0
    };

    this._nreadLine(socket, 3, function (lines) {
        var versionLine = lines[0];
        var limitsLine = lines[1];
        var pidLine = lines[2];

        parseVersion(versionLine);
        parseLimits(limitsLine);
        parsePid(pidLine);

        debug("Minitouch banner: " + util.inspect(self._banner));
    });
};

CommWebSocketHandler.prototype._onMinitouchStarted = function () {
    return MinitouchHelper.process_connect.apply(this, ["minitouch", this._minitouch, function (stream) {
        this.stream = stream;
        this._readBanner(this.stream);
    }]);
};

CommWebSocketHandler.prototype._onMinitouchStopping = function () {
    // Close the stream to minitouch if it's open.
    if (this.stream) {
        this.stream.end();
        this.stream = null;
    }

    if (this._isRestarting) this._startMinitouch();
};

CommWebSocketHandler.prototype._startMinitouch = function () {
    this._minitouch = new Minitouch(this._props);
    this._minitouch.start();

    this._startedSignalHandler = this._onMinitouchStarted.bind(this);
    this._stoppingSignalHandler = this._onMinitouchStopping.bind(this);
    this._isRestarting = false;

    this._minitouch.startedSignal.add(this._startedSignalHandler);
    this._minitouch.stoppingSignal.add(this._stoppingSignalHandler);
};

CommWebSocketHandler.prototype.startOrRestartMinitouch = function () {
    if (!this._minitouch)
        this._startMinitouch();

    // This will make object restart minitouch once we receive the event of the death
    // of the previous instance.
    else {
        this._isRestarting = true;
        this._minitouch.stop();
    }
};

CommWebSocketHandler.prototype._write = function (s) {
    this.stream.write(s);
};

CommWebSocketHandler.prototype.onCommWebsocketMessage = function (jsData) {
    var data = JSON.parse(jsData);

    // Most commands are forwarded to the Java command server
    if (data.cmd.match(/input./) || data.cmd.match(/display./))
        return this._commandServer.send(jsData);

    if (data.cmd == "mouse.down")
        this.touchDown(data.contact, data.point, data.pressure);

    else if (data.cmd == "mouse.move")
        this.touchMove(data.contact, data.point, data.pressure);

    else if (data.cmd == "mouse.up")
        this.touchUp(data.contact);

    this.touchCommit();
};

CommWebSocketHandler.prototype.touchDown = function (contact, point, pressure) {
    if (!this._banner) return;

    this._write(util.format(
        "d %s %s %s %s\n",
        contact,
        Math.floor(this.origin.x(point) * this._banner.maxX),
        Math.floor(this.origin.y(point) * this._banner.maxY),
        Math.floor((pressure || 0.5) * this._banner.maxPressure)
    ));
};

CommWebSocketHandler.prototype.touchMove = function (contact, point, pressure) {
    if (!this._banner) return;

    this._write(util.format(
        "m %s %s %s %s\n",
        contact,
        Math.floor(this.origin.x(point) * this._banner.maxX),
        Math.floor(this.origin.y(point) * this._banner.maxY),
        Math.floor((pressure || 0.5) * this._banner.maxPressure)
    ));
};

CommWebSocketHandler.prototype.touchUp = function (contact) {
    if (!this._banner) return;
    return this._write(util.format("u %s\n", contact));
};

CommWebSocketHandler.prototype.touchCommit = function() {
    return this._write("c\n");
};

CommWebSocketHandler.prototype.touchReset = function() {
    return this._write("r\n");
};

module.exports = CommWebSocketHandler;