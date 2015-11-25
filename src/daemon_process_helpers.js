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