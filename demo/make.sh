#!/bin/sh
# Rebuild docs/media/float-sidebar-iphone-duo.{mp4,gif} — the iPhone Duo demo.
# Needs: a COPY of code-server with float-sidebar installed (CS_DIR), ffmpeg with libx264, Node 18+,
# Playwright's chromium headless shell, and Source Han Sans CN woff2 files (Regular/Medium/Bold,
# SIL OFL) in demo-ext/fonts/. Usage:  CS_DIR=/path/to/code-server-copy ./make.sh
set -eu
HERE=$(cd "$(dirname "$0")" && pwd); ROOT=$(dirname "$HERE"); W="$HERE/.work"; PORT=${PORT:-8093}
[ -n "${CS_DIR:-}" ] || { echo "set CS_DIR to a copy of code-server" >&2; exit 1; }
ls "$HERE"/demo-ext/fonts/SourceHanSansCN-*.woff2 >/dev/null 2>&1 || { echo "put Source Han Sans CN woff2 files in demo-ext/fonts/" >&2; exit 1; }
[ -e "$HERE/node_modules" ] || ln -s "$ROOT/test/node_modules" "$HERE/node_modules"
rm -rf "$W"; mkdir -p "$W/ud/User" "$W/ext" "$W/factory-ops" "$W/rec"
cp -r "$HERE/demo-ext" "$W/ext/fsdemo.fs-demo-0.0.1"
cat > "$W/ud/User/settings.json" <<'JSON'
{ "workbench.startupEditor": "none", "security.workspace.trust.enabled": false, "window.menuBarVisibility": "classic",
  "workbench.activityBar.location": "top", "chat.disableAIFeatures": true, "git.enabled": false,
  "workbench.tips.enabled": false, "workbench.secondarySideBar.defaultVisibility": "visible", "workbench.layoutControl.enabled": false }
JSON
: > "$W/empty.yaml"
env -i HOME="$HOME" PATH="$PATH" LANG=C.UTF-8 "$CS_DIR/bin/code-server" --config "$W/empty.yaml" --bind-addr 127.0.0.1:$PORT \
	--auth none --user-data-dir "$W/ud" --extensions-dir "$W/ext" --disable-telemetry --disable-update-check "$W/factory-ops" > "$W/cs.log" 2>&1 &
PID=$!; trap 'kill $PID 2>/dev/null || true' EXIT
for i in $(seq 1 40); do curl -fs -o /dev/null "http://127.0.0.1:$PORT/healthz" && break; sleep 1; done
cd "$HERE"
node record.mjs "$W/rec" "$W/factory-ops"
node stage.mjs "$W"
ffmpeg -v error -y -f concat -safe 0 -i "$W/rec/frames.txt" -vf "fps=30,format=yuv420p" -c:v libx264 -crf 16 "$W/raw.mp4"
L="-loop 1 -t 15 -i"; cd "$W"
ffmpeg -v error -y $L bg.png -i raw.mp4 $L cap0.png $L cap1.png $L cap2.png $L cap3.png $L cap4.png $L crease.png $L end.png -filter_complex \
"[1:v]scale=980:690:flags=lanczos,setsar=1,tpad=stop_mode=clone:stop_duration=2.5[v];[0:v][v]overlay=50:266[a];[a][7:v]overlay=0:0[b];\
[b][2:v]overlay=0:0:enable='between(t,0,2.2)'[c0];[c0][3:v]overlay=0:0:enable='between(t,2.2,5.87)'[c1];\
[c1][4:v]overlay=0:0:enable='between(t,5.87,7.96)'[c2];[c2][5:v]overlay=0:0:enable='between(t,7.96,10.76)'[c3];\
[c3][6:v]overlay=0:0:enable='between(t,10.76,12.6)'[c4];[8:v]format=rgba,fade=in:st=12.6:d=0.45:alpha=1[e];[c4][e]overlay=0:0[out]" \
	-map "[out]" -t 15 -r 30 -c:v libx264 -crf 18 -preset slow -pix_fmt yuv420p -movflags +faststart "$ROOT/docs/media/float-sidebar-iphone-duo.mp4"
ffmpeg -v error -y -i "$ROOT/docs/media/float-sidebar-iphone-duo.mp4" -vf "fps=15,scale=720:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle" "$ROOT/docs/media/float-sidebar-iphone-duo.gif"
echo "done: $ROOT/docs/media/"
