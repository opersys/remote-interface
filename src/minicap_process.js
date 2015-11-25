var util = require("util");
var path = require("path");
var fs = require("fs");
var uuid = require("uuid");

var props = require("./props.js");
var DaemonProcess = require("./daemon_process.js");

var Minicap = function () {
    DaemonProcess.call(this);

    this.props = [
        "ro.product.cpu.abi",
        "ro.build.version.sdk",
        "ro.build.version.release"
    ];
};

util.inherits(Minicap, DaemonProcess);

Minicap.prototype.socketName = function () {
    return this._socketName;
};

Minicap.prototype.start = function (initialSize, currentSize, currentRotation) {
    var self = this;

    DaemonProcess.prototype.start.apply(this);

    this._socketName = uuid.v1();

    props.getprops(this.props, function (err, props) {
        if (err) throw err;

        var abi = props["ro.product.cpu.abi"];
        var sdk = props["ro.build.version.sdk"];
        var rel = props["ro.build.version.release"];
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

        exec = path.join(process.cwd(), "_bin", "minicap", abi, bin);

        self._start(exec, args);
    });
};

module.exports = Minicap;