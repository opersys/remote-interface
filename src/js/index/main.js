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

var Comm = require("../common/comm.js");
var Display = require("../common/display.js");

var devicePixelRatio = window.devicePixelRatio || 1;
var density = Math.max(1, Math.min(1.5, devicePixelRatio || 1));
var minscale = 0.36;

var ws, comm, disp;

function getWindowSize(dw, dh, rot) {

    function adjustBoundedSize(w, h) {
        var sw = w * density,
            sh = h * density,
            f;

        if (sw < (f = dw * minscale)) {
            sw *= f / sw;
            sh *= f / sh;
        }

        if (sh < (f = dh * minscale)) {
            sw *= f / sw;
            sh *= f / sh;
        }

        return {
            w: Math.ceil(sw),
            h: Math.ceil(sh),
            r: rot
        }
    }

    var w = 100;
    var h = 100;

    switch (rot) {
        case 90:
        case 270:
            return adjustBoundedSize(h, w);
        case 0:
        case 180:
        /* falls through */
        default:
            return adjustBoundedSize(w, h);
    }
}

function onCommInfo(info) {
    document.getElementById("info-manufacturer").textContent = info.manufacturer;
    document.getElementById("info-model").textContent = info.model;
    document.getElementById("info-abi").textContent = info.abi;

    ws = getWindowSize(info.displaySize.x, info.displaySize.y, info.rotation);

    disp.geom(ws.w, ws.h);
}

function onDisplayInfo(info) {
    document.getElementById("info-display").textContent = info.realWidth + "x" + info.realHeight;
    ws.w = info.virtualWidth;
    ws.h = info.virtualHeight;
}

function onLoad() {
    comm = new Comm();
    comm.onInfo.add(onCommInfo);

    disp = new Display();
    disp.onInfo.add(onDisplayInfo);
}

function openDisplay() {
    window.open("display.html", "Remote Display", "menubar=no,status=no,width=" + ws.w + ",height=" + ws.h);
}

module.exports = {
    openDisplay: openDisplay,
    onLoad: onLoad
};