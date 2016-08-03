# Acknowledgements

The backend of this project was extracted from the excellent OpenSTF project https://github.com/openstf/ which is under Apache 2.0 license.

https://github.com/openstf/stf/blob/master/LICENSE

This project includes code from the following OpenSTF components:

* Minicap - https://github.com/openstf/minicap
* Minitouch - https://github.com/openstf/minitouch
* STFService.apk - https://github.com/openstf/STFService.apk
* STF - https://github.com/openstf/stf
* ADBKit - https://github.com/openstf/adbkit

# How to run this project

You have the choice to download one of the prebuilt distributions for ARM or x86-based devices, or build the source yourself

## How to use prebuilt distributions.

Prebuilts source distributions are available on the [curent repository release](https://github.com/opersys/remote-interface). Pick the distributions meant for the architecture of your device, extract it somewhere, then push the whole extracted content in your device:

> adb push dist_arm/* /data/local/tmp/RI

Before entering the *adb shell*, you need to forward the port you will use to connect on your device

> adb forward tcp:3000 tcp:3000

You can pick some other port than 3000 but it is the default. Then launch an ADB shell and run the following command to start the Remote Interface web client

> cd /data/local/tmp
> DEBUG=RI* node ./app.js

*DEBUG=RI\** is not mandatory but it helps to see the behaviour of the program while its running.

## How to use the source

An .apk launcher is being developed but you can use this project as-is by manually pushing the required files on your device */data/local/tmp/*. You need to push *dist_arm* or *dist_ia32* depending on whether your device is an ARM device or an Intel x86 based devices. The *dist_arm* should work on ARM64 devices and so does *dist_ia32* for 64 bit x86 devices.

The runtime and the build system of this project is using [Node.JS](http://nodejs.org) so you need to have a working *node* binary in your path and a properly installed Node.JS distribution. I'm using the rather old Node.JS 0.12 for development but any version should work. A binary of Node.JS for Android will be installed by the build system.

Once you have cloned the Git repository for this project, you need to also clone the *minicap* and *minitouch* Git submodules. This is done the standard way:

> git submodule init

> git submodule update

Those commands should download *minicap* and *minitouch* which you have to build individually. Those projects require you to have the [Android NDK](http://developer.android.com/tools/sdk/ndk/index.html) installed. Building those projects should be as simple as running *ndk-build* in each directories.

Once *minicap* and *minitouch* are built in their respective directories, you can get back to building Remote Interface. First, make sure all the require Node.JS modules are installed.

> $ npm install

Then run the build system

> $ grunt

With the *dist_arm* and *dist_ia32* directories created, you can push them on your device.

> $ adb push dist_arm /data/local/tmp

In the device *adb shell*, you might need to make minicap and minitouch files executable. There are several executable files in that directory so go with the lazy way and make them all executable:

> chmod -R 0755 _bin

This is probably very insecure but I certainly don't recommend leaving Remote Interface running when the device is in a public network.

Start the Remote Interface the following way:

> /data/local/tmp $ ./node app.js

Or, if you want a bit of logging

> /data/local/tmp $ DEBUG=RI* ./node app.js

# Bugs

This is a late alpha quality release so there are probably more missing features than bugs but it works generally well enough to be used.

The worse bug I've found is probably minicap causing the device to freeze and reboot but it has not happened enough to me to be an issue during development.

# Contributors
* François-Denis Gonthier francois-denis.gonthier@opersys.com -- main developer and maintainer
* Karim Yaghmour karim.yaghmour@opersys.com -- ideation and project management
