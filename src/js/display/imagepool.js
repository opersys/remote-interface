/*
 * This file was obtained from the STFAgent.apk repository in the OpenSTF project, at this URL:
 *
 * https://github.com/openstf/stf/blob/master/res/app/components/stf/screen/imagepool.js
 *
 * The project is under an Apache 2.0 License:
 *
 * https://github.com/openstf/stf/blob/master/LICENSE
 *
 * The file was changed lightly to integrate with the rest of the current project.
 */

function ImagePool(size) {
    this.size = size;
    this.images = [];
    this.counter = 0
}

ImagePool.prototype.next = function() {
    if (this.images.length < this.size) {
        var image = new Image();
        this.images.push(image);
        return image
    }
    else {
        if (this.counter >= this.size) {
            // Reset for unlikely but theoretically possible overflow.
            this.counter = 0
        }

        return this.images[this.counter++ % this.size]
    }
};

module.exports = ImagePool;