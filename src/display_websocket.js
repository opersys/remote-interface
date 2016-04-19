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

var _ = require("underscore");
var async = require("async");
var fs = require("fs");
var debug = require("debug")("RI.ws.display");
var util = require("util");
var uuid = require("uuid");
var path = require("path");

var Display = require("./display_info.js");
var Minicap = require("./minicap_process.js");
var MinicapHelper = require("./daemon_process_helpers");

var DisplayWebSocketHandler = function (wss, screenwatcher, props) {
    this._isRestarting = false;
    this._readBannerBytes = 0;
    this._bannerLength = 2;
    this._readFrameBytes = 0;
    this._frameBodyLength = 0;
    this._frameBody = new Buffer(0);
    this._props = props;

    this._initialSize = Display.getInitialDisplaySize(0);
    this._baseSize = Display.getBaseDisplaySize(0);
    this._currentRotation = Display.getRotation(props["ro.build.version.sdk"]);
    this._currentSize = this._baseSize;

    if (!this._initialSize)
        throw "Could not get initial screen size";
    if (!this._baseSize)
        throw "Could not get base screen size";
    if (!this._currentRotation)
        throw "Could not get current screen rotation";

    this._clearBanner();

    this._screenwatcher = screenwatcher;
    this._screenwatcher.rotationSignal.add(this.onRotation.bind(this));

    wss.on("connection", this.onDisplayWebSocketConnect.bind(this));
};

DisplayWebSocketHandler.prototype._clearBanner = function () {
    this._banner = {
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
    this._readBannerBytes = 0;
};

DisplayWebSocketHandler.prototype._sendBannerInfo = function () {
    debug("Sending banner info: " + util.inspect(this._banner));

    this.ws.send(JSON.stringify({
        event: "info",
        data: {
            realWidth: this._banner.realWidth,
            realHeight: this._banner.realHeight,
            virtualWidth: this._banner.virtualWidth,
            virtualHeight: this._banner.virtualHeight
        }
    }));
};

DisplayWebSocketHandler.prototype.onDisplayWebSocketConnect = function (ws) {
    debug("Web socket connected");

    this.ws = ws;

    if (!this._minicap)
        this.startOrRestartMinicap();
    else
        // If there is already a minicap instance running, send back the same _banner info.
        this._sendBannerInfo();

    ws.on("close", this.onDisplayWebSocketClose.bind(this));
    ws.on("message", this.onDisplayWebSocketMessage.bind(this));
};

DisplayWebSocketHandler.prototype.onRotation = function (rot) {
    debug("Device rotated, restarting minicap (angle: " + rot + ")");

    // Change the new geometry of minicap.
    this.geom(null, rot);
};

DisplayWebSocketHandler.prototype.onDisplayWebSocketClose = function () {
    debug("Web socket disconnected");

    this._currentSize = null;
    this._currentRotation = 0;

    this.ws = null;
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

            case "size":
                this.geom({x: +match[3], y: +match[4]});
        }
    }
};

DisplayWebSocketHandler.prototype.geom = function (ns, rot) {
    var newSize = (ns != null ? ns : this._currentSize);
    var newRot = (rot != null ? rot : this._currentRotation);

    if (_.isEqual(newSize, this._currentSize) && this._currentRotation == newRot) {
        debug("Current geometry stays active: "
            + this._currentSize.x + "x" + this._currentSize.y + "/" + this._currentRotation);
        return;
    }

    this._currentSize = newSize;
    this._currentRotation = newRot;

    debug("New geometry received: "
        + this._currentSize.x + "x" + this._currentSize.y + "/" + this._currentRotation);

    this.startOrRestartMinicap();
};

