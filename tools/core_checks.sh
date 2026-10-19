#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
mkdir -p out/core-checks
java -m jdk.compiler/com.sun.tools.javac.Main -d out/core-checks app/src/main/java/org/aeronautical/openacademy/core/*.java tests/CoreChecks.java
java -cp out/core-checks CoreChecks
