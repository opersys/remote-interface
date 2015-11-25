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