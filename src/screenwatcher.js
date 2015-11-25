var cp = require("child_process");
var signals = require("signals");
var debug = require("debug")("RI.sw");
var path = require("path");

var ScreenWatcher = function () {
    this.screenWatcherRotationSignal = new signals.Signal();
    this.screenWatcherErrorSignal = new signals.Signal();
    this.screenWatcherStopSignal = new signals.Signal();

    this._sw = null;
};

ScreenWatcher.prototype.start = function start() {
    var self = this;

    debug("Starting ScreenWatcher");

    process.env["CLASSPATH"] = path.join("_bin", "screenwatcher.apk");

    this._sw = cp.spawn("/system/bin/app_process", [".", "com.opersys.remoteinterface.ScreenWatcher"]);

    this._sw.stdout.on("data", function (data) {
        var r, rots = data.toString();

        /* The screenwatcher just sends a single number telling the current rotation of the device.
         * We expect that we will receive at least a full line each time this is called. If we receive
         * more than one line, only the last one is kept */

        r = rots.trim().split(/\n/);
        if (!r)
            debug("Received " + rots + " instead of full line, discarding");
        else {
            //var util = require("util");
            //console.log(util.inspect(r));
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

        debug("Error launching ScreenWatcher: " + err);
    });
};

ScreenWatcher.prototype.stop = function stop() {
    debug("Stopping ScreenWatcher");

    if (this._sw) {
        this._sw.kill();
        this._sw = null;
    }
};

module.exports = ScreenWatcher;