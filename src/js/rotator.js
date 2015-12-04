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

/*
 * This file was obtained from the STFAgent.apk repository in the OpenSTF project, at this URL:
 *
 * https://github.com/openstf/stf/blob/master/res/app/components/stf/screen/rotator.js
 *
 * The is under an Apache 2.0 License:
 *
 * https://github.com/openstf/stf/blob/master/LICENSE
 *
 * The file was changed lightly to integrate with the rest of the project.
 */

var mapping = {
    0: {
        0: 0
        , 90: -90
        , 180: -180
        , 270: 90
    }
    , 90: {
        0: 90
        , 90: 0
        , 180: -90
        , 270: 180
    }
    , 180: {
        0: 180
        , 90: 90
        , 180: 0
        , 270: -90
    }
    , 270: {
        0: -90
        , 90: -180
        , 180: 90
        , 270: 0
    }
};

module.exports = function rotator(oldRotation, newRotation) {
    var r1 = oldRotation < 0 ? 360 + oldRotation % 360 : oldRotation % 360
        , r2 = newRotation < 0 ? 360 + newRotation % 360 : newRotation % 360

    return mapping[r1][r2]
};