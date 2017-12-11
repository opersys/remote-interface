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

var CommSocket = require("../common/comm_socket.js");
var DisplaySocket = require("../common/display_socket.js");
var Window = require("../common/window.js");

//var devicePixelRatio = window.devicePixelRatio || 1;
//var density = Math.max(1, Math.min(1.5, devicePixelRatio || 1));
//var minscale = 0.36;

var virtualRes, nativeRes, actualRot, comm, disp, firstFrame = null;

function onCommInfo(info) {
    document.getElementById("info-manufacturer").textContent = info.manufacturer;
    document.getElementById("info-model").textContent = info.model;
    document.getElementById("info-abi").textContent = info.abi;

    // Clear the previous virtualRes on rotation.
    if (info.rotation != actualRot && nativeRes)
        virtualRes = Window.getSize(nativeRes, info.rotation);

    // Save the new rotation.
    actualRot = info.rotation;
}

function onRotation(rotation) {
    if (rotation != actualRot && nativeRes)
        virtualRes = Window.getSize(nativeRes, rotation);

    actualRot = rotation;
}

function onDisplayInfo(info) {
    document.getElementById("info-display").textContent = info.realWidth + "x" + info.realHeight;
    document.getElementById("info-virt").textContent = info.virtualWidth + "x" + info.virtualHeight;

    // This has to be the resolution has reported by the device, without rotation.
    nativeRes = {w: info.realWidth, h: info.realHeight};

    // Calculate a good virtual resolution if nativeRes is available.
    if (actualRot != null && nativeRes)
        virtualRes = Window.getSize(nativeRes, actualRot);

    console.assert(nativeRes != null);
    console.assert(nativeRes.w != null && nativeRes.h != null);
}

function refreshPreview() {
    var url, pimg;

    if (firstFrame != null) {
        url = URL.createObjectURL(firstFrame);
        pimg = document.getElementById("previewImage");
        pimg.setAttribute("src", url);
    }
}

function onDisplayFrame(frame) {
    firstFrame = frame;
}

module.exports.onLoad = function () {
    window.comm = new CommSocket();
    window.comm.onInfo.add(onCommInfo);
    window.comm.onRotation.add(onRotation);

    window.disp = new DisplaySocket();
    window.disp.onInfo.add(onDisplayInfo);
    window.disp.onFrame.add(onDisplayFrame);

    setInterval(refreshPreview, 2000);
};

module.exports.openDisplay = function () {
    var parent = window;
    var win = window.open("display.html", "Remote Display",
        "menubar=no,status=no,innerWidth=" + virtualRes.w + ",innerHeight=" + virtualRes.h);

    win.addEventListener("load", function () {
        win.JS.runDisplay(parent.comm, parent.disp, firstFrame, nativeRes, virtualRes, actualRot);
    });
};