/*
 * Copyright (C) 2015-2018 Opersys inc.
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

var util = require("util");
var fs = require("fs");
var path = require("path");
var _ = require("underscore");
var tarball = require("tarball-extract");
var got = require("got");
var async = require("async");
var md5file = require("md5-file");
var URL = require("url").URL;

module.exports = function (grunt) {

    var mkdir_config = {},
        copy_config = {},
        webpack_config = {},
        prebuilts_config = {},
        exec_config = {},
        compress_config = {},
        handlebars_config = {},
        has_config = false;

    if (!fs.existsSync("config.json")) {
        grunt.log.writeln("No config.json source found, won't be compiling modules.");
        grunt.config.init({
            pkg: grunt.file.readJSON("package.json")
        });
    } else {
        grunt.config.init({
            pkg: grunt.file.readJSON("package.json"),
            cfg: grunt.file.readJSON("config.json")
        });
        has_config = true;
    }

    _.each(["arm", "arm64", "ia32"], function (arch) {

        var mkdist = function (arch) {
            return function () {
                var args = Array.prototype.slice.call(arguments);
                return path.join.apply(this, ["dist_" + arch].concat(args));
            };
        }(arch);

        mkdir_config["dist_" + arch] = {
            options: {
                create: [
                    mkdist("_bin"),
                    mkdist("public", "css"),
                    mkdist("public", "fonts"),
                    mkdist("public", "images"),
                    "out"
                ]
            }
        };

        webpack_config["dist_" + arch] = {
            context: path.join(__dirname, "src", "js"),
            entry: {
                display: "./display/main.js",
                main: "./index/main.js"
            },
            output: {
                filename: mkdist("public", "js", "b_[name].js"),
                libraryTarget: "var",
                library: "JS"
            }
        };

        handlebars_config["dist_" + arch] = {
            options: {
                namespace: "JST",
                amd: true
            },
            files: {}
        };
        handlebars_config["dist_" + arch].files[mkdist("public", "js", "templates.js")] = [
        ];

        copy_config["dist_" + arch] = {
            files: [
                { src: ["package.json"], dest: mkdist("/") },

                { expand: true, cwd: "bin", src: ["**"], dest: mkdist("_bin") },
                { expand: true, cwd: "images", src: ["**"], dest: mkdist("public", "images") },
                { expand: true, cwd: "src/css", src: ["*"], dest: mkdist("public", "css") },
                { expand: true, cwd: "src/html", src: ["*"], dest: mkdist("public") },
                { expand: true, cwd: "fonts/", src: ["*"], dest: mkdist("public/fonts") },
                { expand: true, cwd: "src/", src: ["*"], dest: mkdist() },

                { expand: true, cwd: "minicap/libs", src: ["**"], mode: "0755",
                    dest: mkdist("_bin/minicap") },

                { expand: true, cwd: "minicap/jni/minicap-shared/aosp/libs", src: ["**"],
                    mode: "0755", dest: mkdist("_bin/minicap") },

                { expand: true, cwd: "minitouch/libs", src: ["**"],
                    mode: "0755", dest: mkdist("_bin/minitouch") },

                { expand: true, cwd: "out/production/cmdserver",
                    src: ["cmdserver.apk"], dest: mkdist("_bin") }
            ]
        };

        exec_config["dist_npm_" + arch] = {
            command: function() {
                return "npm --no-optional --production --prefix=" + mkdist("/") + " install";
            }
        };

        exec_config["dist_md5sum_" + arch] = {
            command: [
                "md5sum", path.join("out", [grunt.config("pkg.name"), "_", arch, ".zip"].join("")),
                "|",
                "cut -f 1 -d ' ' > " + path.join("out", [grunt.config("pkg.name"), "_", arch, ".zip.md5sum"].join(""))].join(" ")
        };

        compress_config["dist_zip_" + arch] = {
            options: {
                archive: path.join("out", [grunt.config("pkg.name"), "_", arch, ".zip"].join("")),
                mode: 'zip'
            },
            files: [{ expand: true, cwd: "./dist_" + arch, src: ["./**"] }]
        };

        compress_config["dist_tgz_" + arch] = {
            options: {
                archive: path.join("out", [grunt.config("pkg.name"), "_", arch, ".tar.gz"].join("")),
                mode: 'tgz'
            },
            files: [{ expand: true, cwd: "./dist_" + arch, src: ["./**"] }]
        };

        prebuilts_config["dist_" + arch] = _.map(grunt.config("pkg.prebuilts.modules." + arch), function (v) {
            return {
                url: v,
                tagDest: mkdist(),
                dest: mkdist("node_modules")
            };
        });

        grunt.registerTask("dist_" + arch, [
            "mkdir:dist_" + arch,
            "webpack:dist_" + arch,
            "copy:dist_" + arch,
            "exec:dist_npm_" + arch,
            "prebuilts:dist_" + arch,
            "handlebars:dist_" + arch
        ]);

        grunt.registerTask("out_" + arch, [
            "dist_" + arch,
            "compress:dist_zip_" + arch,
            "compress:dist_tgz_" + arch,
            "exec:dist_md5sum_" + arch
        ]);
    });

    grunt.config("mkdir", mkdir_config);
    grunt.config("webpack", webpack_config);
    grunt.config("copy", copy_config);
    grunt.config("exec", exec_config);
    grunt.config("prebuilts", prebuilts_config);
    grunt.config("compress", compress_config);
    grunt.config("handlebars", handlebars_config);

    grunt.config("template", {
        "process-otlauncher-template": {
            "options": {
                "data": function () {
                    return {
                        "ia32_md5sum": md5file(["out/", grunt.config("pkg.name"), "_ia32", ".zip"].join("")),
                        "arm_md5sum": md5file(["out/", grunt.config("pkg.name"), "_arm", ".zip"].join(""))
                    }
                }
            },
            "files": {
                "out/otlauncher.json": ["otlauncher.json.tmpl"]
            }
        }
    });
    
    function downloadAndExtract(dataUrl, dataDest, tagDest, doneCb) {
        var tag = path.join(tagDest, ".dltag." + path.basename(dataUrl));

        fs.exists(tag, function (exists) {
            if (!exists) {
                var url = new URL(dataUrl);
                var dlfile = path.basename(url.pathname);
                var dldest = path.join(dataDest, dlfile);
                var dlstream = got.stream(url.toString());

                fs.writeFile(tag, "", function () {
                    dlstream.on("end", function () {
                        tarball.extractTarball(dldest, dataDest, function (err) {
                            if (err) throw err;
                            grunt.log.writeln("Done extracting: " + dldest);
                            fs.unlinkSync(dldest);
                            doneCb();
                        });
                    });
                    dlstream.pipe(fs.createWriteStream(dldest));
                });
            } else {
                grunt.log.writeln("Not downloading " + dataUrl + ": already done");
                doneCb();
            }
        });
    }

    grunt.registerTask("jsbinder_oreo", "Generate an Oreo build", function () {
        var done = this.async();
        
        if (!fs.existsSync("dist_arm64/node_modules/jsbinder")) {
            downloadAndExtract(
                "https://github.com/opersys/jsbinder/releases/download/0.4.0-Oreo/jsbinder-0.4.0_oreo_arm64.tar.gz",
                "dist_arm64/node_modules",
                "dist_arm64",
                done);
        }
    });

    grunt.registerMultiTask("prebuilts", "Download a prebuilt package from an URL", function () {
        var data = this.data;
        var done = this.async();

        async.each(data,
            function (dldata, callback) {
                downloadAndExtract(dldata.url, dldata.dest, dldata.tagDest, callback);
            },
            done
        );
    });

    grunt.loadNpmTasks("grunt-mkdir");
    grunt.loadNpmTasks("grunt-contrib-copy");
    grunt.loadNpmTasks("grunt-auto-install");
    grunt.loadNpmTasks("grunt-exec");
    grunt.loadNpmTasks("grunt-contrib-compress");
    grunt.loadNpmTasks("grunt-contrib-handlebars");
    grunt.loadNpmTasks("grunt-chmod");
    grunt.loadNpmTasks("grunt-template");
    grunt.loadNpmTasks("grunt-webpack");

    grunt.registerTask("oreo", ["dist_arm64", "jsbinder_oreo"]);
    grunt.registerTask("default", ["dist_arm", "dist_arm64", "dist_ia32"]);
    grunt.registerTask("pack", ["out_arm", "out_arm64", "out_ia32", "template"]);
};

