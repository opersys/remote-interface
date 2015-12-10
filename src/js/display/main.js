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
 * A lot of the code below was taken from OpenSTF:
 *
 * https://github.com/openstf/stf/blob/master/res/app/components/stf/screen/screen-directive.js
 *
 * The project is under an Apache 2.0 License:
 *
 * https://github.com/openstf/stf/blob/master/LICENSE
 *
 * ...and then beaten mercilessly into submission.
 */

var _ = require("underscore");

var ImagePool = require("./imagepool.js");
var rotator = require("./rotator.js");
var ScalingService = require("./scaler.js");
var Keyboard = require("./keyboard.js");
var Comm = require("../common/comm.js");
var Display = require("../common/display.js");

var BLANK_IMG = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

var canvas = document.getElementById("device-screen-canvas"),
    positioner = document.getElementById("positioner"),
    input = document.getElementById("input"),
    g = canvas.getContext('2d');

// RELATIVELY CLEANER CODE STARTS HERE.

var comm = new Comm();
var disp = new Display();
var keyboard = new Keyboard(comm);

comm.onRotation.add(function (angle) {
    console.log("Device rotation: " + angle);

    device.display.rotation = angle;
});

comm.onOpen.add(function () {
    canvas.addEventListener("mousedown", mouseDown);
    canvas.addEventListener("mousemove", mouseMove);
    canvas.addEventListener("mouseup", mouseUp);
    canvas.addEventListener("mouseleave", mouseUp);

    input.addEventListener("keydown", keydownListener);
    input.addEventListener("keyup", keyupListener);
    input.addEventListener("input", inputListener);
});

comm.onClose.add(function () {
    // TODO: Display a warning overlay here.
});

disp.onOpen.add(function () {
    checkEnabled();
});

disp.onFrame.add((function() {
    var cachedScreen = {
        rotation: 0,
        bounds: {
            x: 0,
            y: 0,
            w: 0,
            h: 0
        }
    };

    var cachedImageWidth = 0,
        cachedImageHeight = 0,
        cssRotation = 0,
        alwaysUpright = true,
        imagePool = new ImagePool(10);

    function hasImageAreaChanged(img) {
        return cachedScreen.bounds.w !== screen.bounds.w ||
            cachedScreen.bounds.h !== screen.bounds.h ||
            cachedImageWidth !== img.width ||
            cachedImageHeight !== img.height ||
            cachedScreen.rotation !== screen.rotation
    }

    function isRotated() {
        return screen.rotation === 90 || screen.rotation === 270
    }

    function updateImageArea(img) {
        if (!hasImageAreaChanged(img)) return;

        cachedImageWidth = img.width;
        cachedImageHeight = img.height;

        canvas.width = cachedImageWidth;
        canvas.height = cachedImageHeight;

        cssRotation += rotator(cachedScreen.rotation, screen.rotation);

        canvas.style[cssTransform] = 'rotate(' + cssRotation + 'deg)';

        cachedScreen.bounds.h = screen.bounds.h;
        cachedScreen.bounds.w = screen.bounds.w;
        cachedScreen.rotation = screen.rotation;

        if (isRotated()) {
            canvasAspect = img.height / img.width;
            //root.classList.add('rotated')
        }
        else {
            canvasAspect = img.width / img.height;
            //root.classList.remove('rotated')
        }

        if (alwaysUpright) {
            // If the screen image is always in upright position (but we
            // still want the rotation animation), we need to cancel out
            // the rotation by using another rotation.
            positioner.style[cssTransform] = 'rotate(' + -cssRotation + 'deg)'
        }

        maybeFlipLetterbox();
    }

    function maybeFlipLetterbox() {
        positioner.classList.toggle("letterboxed", parentAspect < canvasAspect);
    }

    return function messageListener(frame) {
        screen.rotation = device.display.rotation;

        var blob = new Blob([frame], {
            type: 'image/jpeg'
        });

        var img = imagePool.next();

        img.onload = function() {
            updateImageArea(this);

            g.drawImage(img, 0, 0, img.width, img.height);

            // Try to forcefully clean everything to get rid of memory
            // leaks. Note that despite this effort, Chrome will still
            // leak huge amounts of memory when the developer tools are
            // open, probably to save the resources for inspection. When
            // the developer tools are closed no memory is leaked.
            img.onload = img.onerror = null;
            img.src = BLANK_IMG;
            img = null;
            blob = null;

            URL.revokeObjectURL(url);
            url = null
        };

        img.onerror = function() {
            // Happily ignore. I suppose this shouldn't happen, but
            // sometimes it does, presumably when we're loading images
            // too quickly.

            // Do the same cleanup here as in onload.
            img.onload = img.onerror = null;
            img.src = BLANK_IMG;
            img = null;
            blob = null;

            URL.revokeObjectURL(url);
            url = null
        };

        var url = URL.createObjectURL(blob);
        img.src = url
    };
})());

disp.onClose.add(function () {

});

function inputListener(e) {
    keyboard.type(input.value);
    input.value = "";
}

function keyupListener(e) {
    if (e.keyCode === 9)
        e.preventDefault();

    keyboard.keyUp(e.keyCode);
}

function keydownListener(e) {
    if (e.keyCode === 9)
        e.preventDefault();

    keyboard.keyDown(e.keyCode);
}

