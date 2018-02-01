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

This project has been designed to be integrated inside and AOSP tree. It has been tested on the [HiKey 620 board](https://source.android.com/setup/devices) (arm64) and on the x86_64 emulator. It should work with minimal modifications on the ia32 emulator on other arm boards supporting Android.

Before following those steps, you need to use the https://github.com/fdgonthier/Aosp-Node-Prebuilts project so that a Node.js binary is present on your target. Remote Interface requires Node.js and will not work without it.

You first also need a working version of Node.js. https://nodejs.org/en/download/package-manager/

Install the required packages:

> $ npm install

Assemble the package to install on the device:

> $ grunt [x86_64|arm64]

Run 'mm' to insert the application on the device

> $ mm

# Running

The application can be run from the ADB shell but you need to forward ports first:

> $ adb forward tcp:3000 tcp:3000

You can then run the application from within the ADB shell:

> $ OsysRI

You can access the app on localhost:3000

The application will output plenty of debugging statements when running.

# Cleaning / Reinstalling

To remove the application from the build:

Remove the launcher

> $ rm out/target/product/[product name]/system/bin/OsysRI

At this point, if you run `mm` again, the application will be reinstalled on the device. This is how to reinstall the app if you've done modifications.

> $ rm out/target/product/[product name]/system/Osys/RI

# Contributors
* François-Denis Gonthier francois-denis.gonthier@opersys.com -- main developer and maintainer
* Karim Yaghmour karim.yaghmour@opersys.com -- ideation and project management
