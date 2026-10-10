#!/usr/bin/env bash
set -euo pipefail
test "${CI:-}" = true && test "${GITHUB_ACTIONS:-}" = true
if test "${HOST_PROFILE:-}" = stress; then
  exec npm run host
fi
mkdir -p test-results/host
ffmpeg -hide_banner -loglevel error -f x11grab -video_size 1600x1120 -framerate 10 -i "${DISPLAY}" -c:v libvpx-vp9 -deadline realtime -cpu-used 8 -threads 2 -y test-results/host/native-session.webm &
recorder_pid=$!
finish_recording() {
  kill -INT "${recorder_pid}" 2>/dev/null || true
  wait "${recorder_pid}" || true
}
trap finish_recording EXIT
npm run host
