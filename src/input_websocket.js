var abs = require("abstract-socket");
var async = require("async");
var debug = require("debug")("RI.ws.input");
var readline = require("line-read");
var util = require("util");
var cp = require("child_process");
var path = require("path");
var signals = require("signals");
var uuid = require("uuid");

var props = require("./props.js");
var Minitouch = require("./minitouch_process.js");
var MinitouchHelper = require("./daemon_process_helpers");

var InputWebSocketHandler = function (wss, commandServer) {
    this.props = [
        "ro.product.cpu.abi",
        "ro.build.version.sdk"
    ];

    this.banner = null;
    this.commandServer = commandServer;
    this.commandServer.screenWatcherRotationSignal.add(this.onScreenWatcherRotation.bind(this));

    wss.on("connection", this.onInputWebSocketConnect.bind(this));
};

InputWebSocketHandler.prototype.onInputWebSocketConnect = function (ws) {
    debug("Web socket connected");

    this.ws = ws;

    if (!this._minitouch)
        this.startOrRestartMinitouch();

    ws.on("close", this.onInputWebSocketClose.bind(this));
    ws.on("message", this.onInputWebSocketMessage.bind(this));
};

InputWebSocketHandler.prototype.onInputWebSocketClose = function () {
    debug("Web socket disconnected");
};

InputWebSocketHandler.prototype.onScreenWatcherRotation = function () {
    debug("Device rotated, restarting minitouch");

    this.startOrRestartMinitouch();
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
InputWebSocketHandler.prototype.origin = {
    x: function(point) {
        return point.x
    },
    y: function(point) {
        return point.y
    }
};

InputWebSocketHandler.prototype._nreadLine = function (socket, n, resultCb) {
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

InputWebSocketHandler.prototype._readBanner = function(socket) {
    var self = this;

    function parseVersion(versionLine) {
        var args = versionLine.split(/ /g);
        switch (args[0]) {
            case 'v':
                self.banner.version = +args[1];
                break;
            default:
                throw util.format("Unexpected output \"%s\", expecting version line", versionLine);
        }
    }

    function parseLimits(limitsLine) {
        var args = limitsLine.split(/ /g);
        switch (args[0]) {
            case '^':
                self.banner.maxContacts = args[1];
                self.banner.maxX = args[2];
                self.banner.maxY = args[3];
                self.banner.maxPressure = args[4];
                break;
            default:
                throw util.format("Unknown output \"%s\", expecting limits line");
        }
    }

    function parsePid(pidLine) {
        var args = pidLine.split(/ /g);
        switch (args[0]) {
            case '$':
                self.banner.pid = +args[1];
                break;
            default:
                throw util.format("Unexpected output \"%s\", expecting pid line");
        }
    }

    self.banner = {
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

        debug("Minitouch banner: " + util.inspect(self.banner));
    });
};

InputWebSocketHandler.prototype._onMinitouchStarted = function () {
    return MinitouchHelper.process_connect.apply(this, ["minitouch", this._minitouch, function (stream) {
        this.stream = stream;
        this._readBanner(this.stream);
    }]);
};

InputWebSocketHandler.prototype._onMinitouchStopping = function () {
    // Close the stream to minitouch if it's open.
    if (this.stream) {
        this.stream.end();
        this.stream = null;
    }

    if (this._isRestarting) this._startMinitouch();
};

InputWebSocketHandler.prototype._startMinitouch = function () {
    this._minitouch = new Minitouch();
    this._minitouch.start();

    this._startedSignalHandler = this._onMinitouchStarted.bind(this);
    this._stoppingSignalHandler = this._onMinitouchStopping.bind(this);
    this._isRestarting = false;

    this._minitouch.startedSignal.add(this._startedSignalHandler);
    this._minitouch.stoppingSignal.add(this._stoppingSignalHandler);
};

InputWebSocketHandler.prototype.startOrRestartMinitouch = function () {
    if (!this._minitouch)
        this._startMinitouch();

    // This will make object restart minitouch once we receive the event of the death
    // of the previous instance.
    else {
        this._isRestarting = true;
        this._minitouch.stop();
    }
};

InputWebSocketHandler.prototype._write = function (s) {
    this.stream.write(s);
};

InputWebSocketHandler.prototype.onInputWebSocketMessage = function (jsData) {
    var data = JSON.parse(jsData);

    if (data.msg == "input.mousedown")
        this.touchDown(data.contact, data.point, data.pressure);

    else if (data.msg == "input.mousemove")
        this.touchMove(data.contact, data.point, data.pressure);

    else if (data.msg == "input.mouseup")
        this.touchUp(data.contact);

    else if (data.msg == "input.keydown")
        this.keyDown(data.key);

    else if (data.msg == "input.keyup")
        this.keyUp(data.key);

    else if (data.msg == "input.type")
        this.type(data.text);

    this.touchCommit();
};

InputWebSocketHandler.prototype.type = function (text) {
    if (!this.banner) return;
    this.commandServer.type(text);
};

InputWebSocketHandler.prototype.keyDown = function (key) {
    if (!this.banner) return;
    this.commandServer.keyDown(key);
};

InputWebSocketHandler.prototype.keyUp = function (key) {
    if (!this.banner) return;
    this.commandServer.keyUp(key);
};

InputWebSocketHandler.prototype.touchDown = function (contact, point, pressure) {
    if (!this.banner) return;

    this._write(util.format(
        "d %s %s %s %s\n",
        contact,
        Math.floor(this.origin.x(point) * this.banner.maxX),
        Math.floor(this.origin.y(point) * this.banner.maxY),
        Math.floor((pressure || 0.5) * this.banner.maxPressure)
    ));
};

InputWebSocketHandler.prototype.touchMove = function (contact, point, pressure) {
    if (!this.banner) return;

    this._write(util.format(
        "m %s %s %s %s\n",
        contact,
        Math.floor(this.origin.x(point) * this.banner.maxX),
        Math.floor(this.origin.y(point) * this.banner.maxY),
        Math.floor((pressure || 0.5) * this.banner.maxPressure)
    ));
};

InputWebSocketHandler.prototype.touchUp = function (contact) {
    if (!this.banner) return;
    return this._write(util.format("u %s\n", contact));
};

InputWebSocketHandler.prototype.touchCommit = function() {
    return this._write("c\n");
};

InputWebSocketHandler.prototype.touchReset = function() {
    return this._write("r\n");
};

module.exports = InputWebSocketHandler;