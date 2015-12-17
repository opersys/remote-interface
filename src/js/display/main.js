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

var BLANK_IMG = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

var cssTransform = "transform";
var URL = window.URL || window.webkitURL;

// RELATIVELY CLEANER CODE STARTS HERE.

var DisplayWindow = function (comm, disp) {
    console.log("Creating new display object: " + comm + ", " + disp);

    function vendorBackingStorePixelRatio(g) {
        return g.webkitBackingStorePixelRatio ||
            g.mozBackingStorePixelRatio ||
            g.msBackingStorePixelRatio ||
            g.oBackingStorePixelRatio ||
            g.backingStorePixelRatio || 1
    }

    this._commSock = comm;
    this._dispSock = disp;
    this._keyboard = new Keyboard(comm);

    this._canvas = document.getElementById("device-screen-canvas");
    this._positioner = document.getElementById("positioner");
    this._input = document.getElementById("input");
    this._g = this._canvas.getContext('2d');

    this._devicePixelRatio = window.devicePixelRatio || 1;
    this._backingStoreRatio = vendorBackingStorePixelRatio(this._g);
    this._frontBackRatio = this._devicePixelRatio / this._backingStoreRatio;

    this._adjustedBoundSize = null;
    this._cachedEnabled = false;

    this._options = {
        autoScaleForRetina: true,
        density: Math.max(1, Math.min(1.5, devicePixelRatio || 1)),
        minscale: 0.36
    };

    this._device = {
        display: {
            width: 1200,
            height: 1920,
            rotation: 0
        }
    };

    this._screen = {rotation: 0, bounds: {x: 0, y: 0, w: 0, h: 0}};

    this._canvasAspect = 1;
    this._parentAspect = 1;

    this._scaler = new ScalingService(
        this._device.display.width,
        this._device.display.height
    );

    this._commSock.onRotation.add(this._onCommSocketRotation.bind(this));
    this._dispSock.onFrame.add(this._onFrame.bind(this));

    this._canvas.addEventListener("mousedown", this._onMouseDown.bind(this));
    this._canvas.addEventListener("mousemove", this._onMouseMove.bind(this));
    this._canvas.addEventListener("mouseup", this._onMouseUp.bind(this));
    this._canvas.addEventListener("mouseleave", this._onMouseUp.bind(this));

    this._input.addEventListener("keydown", this._onKeydownListener(this));
    this._input.addEventListener("keyup", this._onKeyupListener(this));
    this._input.addEventListener("input", this._onInputListener(this));

    this._checkEnabled();
};

DisplayWindow.prototype._checkEnabled = function () {
    var newEnabled = this._dispSock.shouldUpdateScreen();

    if (newEnabled === this._cachedEnabled) {
        this.updateBounds();
    } else if (newEnabled) {
        this.updateBounds();
        this._onScreenInterestGained()
    } else {
        g.clearRect(0, 0, this._canvas.width, this._canvas.height);
        this._onScreenInterestLost()
    }

    this._cachedEnabled = newEnabled;
};

