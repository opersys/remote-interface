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

var os = require("os");
var fs = require("fs");
var path = require("path");
var util = require("util");
var _ = require("underscore");
var Download = require("download");
var async = require("async");
var md5file = require("md5-file");

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

    _.each(["arm", "ia32"], function (arch) {

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

        // Node binary module cross-compilation support.
        if (has_config) {
            var toolchain_dir = grunt.config("cfg." + arch + "_toolchain_dir");
            var toolchain_prefix = grunt.config("cfg." + arch + "_toolchain_prefix");

            exec_config["dist_npm_" + arch] = {
                command: function() {
                    var cmd = [
                        "PATH=" + path.join(toolchain_dir, "bin") + ":" + process.env["PATH"],
                        "CC=" + toolchain_prefix + "-gcc",
                        "CXX=" + toolchain_prefix + "-g++",
                        "LINK=" + toolchain_prefix + "-g++",
                        "AS=" + toolchain_prefix + "-as",
                        "AR=" + toolchain_prefix + "-ar",
                        "npm",
                        "--production",
                        "--arch=" + (arch == "arm" ? "arm" : "x86"),
                        "--prefix=" + mkdist("/"),
                        "--nodedir=" + grunt.config("cfg.nodedir"), "install"].join(" ");
                    grunt.log.writeln(cmd);
                    return cmd;
                }
            };
        } else {
            exec_config["dist_npm_" + arch] = {
                command: function() {
                    return "npm --no-optional --production --prefix=" + mkdist("/") + " install";
                }
            };
        }

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
        }).concat(_.map(grunt.config("pkg.prebuilts.misc." + arch), function (v) {
            return {
                url: v,
                tagDest: mkdist(),
                dest: mkdist()
            };
        }));

        grunt.registerTask("dist_" + arch, [
            "mkdir:dist_" + arch,
            "webpack:dist_" + arch,
            "copy:dist_" + arch,
            "prebuilts:dist_" + arch,
            "exec:dist_npm_" + arch,
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

    grunt.registerTask("toolchain", "Generate an Android toolchain", function (arch) {
        var architectures = [];

        if (!arch)
            architectures = ["ia32", "arm"];
        else
            architectures = [arch];

        _.each(architectures, function (arch) {
            var toolchain_dir = grunt.config.get("cfg." + arch + "_toolchain_dir");
            var toolchain_name = grunt.config.get("cfg." + arch + "_toolchain_name");

            if (!fs.existsSync(toolchain_dir)) {
                var ndk_dir = grunt.config.get("cfg.ndk_dir");
                var mktoolchain = path.join(ndk_dir, "build/tools/make-standalone-toolchain.sh");
                var args = [
                    "--toolchain=" + toolchain_name,
                    "--arch=" + (arch == "arm" ? "arm" : "x86"),
                    "--install_dir=" + toolchain_dir,
                    "--platform=" + grunt.config.get("cfg.toolchain_version"),
                    "--system=linux-x86_64"
                ];

                grunt.log.writeln("Creating toolchain " + toolchain_name + " in " + toolchain_dir);
                grunt.log.writeln(([mktoolchain].concat(args)).join(" "));

                grunt.util.spawn({
                        cmd: mktoolchain,
                        args: args
                    },
                    function (error) {
                        if (error)
                            grunt.log.error(error);

                        grunt.log.writeln("Process returned.");
                        grunt.log.write(grunt.log.result.stderr);
                    }
                );
            }
        });
    });

    grunt.registerMultiTask("prebuilts", "Download a prebuilt stuff from an URL", function () {
        var data = this.data;
        var done = this.async();
        var dl = new Download({ extract: true });

        async.each(data,
            function (dldata, callback) {
                var tag = path.join(dldata.tagDest, ".dltag." + path.basename(dldata.url));

                fs.exists(tag, function (exists) {
                    if (!exists) {
                        fs.writeFile(tag, "", function () {
                            console.log("TAG is: " + tag);
                            grunt.log.writeln("Downloading " + dldata.url);
                            dl.get(dldata.url, dldata.dest);
                            callback();
                        });
                    } else {
                        grunt.log.writeln("Not downloading " + dldata.url + ": already done.");
                        callback();
                    }
                });
            },
            function () {
                if (dl.get()) {
                    dl.run(function (err, files) {
                        if (err) throw err;
                        done();
                    });
                }
                else  done();
            }
        );
    });

    grunt.registerTask("dev_bin", "Pick the right binaries for development", function (arch) {
        var selArch, defArch = os.arch();

        if (!arch)
            selArch = defArch;
        else
            selArch = arch;

        var files = fs.readdirSync("./dist/_bin");
        var r = new RegExp(selArch + "$");

        _.each(files, function (file) {
            var f = path.join("./dist/_bin", file);
            var e = new RegExp("\\.{0,1}_{0,1}" + selArch);

            if (r.test(file)) {
                grunt.file.copy(f, "./dist/" + file.replace(e, ""));
                grunt.log.writeln("Using " + file);
            }
        });
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

    grunt.registerTask("default", ["dist_arm", "dist_ia32"]);
    grunt.registerTask("pack", ["out_arm", "out_ia32", "template"]);
};

