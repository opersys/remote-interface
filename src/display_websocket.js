var _ = require("underscore");
var async = require("async");
var fs = require("fs");
var debug = require("debug")("RI.ws.display");
var abs = require("abstract-socket");
var util = require("util");
var cp = require("child_process");
var uuid = require("uuid");
var Binder = require("jsbinder");
var path = require("path");

var props = require("./props.js");
var Minicap = require("./minicap_process.js");
var MinicapHelper = require("./daemon_process_helpers");

// JSBINDER HELPER FUNCTIONS

function getDisplaySize(wm, transNo, dispNo) {
    var data = new Binder.Parcel();
    var reply = new Binder.Parcel();
    var p = {};

    data.writeInterfaceToken("android.view.IWindowManager");
    data.writeInt32(dispNo);

    reply = wm.transact(transNo, data, reply, 0);

    reply.readExceptionCode();
    var n = reply.readInt32();

    if (n < 1) throw "Expected '0' or '1' return values, got: " + n;

    if (n) {
        p.x = reply.readInt32();
        p.y = reply.readInt32();
    } else
        throw "no return value";

    return p;
}

function getInitialDisplaySize(wm, dispNo) {
    return getDisplaySize(wm, 6, dispNo);
}

function getBaseDisplaySize(wm, dispNo) {
    return getDisplaySize(wm, 7, dispNo);
}

// END JSBINDER HELPER

var DisplayWebSocketHandler = function (wss, screenwatcher) {
    var sm = new Binder.ServiceManager();
    var wm = sm.getService("window");

    this.initialSize = getInitialDisplaySize(wm, 0);
    this.baseSize = getBaseDisplaySize(wm, 0);
    this.currentSize = this.baseSize;
    this.currentRotation = 0;

    this._isRestarting = false;

    this.readBannerBytes = 0;
    this.bannerLength = 2;
    this.readFrameBytes = 0;
    this.frameBodyLength = 0;
    this.frameBody = new Buffer(0);
    this._clearBanner();

    this.screenwatcher = screenwatcher;
    this.screenwatcher.screenWatcherRotationSignal.add(this.onScreenWatcherRotation.bind(this));

    wss.on("connection", this.onDisplayWebSocketConnect.bind(this));
};

DisplayWebSocketHandler.prototype._clearBanner = function () {
    this.banner = {
        version: 0,
        length: 0,
        pid: 0,
        realWidth: 0,
        realHeight: 0,
        virtualWidth: 0,
        virtualHeight: 0,
        orientation: 0,
        quirks: 0
    };
    this.readBannerBytes = 0;
};

DisplayWebSocketHandler.prototype.onDisplayWebSocketConnect = function (ws) {
    debug("Web socket connected");

    this.ws = ws;

    this._connectStreams();

    ws.on("close", this.onDisplayWebSocketClose.bind(this));
    ws.on("message", this.onDisplayWebSocketMessage.bind(this));
};

DisplayWebSocketHandler.prototype.onScreenWatcherRotation = function (rot) {
    debug("Device rotated, restarting minicap (angle: " + rot + ")");

    // Change the new geometry of minicap.
    this.geom(null, rot);
};

DisplayWebSocketHandler.prototype.onDisplayWebSocketClose = function () {
    debug("Web socket disconnected");
};

DisplayWebSocketHandler.prototype.onDisplayWebSocketMessage = function (data) {
    var match;

    debug("Received message: "  + data);

    if ((match = /^(on|off|(size) ([0-9]+)x([0-9]+))$/.exec(data))) {
        switch (match[2] || match[1]) {
            case "on":
                //this.minicap.start();
                break;

            case "off":
                //this.minicap.stop();
                break;

            case 'size':
                this.geom({x: +match[3], y: +match[4]});
        }
    }
};

DisplayWebSocketHandler.prototype.geom = function (ns, rot) {
    var newSize = (ns != null ? ns : this.currentSize);
    var newRot = (rot != null ? rot : this.currentRotation);

    if (_.isEqual(newSize, this.currentSize) && this.currentRotation == newRot) {
        debug("Current geometry stays active: "
            + this.currentSize.x + "x" + this.currentSize.y + "/" + this.currentRotation);
        return;
    }

    this.currentSize = newSize;
    this.currentRotation = newRot;

    debug("New geometry received: "
        + this.currentSize.x + "x" + this.currentSize.y + "/" + this.currentRotation);

    this.startOrRestartMinicap();
};

