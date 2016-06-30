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
    var mh, vw, vh, portrait;

    // nativeRes is the size of the screen at rotation 0.
    // This will calculate a roughly decent size for the screen
    // at rotation 0.

    mh = 0.90 * window.screen.availHeight;
    vh = mh;
    vw = (nativeRes.w / nativeRes.h) * vh;

    console.log("Return projection: " + vw + "x" + vh);

    switch (rot) {
        case 90:
        case 270:
            return {
                w: Math.ceil(vh),
                h: Math.ceil(vw),
                r: rot
            };
            break;
        case 0:
        case 180:
            return {
                w: Math.ceil(vw),
                h: Math.ceil(vh),
                r: rot
            };
    }
}

module.exports = {
    getSize: getSize
};