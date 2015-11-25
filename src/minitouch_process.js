var util = require("util");
var path = require("path");
var fs = require("fs");
var uuid = require("uuid");

var props = require("./props.js");
var DaemonProcess = require("./daemon_process.js");

var Minitouch = function () {
    DaemonProcess.call(this);

    this.props = [
        "ro.product.cpu.abi",
        "ro.build.version.sdk"
    ];
};

util.inherits(Minitouch, DaemonProcess);

Minitouch.prototype.socketName = function () {
    return this._socketName;
};

Minitouch.prototype.start = function () {
    var self = this;

    this._socketName = uuid.v1();

    props.getprops(this.props, function (err, props) {
        if (err) throw err;

        var abi = props["ro.product.cpu.abi"];
        var sdk = props["ro.build.version.sdk"];
        var exec, bin;

        bin = sdk >= 16 ? "minitouch" : "minitouch-nopie";

        var args = [
            "-n", self._socketName
        ];
        exec = path.join(process.cwd(), "_bin", "minitouch", abi, bin);

        self._start(exec, args);
    });
};

module.exports = Minitouch;