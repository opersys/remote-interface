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

var CommandServer = require("./commandserver.js");
var DisplayWebSocketHandler = require("./display_websocket.js");
var CommWebSocketHandler = require("./comm_websocket.js");

var app = express();

app.use(express.static(path.join(__dirname, '/public')));

var argv = require("yargs")
    .options({
        "p": {
            alias: "port",
            "default": "3000",
            type: "number"
        },
        "e": {
            alias: "environment",
            "default": "development",
            type: "string"
        },
        "s": {
            alias: "socket",
            type: "string"
        }
    }).argv;

app.set("env", argv.environment);
app.set("port", argv.port);
app.set("socket", argv.socket);

debug("Listening on port %d", app.get("port"));

var server = http.createServer(app);
var wssmc = new WebSocketServer({ server: server, path: "/display" });
var wssmt = new WebSocketServer({ server: server, path: "/comm" });

var commandServer = new CommandServer();
commandServer.start();

new DisplayWebSocketHandler(wssmc, commandServer);
new CommWebSocketHandler(wssmt, commandServer);

server.listen(app.get("port"));

// Handle receiving the "quit" command from the UI.
process.stdin.on("data", function (chunk) {
    var cmd, params, cs;

    cs = chunk.toString().split("\n")[0].trim().split(" ");

    cmd = cs.shift().toLowerCase();

    if (cmd == "quit")
        process.exit();
    else
        console.log("Unknown command: " + cmd)
});

