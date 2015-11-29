var cp = require("child_process");
var signals = require("signals");
var debug = require("debug")("RI.sw");
var path = require("path");
var util = require("util");

var CommandServer = function () {
    this. screenWatcherRotationSignal = new signals.Signal();
    this.screenWatcherErrorSignal = new signals.Signal();
    this.screenWatcherStopSignal = new signals.Signal();

    this._sw = null;
};

CommandServer.prototype.keyDown = function (key, meta) {
    if (!this._sw) return;
    this._sw.stdin.write(util.format("keydown %d %d\n", key, 0));
};

CommandServer.prototype.keyUp = function (key, meta) {
    if (!this._sw) return;
    this._sw.stdin.write(util.format("keyup %d %d\n", key, 0));
};

CommandServer.prototype.type = function (str) {
    if (!this._sw) return;
    this._sw.stdin.write(util.format("type %s\n", str));
};

CommandServer.prototype.setRotation = function (n) {
    if (!this._sw) return;
    this._sw.stdint.write("rotate " + n);
};

CommandServer.prototype.start = function start() {
    var self = this;

    debug("Starting CommandServer");

    process.env["CLASSPATH"] = path.join("_bin", "cmdserver.apk");

    this._sw = cp.spawn("/system/bin/app_process", [".", "com.opersys.remoteinterface.CommandServer"]);

    this._sw.stdout.on("data", function (data) {
        var r, rots = data.toString();

        /* The screenwatcher just sends a single number telling the current rotation of the device.
         * We expect that we will receive at least a full line each time this is called. If we receive
         * more than one line, only the last one is kept */

        r = rots.trim().split(/\n/);
        if (!r)
            debug("Received " + rots + " instead of full line, discarding");
        else {
            var angle = +r.slice(-1)[0];

            debug("Rotation: " + angle);
            self.screenWatcherRotationSignal.dispatch(angle);
        }
    });

    this._sw.on("close", function () {
        self.screenWatcherStopSignal.dispatch();
    });

    this._sw.on("error", function (err) {
        self.screenWatcherErrorSignal.dispatch(err);

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