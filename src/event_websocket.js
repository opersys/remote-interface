var debug = require("debug")("RI.ws.event");

var EventWebSocketHandler = function (wss, screenwatcher) {
    this.screenwatcher = screenwatcher;
    this.screenwatcher.screenWatcherRotationSignal.add(this.onScreenWatcherRotation.bind(this));
    //this.screenwatcher.screenWatcherErrorSignal(this.onScreenWatcherError

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