DisplayWebSocketHandler.prototype._onStreamTryRead = function tryRead() {
    try {
        for (var chunk; (chunk = this.stream.read());) {
            for (var cursor = 0, len = chunk.length; cursor < len;) {
                if (this._readBannerBytes < this._bannerLength) {
                    switch (this._readBannerBytes) {
                        case 0:
                            // version
                            this._banner.version = chunk[cursor];
                            break;
                        case 1:
                            // length
                            this._banner.length = this._bannerLength = chunk[cursor];
                            break;
                        case 2:
                        case 3:
                        case 4:
                        case 5:
                            // pid
                            this._banner.pid += (chunk[cursor] << ((this._readBannerBytes - 2) * 8)) >>> 0;
                            break;
                        case 6:
                        case 7:
                        case 8:
                        case 9:
                            // real width
                            this._banner.realWidth += (chunk[cursor] << ((this._readBannerBytes - 6) * 8)) >>> 0;
                            break;
                        case 10:
                        case 11:
                        case 12:
                        case 13:
                            // real height
                            this._banner.realHeight += (chunk[cursor] << ((this._readBannerBytes - 10) * 8)) >>> 0;
                            break;
                        case 14:
                        case 15:
                        case 16:
                        case 17:
                            // virtual width
                            this._banner.virtualWidth += (chunk[cursor] << ((this._readBannerBytes - 14) * 8)) >>> 0;
                            break;
                        case 18:
                        case 19:
                        case 20:
                        case 21:
                            // virtual height
                            this._banner.virtualHeight += (chunk[cursor] << ((this._readBannerBytes - 18) * 8)) >>> 0;
                            break;
                        case 22:
                            // orientation
                            this._banner.orientation += chunk[cursor] * 90;
                            break;
                        case 23:
                            // quirks
                            this._banner.quirks = chunk[cursor];
                            break
                    }

                    cursor += 1;
                    this._readBannerBytes += 1;

                    if (this._readBannerBytes === this._bannerLength)
                        this._sendBannerInfo();
                }
                else if (this._readFrameBytes < 4) {
                    this._frameBodyLength += (chunk[cursor] << (this._readFrameBytes * 8)) >>> 0;
                    cursor += 1;
                    this._readFrameBytes += 1;
                }
                else {
                    if (len - cursor >= this._frameBodyLength) {
                        this._frameBody = Buffer.concat([
                            this._frameBody,
                            chunk.slice(cursor, cursor + this._frameBodyLength)
                        ]);

                        // Sanity check for JPG header, only here for debugging purposes.
                        if (this._frameBody[0] !== 0xFF || this._frameBody[1] !== 0xD8) {
                            console.error('Frame body does not start with JPG header', this._frameBody);
                            process.exit(1)
                        }

                        this.ws.send(this._frameBody, {
                            binary: true
                        });

                        cursor += this._frameBodyLength;
                        this._frameBodyLength = this._readFrameBytes = 0;
                        this._frameBody = new Buffer(0);
                    }
                    else {
                        this._frameBody = Buffer.concat([
                            this._frameBody,
                            chunk.slice(cursor, len)
                        ]);

                        this._frameBodyLength -= len - cursor;
                        this._readFrameBytes += len - cursor;
                        cursor = len
                    }
                }
            }
        }
    } catch (e) {
        debug("Read() returned an error: " + e);
        if (!this.ws) this._onStreamError();
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
    } else {
        var s = "Can't connect websocket with minicap: ";

        if (!this.ws)
            debug(s + "No websocket link established");
        if (!this.stream)
            debug(s + "No stream created");
    }
};

DisplayWebSocketHandler.prototype._onMinicapError = function (err, stdoutStr, stderrStr) {
    if (err)
        debug("Minicap process error: " + err);
    else
        debug("Minicap process error");

    debug("STDOUT: " + stdoutStr);
    debug("STDERR: " + stderrStr);
};

DisplayWebSocketHandler.prototype._onMinicapStarted = function () {
    debug("Minicap started, trying to connect");

    return MinicapHelper.process_connect.apply(this, ["minicap", this._minicap, function (stream) {
        debug("Successfully connected to minicap");

        this.stream = stream;

        this._clearBanner();
        this._connectStreams();
    }]);
};

DisplayWebSocketHandler.prototype._onMinicapStopping = function () {
    // We don't want to hear about this process anymore.
    this._minicap.startedSignal.remove(this._startedSignalHandler);
    this._minicap.stoppingSignal.remove(this._stoppingSignalHandler);
    this._minicap.errorSignal.remove(this._errorSignalHandler);

    // Close the stream to minicap if it's open.
    if (this.stream) {
        this._disconnectStreams();

        this.stream.end();
        this.stream = null;
    }

    if (this._isRestarting) this._startMinicap();
};

DisplayWebSocketHandler.prototype._startMinicap = function () {
    this._minicap = new Minicap(this._props);

    this._startedSignalHandler = this._onMinicapStarted.bind(this);
    this._stoppingSignalHandler = this._onMinicapStopping.bind(this);
    this._errorSignalHandler = this._onMinicapError.bind(this);
    this._isRestarting = false;

    this._minicap.startedSignal.add(this._startedSignalHandler);
    this._minicap.stoppingSignal.add(this._stoppingSignalHandler);
    this._minicap.errorSignal.add(this._errorSignalHandler);

    this._minicap.startCapture(this._initialSize, this._currentSize, this._currentRotation);
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