function mouseDown(e) {
    e.preventDefault();

    input.focus();

    calculateBounds();

    var x = e.pageX - screen.bounds.x;
    var y = e.pageY - screen.bounds.y;
    var scaled = scaler.coords(
        screen.bounds.w,
        screen.bounds.h,
        x,
        y,
        screen.rotation);

    comm.mouseDown({
        x: scaled.xP,
        y: scaled.yP
    });
}

function mouseMove(e) {
    e.preventDefault();

    input.focus();

    calculateBounds();

    var x = e.pageX - screen.bounds.x;
    var y = e.pageY - screen.bounds.y;
    var scaled = scaler.coords(
        screen.bounds.w,
        screen.bounds.h,
        x,
        y,
        screen.rotation);

    comm.mouseMove({
        x: scaled.xP,
        y: scaled.yP
    });
}

function mouseUp(e) {
    e.preventDefault();

    input.focus();

    calculateBounds();

    var x = e.pageX - screen.bounds.x;
    var y = e.pageY - screen.bounds.y;
    var scaled = scaler.coords(
        screen.bounds.w,
        screen.bounds.h,
        x,
        y,
        screen.rotation);

    comm.mouseUp({
        x: scaled.xP,
        y: scaled.yP
    });
}

// START OF MESSY CODE

var minicapReconnect = null;
var minicapTimeout = 100;

window.onresize = _.debounce(updateBounds, 1000);

var cssTransform = "transform";
var URL = window.URL || window.webkitURL;

var canvasAspect = 1;
var parentAspect = 1;

var screen = {
    rotation: 0,
    bounds: {
        x: 0,
        y: 0,
        w: 0,
        h: 0
    }
};

var device = {
    display: {
        width: 1200,
        height: 1920,
        rotation: 0
    }
};

function calculateBounds() {
    var el = canvas;

    screen.bounds.w = el.offsetWidth;
    screen.bounds.h = el.offsetHeight;
    screen.bounds.x = 0;
    screen.bounds.y = 0;

    while (el.offsetParent) {
        screen.bounds.x += el.offsetLeft;
        screen.bounds.y += el.offsetTop;
        el = el.offsetParent
    }
}

var scaler = new ScalingService(
    device.display.width,
    device.display.height
);

function vendorBackingStorePixelRatio(g) {
    return g.webkitBackingStorePixelRatio ||
        g.mozBackingStorePixelRatio ||
        g.msBackingStorePixelRatio ||
        g.oBackingStorePixelRatio ||
        g.backingStorePixelRatio || 1
}

var devicePixelRatio = window.devicePixelRatio || 1;
var backingStoreRatio = vendorBackingStorePixelRatio(g);
var frontBackRatio = devicePixelRatio / backingStoreRatio;

var options = {
    autoScaleForRetina: true,
    density: Math.max(1, Math.min(1.5, devicePixelRatio || 1)),
    minscale: 0.36
};

var adjustedBoundSize;
var cachedEnabled = false;

function updateBounds() {
    function adjustBoundedSize(w, h) {
        var sw = w * options.density,
            sh = h * options.density,
            f;

        if (sw < (f = device.display.width * options.minscale)) {
            sw *= f / sw;
            sh *= f / sh;
        }

        if (sh < (f = device.display.height * options.minscale)) {
            sw *= f / sw;
            sh *= f / sh;
        }

        return {
            w: Math.ceil(sw),
            h: Math.ceil(sh)
        }
    }

    /*var w = screen.bounds.w = canvas.offsetWidth;
    var h = screen.bounds.h = canvas.offsetHeight;*/
    var w = screen.bounds.w = window.innerWidth;
    var h = screen.bounds.h = window.innerHeight;

    if (!w || !h)
        throw "Unable to read bounds; container must have dimensions";

    var newAdjustedBoundSize = (function() {
        switch (screen.rotation) {
            case 90:
            case 270:
                return adjustBoundedSize(h, w);
            case 0:
            case 180:
            /* falls through */
            default:
                return adjustBoundedSize(w, h);
        }
    })();

    if (!adjustedBoundSize
        || newAdjustedBoundSize.w !== adjustedBoundSize.w
        || newAdjustedBoundSize.h !== adjustedBoundSize.h) {
        adjustedBoundSize = newAdjustedBoundSize;
        onScreenInterestAreaChanged();
    }
}

function checkEnabled() {
    var newEnabled = disp.shouldUpdateScreen();

    if (newEnabled === cachedEnabled) {
        updateBounds();
    } else if (newEnabled) {
        updateBounds();
        onScreenInterestGained()
    } else {
        g.clearRect(0, 0, canvas.width, canvas.height);
        onScreenInterestLost()
    }

    cachedEnabled = newEnabled;
}

function onScreenInterestGained() {
    //wsDisplay.send("size " + adjustedBoundSize.w + "x" + adjustedBoundSize.h);
    disp.geom(adjustedBoundSize.w, adjustedBoundSize.h);
}

function onScreenInterestAreaChanged() {
    //wsDisplay.send("size " + adjustedBoundSize.w + "x" + adjustedBoundSize.h);
    disp.geom(adjustedBoundSize.w, adjustedBoundSize.h);
}

function onScreenInterestLost() {
}