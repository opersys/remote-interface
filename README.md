# Acknowledgements

The backend of this project was extracted from the excellent OpenSTF project https://github.com/openstf/ which is under Apache 2.0 license.

https://github.com/openstf/stf/blob/master/LICENSE

This project includes code from the following OpenSTF components:

* Minicap - https://github.com/openstf/minicap
* Minitouch - https://github.com/openstf/minitouch
* STFService.apk - https://github.com/openstf/STFService.apk
* STF - https://github.com/openstf/stf
* ADBKit - https://github.com/openstf/adbkit

# How to use this project

An .apk launcher is being developed but you can use this project as-is by manually pushing the required files on your device */data/local/tmp/*. You need to push *dist_arm* or *dist_ia32* depending on whether your device is an ARM device or an Intel x86 based devices. The *dist_arm* should work on ARM64 devices and so does *dist_ia32* for 64 bit x86 devices.

The runtime and the build system of this project is using [Node.JS](http://nodejs.org) so you need to have a working *node* binary in your path and a properly installed Node.JS distribution. I'm using the rather old Node.JS 0.12 for development but any version should work. A binary of Node.JS for Android will be installed by the build system.

Once you have cloned the Git repository for this project, you need to also clone the *minicap* and *minitouch* Git submodules. This is done the standard way:

> git submodule init

> git submodule update

Those commands should download *minicap* and *minitouch* which you have to build individually. Those projects require you to have the [Android NDK](http://developer.android.com/tools/sdk/ndk/index.html) installed. Follow the individual build instruction for [minicap](https://github.com/openstf/minicap) and [minitouch](https://github.com/openstf/minitouch).

Once *minicap* and *minitouch* are built in their respective directories, you can get back to building Remote Interface. First, make sure all the require Node.JS modules are installed.

> $ npm install

Then run the build system

> $ grunt

With the *dist_arm* and *dist_ia32* directories created, you can push them on your device.

> $ adb push dist_arm /data/local/tmp

In the device *adb shell*, start the Remote Interface the following way:

> /data/local/tmp $ ./node app.js

Or, if you want a bit of logging

> /data/local/tmp $ DEBUG=RI* ./node app.js

# Contributors
* François-Denis Gonthier francois-denis.gonthier@opersys.com -- main developer and maintainer
* Karim Yaghmour karim.yaghmour@opersys.com -- ideation and project management
