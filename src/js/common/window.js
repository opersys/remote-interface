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

function getSize(nativeRes, rot) {
    var mh, mw, vw, vh;

    mh = 0.75 * window.screen.availHeight;
    mw = 0.75 * window.screen.availWidth;

    switch (rot) {
        case 90:
        case 270:
            vw = mw;
            vh = (nativeRes.w / nativeRes.h) * vw;
            break;
        case 0:
        case 180:
        default:
            vh = mh;
            vw = (nativeRes.w / nativeRes.h) * vh;
    }

    console.log("Return projection: " + vw + "x" + vh);

    return {
        w: Math.ceil(vw),
        h: Math.ceil(vh),
        r: rot
    };
}

module.exports = {
    getSize: getSize
};