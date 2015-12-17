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

var signals = require("signals");

var CommSocket = function () {
    this.onOpen = new signals.Signal();
    this.onClose = new signals.Signal();
    this.onRotation = new signals.Signal();
    this.onInfo = new signals.Signal();

    this._ws = new WebSocket("ws://" + window.location.host + "/comm", "minitouch");
    this._ws.onopen = this._onOpen.bind(this);
    this._ws.onclose = this._onClose.bind(this);
};

CommSocket.prototype._onMessage = function (msg) {
    var eventData = JSON.parse(msg.data);

    switch (eventData.event) {
        case "rotation":
            this.onRotation.dispatch(eventData.data);
            break;

        case "info":
            this.onInfo.dispatch(eventData.data);
            break;

        default:
            console.log("Unhandled event type: " + eventData.event);
    }
};

CommSocket.prototype._onOpen = function () {
    this._ws.onmessage = this._onMessage.bind(this);
    this.onOpen.dispatch();
};

CommSocket.prototype._onClose = function () {
    this.onClose.dispatch();
};

CommSocket.prototype.mouseDown = function (point) {
    this._ws.send(JSON.stringify({
        cmd: "mouse.down",
        contact: 0,
        point:point,
        pressure: 0.5
    }));
};

CommSocket.prototype.mouseUp = function (point) {
    this._ws.send(JSON.stringify({
        cmd: "mouse.up",
        contact: 0,
        point:point,
        pressure: 0.5
    }));
};

CommSocket.prototype.mouseMove = function (point) {
    this._ws.send(JSON.stringify({
        cmd: "mouse.move",
        contact: 0,
        point:point,
        pressure: 0.5
    }));
};

CommSocket.prototype.type = function(text) {
    this._ws.send(JSON.stringify({
        cmd: "input.type",
        text: text
    }));
};

module.exports = CommSocket;