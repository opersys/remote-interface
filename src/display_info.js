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

var Binder = require("jsbinder");

var sm = new Binder.ServiceManager();
var wm = sm.getService("window");

function getDisplaySize(transNo, dispNo) {
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

function getInitialDisplaySize(dispNo) {
    return getDisplaySize(6, dispNo);
}

function getBaseDisplaySize(dispNo) {
    return getDisplaySize(7, dispNo);
}

function getRotation() {
    var data = new Binder.Parcel();
    var reply = new Binder.Parcel();

    data.writeInterfaceToken("android.view.IWindowManager");
    reply = wm.transact(62, data, reply, 0);

    reply.readExceptionCode();
    var r = reply.readInt32();

    switch (r) {
        case 0: return 0;
        case 1: return 90;
        case 2: return 180;
        case 3: return 270;
    }
}

module.exports = {
    getDisplaySize: getDisplaySize,
    getInitialDisplaySize: getInitialDisplaySize,
    getBaseDisplaySize: getBaseDisplaySize,
    getRotation: getRotation
};