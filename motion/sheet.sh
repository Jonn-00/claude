#!/bin/sh
# contact sheet of the given stills: sheet.sh out.png a.png b.png ...
o=$1; shift; n=$#; cols=3; rows=$(( (n + cols - 1) / cols ))
in=""; for f in "$@"; do in="$in -i $f"; done
ffmpeg -y -loglevel error $in -filter_complex "$(i=0; for f in "$@"; do printf "[%d]scale=960:540,drawtext=text='%s':x=10:y=10:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.6[v%d];" $i "$(basename $f .png)" $i; i=$((i+1)); done; i=0; for f in "$@"; do printf "[v%d]" $i; i=$((i+1)); done; printf "xstack=inputs=%d:layout=" $n; i=0; for f in "$@"; do c=$((i % cols)); r=$((i / cols)); [ $i -gt 0 ] && printf "|"; printf "%d_%d" $((c*960)) $((r*540)); i=$((i+1)); done)" $o
