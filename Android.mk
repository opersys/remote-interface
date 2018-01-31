LOCAL_PATH := $(call my-dir)

ifeq "$(findstring hikey,$(TARGET_PRODUCT))" "hikey"
include $(CLEAR_VARS)
LOCAL_MODULE_TAGS := optional
LOCAL_MODULE := virtual_touchscreen.ko
LOCAL_MODULE_CLASS := ETC
LOCAL_MODULE_PATH = $(TARGET_OUT)/lib/modules
LOCAL_SRC_FILES := virtual_touchscreen/virtual_touchscreen_$(TARGET_ARCH).ko
include $(BUILD_PREBUILT)
endif

include $(CLEAR_VARS)
LOCAL_MODULE := OsysRI
LOCAL_MODULE_CLASS := EXECUTABLES
LOCAL_MODULE_TAGS := optional
LOCAL_SRC_FILES := OsysRI
LOCAL_MODULE_PATH := $(TARGET_OUT)/bin

LOCAL_POST_INSTALL_CMD := \
	mkdir -p $(TARGET_OUT)/Osys/RI; \
	cp -af $(LOCAL_PATH)/dist_$(TARGET_ARCH)/* $(TARGET_OUT)/Osys/RI
include $(BUILD_PREBUILT)
