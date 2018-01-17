LOCAL_PATH := $(call my-dir)

include $(CLEAR_VARS)
LOCAL_MODULE_TAGS := optional
LOCAL_MODULE := virtual_touchscreen.ko
LOCAL_MODULE_CLASS := ETC
LOCAL_MODULE_PATH = $(TARGET_OUT)/lib/modules
LOCAL_SRC_FILES := virtual_touchscreen/virtual_touchscreen.ko
include $(BUILD_PREBUILT)

include $(CLEAR_VARS)
LOCAL_MODULE := OsysRI
LOCAL_MODULE_CLASS := EXECUTABLES
LOCAL_MODULE_TAGS := optional
LOCAL_SRC_FILES := OsysRI
LOCAL_MODULE_PATH := $(TARGET_OUT)/bin

LOCAL_POST_INSTALL_CMD := \
	mkdir -p $(TARGET_OUT)/Osys/RI; \
	cp -af $(LOCAL_PATH)/dist_arm64/* $(TARGET_OUT)/Osys/RI
include $(BUILD_PREBUILT)
