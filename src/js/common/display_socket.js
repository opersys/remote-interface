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

/*
 * This wraps the basic functionality of the display websocket.
 */

var signals = require("signals");

var RETRY_COUNT = 5;

var DisplaySocket = function () {
    this.onOpen = new signals.Signal();
    this.onClose = new signals.Signal();
    this.onFrame = new signals.Signal();
    this.onInfo = new signals.Signal();

    this._expectClose = false;
    this._retryCount = RETRY_COUNT;

    this._connect();
};

DisplaySocket.prototype._connect = function () {
    this._ws = new WebSocket("ws://" + window.location.host + "/display", "minicap");
    this._ws.binaryType = 'blob';

    this._expectClose = false;

    this._ws.onopen = this._onOpen.bind(this);
    this._ws.onclose = this._onClose.bind(this);
};

DisplaySocket.prototype._onMessage = function (msg) {
    if (msg.data instanceof Blob) {
        console.log("Received display frame");
        this.onFrame.dispatch(msg.data);
    } else {
        var eventData = JSON.parse(msg.data);

        switch (eventData.event) {
            case "info":
                this.onInfo.dispatch(eventData.data);
                break;

            default:
                console.log("Received unknown event: " + eventData.event);
        }
    }
};

DisplaySocket.prototype._onOpen = function () {
    this._retryCount = RETRY_COUNT;
    this._ws.onmessage = this._onMessage.bind(this);
    this.onOpen.dispatch();
};

DisplaySocket.prototype._onClose = function () {
    if (!this._expectClose || this._retryCount == 0) {
        this.onClose.dispatch();
    }

    this._retryCount--;
};

DisplaySocket.prototype.shouldUpdateScreen = function () { 
    return this._ws.readyState === WebSocket.OPEN;
};

/*
 * It is important to set a geometry because we can't start "minicap" until this is set.
 */
DisplaySocket.prototype.geom = function (w, h) {
    if (this._ws.readyState === WebSocket.OPEN) {
        this._expectClose = true;
        this._ws.send("size " + w + "x" + h);
    }
};

module.exports = DisplaySocket;