DisplayWebSocketHandler.prototype._onStreamTryRead = function tryRead() {
    try {
        for (var chunk; (chunk = this.stream.read());) {
            for (var cursor = 0, len = chunk.length; cursor < len;) {
                if (this.readBannerBytes < this.bannerLength) {
                    switch (this.readBannerBytes) {
                        case 0:
                            // version
                            this.banner.version = chunk[cursor];
                            break;
                        case 1:
                            // length
                            this.banner.length = this.bannerLength = chunk[cursor];
                            break;
                        case 2:
                        case 3:
                        case 4:
                        case 5:
                            // pid
                            this.banner.pid += (chunk[cursor] << ((this.readBannerBytes - 2) * 8)) >>> 0;
                            break;
                        case 6:
                        case 7:
                        case 8:
                        case 9:
                            // real width
                            this.banner.realWidth += (chunk[cursor] << ((this.readBannerBytes - 6) * 8)) >>> 0;
                            break;
                        case 10:
                        case 11:
                        case 12:
                        case 13:
                            // real height
                            this.banner.realHeight += (chunk[cursor] << ((this.readBannerBytes - 10) * 8)) >>> 0;
                            break;
                        case 14:
                        case 15:
                        case 16:
                        case 17:
                            // virtual width
                            this.banner.virtualWidth += (chunk[cursor] << ((this.readBannerBytes - 14) * 8)) >>> 0;
                            break;
                        case 18:
                        case 19:
                        case 20:
                        case 21:
                            // virtual height
                            this.banner.virtualHeight += (chunk[cursor] << ((this.readBannerBytes - 18) * 8)) >>> 0;
                            break;
                        case 22:
                            // orientation
                            this.banner.orientation += chunk[cursor] * 90;
                            break;
                        case 23:
                            // quirks
                            this.banner.quirks = chunk[cursor];
                            break
                    }

                    cursor += 1;
                    this.readBannerBytes += 1;

                    // FIXME: Not sure what this is.
                    if (this.readBannerBytes === this.bannerLength) {
                        debug('banner ' + util.inspect(this.banner));
                    }
                }
                else if (this.readFrameBytes < 4) {
                    this.frameBodyLength += (chunk[cursor] << (this.readFrameBytes * 8)) >>> 0;
                    cursor += 1;
                    this.readFrameBytes += 1;
                }
                else {
                    if (len - cursor >= this.frameBodyLength) {
                        this.frameBody = Buffer.concat([
                            this.frameBody,
                            chunk.slice(cursor, cursor + this.frameBodyLength)
                        ]);

                        // Sanity check for JPG header, only here for debugging purposes.
                        if (this.frameBody[0] !== 0xFF || this.frameBody[1] !== 0xD8) {
                            console.error('Frame body does not start with JPG header', this.frameBody);
                            process.exit(1)
                        }

                        this.ws.send(this.frameBody, {
                            binary: true
                        });

                        cursor += this.frameBodyLength;
                        this.frameBodyLength = this.readFrameBytes = 0;
                        this.frameBody = new Buffer(0);
                    }
                    else {
                        this.frameBody = Buffer.concat([
                            this.frameBody,
                            chunk.slice(cursor, len)
                        ]);

                        this.frameBodyLength -= len - cursor;
                        this.readFrameBytes += len - cursor;
                        cursor = len
                    }
                }
            }
        }
    } catch (e) {
        debug("Read() returned an error: " + e);
    }
};

DisplayWebSocketHandler.prototype._onStreamError = function () {
    debug("Stream error reading from socket: process is likely dying");
    this._disconnectStreams();
};

DisplayWebSocketHandler.prototype._disconnectStreams = function () {
    if (this._streamErrorHandler)
        this.stream.removeListener("error", this._streamErrorHandler);

    if (this._streamTryReadHandler)
        this.stream.removeListener("readable", this._streamTryReadHandler);

    this._streamErrorHandler = null;
    this._streamTryReadHandler = null;
};

DisplayWebSocketHandler.prototype._connectStreams = function () {
    if (this.ws && this.stream && !this._streamErrorHandler && !this._streamTryReadHandler) {
        this._streamErrorHandler = this._onStreamError.bind(this);
        this._streamReadableHandler = this._onStreamTryRead.bind(this);

        this.stream.on("error", this._streamErrorHandler);
        this.stream.on("readable", this._streamReadableHandler);
    }
};

DisplayWebSocketHandler.prototype._onMinicapStarted = function () {
    return MinicapHelper.process_connect.apply(this, ["minicap", this._minicap, function (stream) {
        this.stream = stream;

        this._clearBanner();
        this._connectStreams();
    }]);
};

DisplayWebSocketHandler.prototype._onMinicapStopping = function () {
    // We don't want to hear about this process anymore.
    this._minicap.startedSignal.remove(this._startedSignalHandler);
    this._minicap.stoppingSignal.remove(this._stoppingSignalHandler);

    // Close the stream to minicap if it's open.
    if (this.stream) {
        this._disconnectStreams();

        this.stream.end();
        this.stream = null;
    }

    // Close the websocket if it's open.
    /*if (this.ws) {
        this.ws.close();
        this.ws = null
    } */

    if (this._isRestarting) this._startMinicap();
};

DisplayWebSocketHandler.prototype._startMinicap = function () {
    this._minicap = new Minicap();
    this._minicap.start(this.initialSize, this.currentSize, this.currentRotation);

    this._startedSignalHandler = this._onMinicapStarted.bind(this);
    this._stoppingSignalHandler = this._onMinicapStopping.bind(this);
    this._isRestarting = false;

    this._minicap.startedSignal.add(this._startedSignalHandler);
    this._minicap.stoppingSignal.add(this._stoppingSignalHandler);
};

DisplayWebSocketHandler.prototype.startOrRestartMinicap = function () {
    if (!this._minicap)
        this._startMinicap();

    // This will make object restart minicap once we receive the event of the death
    // of the previous instance.
    else {
        this._isRestarting = true;
        this._minicap.stop();
    }
};

module.exports = DisplayWebSocketHandler;