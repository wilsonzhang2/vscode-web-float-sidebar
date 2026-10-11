# Changelog

## 0.1.0 — 2026-10-10

First release.

- Floating primary side bar for code-server and openvscode-server: the editor and the secondary side bar keep the full width, and the side bar slides in over them.
- Ways to show it: the left screen edge (mouse), an edge handle (touch), or Ctrl/Cmd+B. Ways to hide it: moving away, clicking or tapping elsewhere, Esc, or Ctrl/Cmd+B.
- Modes auto / on / off, switched from the status bar or with Ctrl+Alt+Shift+B and remembered per browser. auto floats below 1400 CSS px.
- Webviews in the side bar follow it, both the anchor-positioned layer of VS Code ≥ 1.110 and the older left/top layer.
- `float-sidebar.sh` with install / uninstall / status. It finds common install locations, is idempotent and keeps a backup of the original page.
- End-to-end tests on code-server 4.138.0 (VS Code 1.138.0) and openvscode-server 1.109.5.
