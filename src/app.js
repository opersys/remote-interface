var _ = require("underscore");
var WebSocketServer = require("ws").Server;
var http = require("http");
var express = require("express");
var net = require("net");
var abs = require("abstract-socket");
var cp = require("child_process");
var Binder = require("jsbinder");
var path = require("path");
var debug = require("debug")("RI");
//require("longjohn");

var ScreenWatcher = require("./commandserver.js");
var DisplayWebSocketHandler = require("./display_websocket.js");
var InputWebSocketHandler = require("./input_websocket.js");
var EventWebSocketHandler = require("./event_websocket.js");

var app = express();
var PORT = process.env.PORT || 9002;

app.use(express.static(path.join(__dirname, '/public')));

debug("Listening on port %d", PORT);

var server = http.createServer(app);
var wssmc = new WebSocketServer({ server: server, path: "/minicap" });
var wssmt = new WebSocketServer({ server: server, path: "/minitouch" });
var wsev = new WebSocketServer({ server: server, path: "/events" });
var screenwatcher = new ScreenWatcher();

new DisplayWebSocketHandler(wssmc, screenwatcher);
new InputWebSocketHandler(wssmt, screenwatcher);
new EventWebSocketHandler(wsev, screenwatcher);

server.listen(PORT);
