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

var debug = require("debug")("RI.ws.event");

var EventWebSocketHandler = function (wss, screenwatcher) {
    this.screenwatcher = screenwatcher;
    this.screenwatcher.screenWatcherRotationSignal.add(this.onScreenWatcherRotation.bind(this));
    //this.commandServer.screenWatcherErrorSignal(this.onScreenWatcherError

    wss.on("connection", this.onEventWebSocketConnected.bind(this));
};

EventWebSocketHandler.prototype.onEventWebSocketConnected = function (ws) {
    debug("Web socket connected");

    this.ws = ws;
    this.screenwatcher.start();

    this.ws.on("close", this.onEventWebSocketClose.bind(this));
};

EventWebSocketHandler.prototype.onEventWebSocketClose = function () {
    debug("Web socket disconnected");
};

EventWebSocketHandler.prototype.onScreenWatcherRotation = function (rotation) {
    this.ws.send(JSON.stringify({event: "rotation", data: rotation}));
};

module.exports = EventWebSocketHandler;