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
var async = require("async");
var cp = require("child_process");

var getprop = function (propName, resultCb) {
    var gp, stdout = "";

    gp = cp.spawn("/system/bin/getprop", [propName]);

    gp.stdout.on("data", function (data) {
        stdout += data.toString().trim();
    });

    gp.on("close", function () {
        if (stdout == "")
            return resultCb();

        return resultCb(null, stdout);
    });
};

var getprops =  function (props, resultCb) {
    async.map(props, getprop, function (err, results) {
        if (err) result(err);
        resultCb(null, _.object(props, results))
    });
};

module.exports = {
    getprop: getprop,
    getprops: getprops
};