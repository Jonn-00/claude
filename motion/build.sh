#!/usr/bin/env bash
# Full pipeline: soundtrack → frames → final MP4 with film grain.
# Needs node (+ playwright with Chromium), python3 + numpy, ffmpeg.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p out
python3 audio.py
node render.cjs video --workers "${WORKERS:-4}" --sub "${SUB:-6}"
VF="format=yuv444p,noise=alls=3:allf=t,format=yuv420p"   # film grain
X264=(-c:v libx264 -preset medium -b:v 16M -maxrate 24M -bufsize 32M -profile:v high -passlogfile out/x264)
ffmpeg -y -loglevel error -i out/video_silent.mkv -vf "$VF" "${X264[@]}" -pass 1 -an -f null /dev/null
ffmpeg -y -loglevel error -i out/video_silent.mkv -i out/soundtrack.wav -vf "$VF" "${X264[@]}" -pass 2 \
  -c:a aac -b:a 256k -movflags +faststart -shortest made-in-code.mp4
echo "wrote made-in-code.mp4"
