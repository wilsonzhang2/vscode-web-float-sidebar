# Demo video

`make.sh` rebuilds `docs/media/float-sidebar-iphone-duo.mp4` (1080×1080, 15 s) and the GIF. It runs code-server at the iPhone Duo inner-screen size (890 × 626 pt, rendered at 2×) with float-sidebar switched on, taps the edge handle, closes the side bar again, and compares the result with the normal docked side bar.

- The editor and side panels are **stand-ins** (`demo-ext/`) that imitate a Claude Code / Codex layout, because the real extensions need a signed-in account. The floating side bar itself is the real script.
- The red dots mark the taps. They are drawn for the video.
- To record a sharp 2× video, CSS animations are slowed to 1/5 through the Chrome DevTools Protocol (`Animation.setPlaybackRate`) while screenshots are taken. Each frame is then timed back to real speed, so the video plays at the true speed.

The script needs a copy of code-server with float-sidebar installed (`CS_DIR`), ffmpeg with libx264, and the Source Han Sans CN woff2 files in `demo-ext/fonts/` (not included).
