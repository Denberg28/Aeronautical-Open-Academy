#!/bin/sh
# Android regression — retain screenshots/crash output before the emulator is stopped.
set -eu
mkdir -p out/device-smoke
trap 'adb pull /sdcard/Download/academy-smoke out/device-smoke/ || true
adb logcat -d -b crash > out/device-smoke/crash.log || true' EXIT
adb shell wm size 720x1280
adb shell wm density 320
sh gradlew --no-daemon :app:connectedDebugAndroidTest
