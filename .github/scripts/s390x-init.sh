#!/bin/bash
# VM init script (PID 1) for s390x QEMU system-emulation tests.
# Mounts essential filesystems, runs the Node.js test suite, signals
# the result via serial console, then powers off.
set -o pipefail
export PATH=/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin HOME=/root
mount -t proc proc /proc 2>/dev/null || true
mount -t sysfs sys /sys 2>/dev/null || true
mount -t devtmpfs dev /dev 2>/dev/null || true
ip link set lo up 2>/dev/null || true
echo "=== s390x test runner ==="
echo "Node: $(node --version)"
cd /tmp/nodejs-test || exit 1
CI=true REQUIRE_PUSH_TESTS=false \
  node --no-turbofan --no-maglev --no-sparkplug \
  ./node_modules/.bin/ava --config ava-precompiled.config.mjs 2>&1 | tee /tmp/test-output.txt
TEST_EXIT=$?
if [ "$TEST_EXIT" -eq 0 ]; then echo "TEST_RESULT_CODE=0"
else dmesg; echo "TEST_RESULT_CODE=1"; fi
sync; sleep 1; echo o > /proc/sysrq-trigger; sleep infinity