DisplayWindow.prototype._onFrame = (function() {
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

    function hasImageAreaChanged(target, img) {
        return cachedScreen.bounds.w !== target._screen.bounds.w ||
            cachedScreen.bounds.h !== target._screen.bounds.h ||
            cachedImageWidth !== img.width ||
            cachedImageHeight !== img.height ||
            cachedScreen.rotation !== target._screen.rotation
    }

    function isRotated(target) {
        return target._screen.rotation === 90 || target._screen.rotation === 270
    }

    function updateImageArea(target, img) {
        if (!hasImageAreaChanged(target, img)) return;

        cachedImageWidth = img.width;
        cachedImageHeight = img.height;

        target._canvas.width = cachedImageWidth;
        target._canvas.height = cachedImageHeight;

        cssRotation += rotator(cachedScreen.rotation, target._screen.rotation);

        target._canvas.style[cssTransform] = 'rotate(' + cssRotation + 'deg)';

        cachedScreen.bounds.h = target._screen.bounds.h;
        cachedScreen.bounds.w = target._screen.bounds.w;
        cachedScreen.rotation = target._screen.rotation;

        if (isRotated(target)) {
            target._canvasAspect = img.height / img.width;
            //root.classList.add('rotated')
        }
        else {
            target._canvasAspect = img.width / img.height;
            //root.classList.remove('rotated')
        }

        if (alwaysUpright) {
            // If the screen image is always in upright position (but we
            // still want the rotation animation), we need to cancel out
            // the rotation by using another rotation.
            target._positioner.style[cssTransform] = 'rotate(' + -cssRotation + 'deg)'
        }

        maybeFlipLetterbox(target);
    }

    function maybeFlipLetterbox(target) {
        target._positioner.classList.toggle("letterboxed", target._parentAspect < target._canvasAspect);
    }

    return function messageListener(frame) {
        var self = this;

        this._screen.rotation = this._device.display.rotation;

        var blob = new Blob([frame], {
            type: 'image/jpeg'
        });

        var img = imagePool.next();

        img.onload = function() {
            updateImageArea(self, img);

            self._g.drawImage(img, 0, 0, img.width, img.height);

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
})();

DisplayWindow.prototype._onCommSocketRotation = function (angle) {
    this._device.display.rotation = angle;
};

DisplayWindow.prototype._onInputListener = function () {
    this._commSock.type(this._input.value);
    this._input.value = "";
};

DisplayWindow.prototype._onKeyupListener = function (e) {
    if (e.keyCode === 9)
        e.preventDefault();

    this._keyboard.keyUp(e.keyCode);
};

DisplayWindow.prototype._onKeydownListener = function (e) {
    if (e.keyCode === 9)
        e.preventDefault();

    this._keyboard.keyDown(e.keyCode);
};

DisplayWindow.prototype._onMouseDown = function (e) {
    e.preventDefault();

    this._input.focus();

    this._calculateBounds();

    var x = e.pageX - this._screen.bounds.x;
    var y = e.pageY - this._screen.bounds.y;
    var scaled = this._scaler.coords(
        this._screen.bounds.w,
        this._screen.bounds.h,
        x,
        y,
        this._screen.rotation);

    this._commSock.mouseDown({
        x: scaled.xP,
        y: scaled.yP
    });
};

DisplayWindow.prototype._onMouseMove = function (e) {
    e.preventDefault();

    this._input.focus();

    this._calculateBounds();

    var x = e.pageX - this._screen.bounds.x;
    var y = e.pageY - this._screen.bounds.y;
    var scaled = this._scaler.coords(
        this._screen.bounds.w,
        this._screen.bounds.h,
        x,
        y,
        this._screen.rotation);

    this._commSock.mouseMove({
        x: scaled.xP,
        y: scaled.yP
    });
};

DisplayWindow.prototype._onMouseUp = function (e) {
    e.preventDefault();

    this._input.focus();

    this._calculateBounds();

    var x = e.pageX - this._screen.bounds.x;
    var y = e.pageY - this._screen.bounds.y;
    var scaled = this._scaler.coords(
        this._screen.bounds.w,
        this._screen.bounds.h,
        x,
        y,
        this._screen.rotation);

    this._commSock.mouseUp({
        x: scaled.xP,
        y: scaled.yP
    });
};

DisplayWindow.prototype.updateBounds = function () {
    var self = this;

    function adjustBoundedSize(w, h) {
        var sw = w * self._options.density,
            sh = h * self._options.density,
            f;

        if (sw < (f = self._device.display.width * self._options.minscale)) {
            sw *= f / sw;
            sh *= f / sh;
        }

        if (sh < (f = self._device.display.height * self._options.minscale)) {
            sw *= f / sw;
            sh *= f / sh;
        }

        return {
            w: Math.ceil(sw),
            h: Math.ceil(sh)
        }
    }

    var w = this._screen.bounds.w = window.innerWidth;
    var h = this._screen.bounds.h = window.innerHeight;

    if (!w || !h)
        throw "Unable to read bounds; container must have dimensions";

    var newAdjustedBoundSize = (function() {
        switch (self._screen.rotation) {
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

    if (!this._adjustedBoundSize
        || newAdjustedBoundSize.w !== this._adjustedBoundSize.w
        || newAdjustedBoundSize.h !== this._adjustedBoundSize.h) {
        this._adjustedBoundSize = newAdjustedBoundSize;
        this._onScreenInterestAreaChanged();
    }
};

DisplayWindow.prototype._calculateBounds = function () {
    var el = this._canvas;

    this._screen.bounds.w = el.offsetWidth;
    this._screen.bounds.h = el.offsetHeight;
    this._screen.bounds.x = 0;
    this._screen.bounds.y = 0;

    while (el.offsetParent) {
        this._screen.bounds.x += el.offsetLeft;
        this._screen.bounds.y += el.offsetTop;
        el = el.offsetParent
    }
};

DisplayWindow.prototype._onScreenInterestGained = function () {
    this._dispSock.geom(this._adjustedBoundSize.w, this._adjustedBoundSize.h);
};

DisplayWindow.prototype._onScreenInterestAreaChanged = function () {
    this._dispSock.geom(this._adjustedBoundSize.w, this._adjustedBoundSize.h);
};

DisplayWindow.prototype._onScreenInterestLost = function () {
};

// START OF MESSY CODE

module.exports.runDisplay = function (comm, disp) {
    window._dispObject = new DisplayWindow(comm, disp);
    window.onresize = _.debounce(window._dispObject.updateBounds.bind(this), 1000);
};
