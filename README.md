# Float Sidebar for VS Code in the browser

English | [简体中文](README.zh-CN.md)

Makes the primary side bar of **code-server** and **openvscode-server** float *over* the editor instead of pushing it aside. It is made for foldable phones, tablets and small browser windows, where the side bar would otherwise take a third of the screen.

<p align="center"><img src="docs/media/float-sidebar-iphone-duo.gif" width="540" alt="Demo on an iPhone Duo inner screen: tap the edge, the side bar floats in; tap elsewhere, it leaves; then a comparison with the normal side bar"></p>

<p align="center"><i>iPhone Duo inner screen (890 × 626 pt), code-server full screen, Float on. <a href="docs/media/float-sidebar-iphone-duo.mp4">MP4 version</a> · <a href="demo/">how it was made</a></i></p>

| Side bar hidden: the editor uses the full width | Side bar shown: it floats, the editor does not move |
|---|---|
| ![closed](docs/img/fold-closed.png) | ![open](docs/img/fold-open.png) |

*933 × 704 CSS px, about the inner screen of a 7.6–8" foldable. The editor holds a webview, which stands in for a chat panel such as Claude Code, Codex or Copilot Chat.*

## Why

On a phone's inner screen (about 850–950 CSS px wide), the side bar and the editor fight for space. Pressing Ctrl+B or using an auto-hide extension makes the editor and every chat panel re-lay out each time the side bar comes and goes: text reflows and long answers jump. This script keeps the side bar out of the layout entirely and slides it in on top when you need it.

## Using it

| | Mouse / keyboard | Touch |
|---|---|---|
| Show the side bar | Rest the mouse on the left screen edge, or press **Ctrl+B** (⌘B) | Tap the handle on the left edge |
| Hide it | Move the mouse away, click elsewhere, press **Esc** or **Ctrl+B** | Tap anywhere else |
| Switch mode | Click **Float: …** in the status bar, or press **Ctrl+Alt+Shift+B** | Tap **Float: …** in the status bar |

There are three modes: **auto** floats the side bar when the window is narrower than 1400 CSS px, **on** always floats it, and **off** leaves the normal VS Code layout. The mode is remembered by each browser, so your phone can float the side bar while your desktop monitor keeps it docked.

Everything else stays as it was: resizing the side bar, switching views (Explorer, Search, extensions), context menus and webview views inside the side bar.

<img src="docs/img/touch-open.png" width="480" alt="Touch: the side bar opened from the edge handle">

## Install

On the machine that runs the server:

```sh
git clone https://github.com/wilsonzhang2/vscode-web-float-sidebar.git
cd vscode-web-float-sidebar
sudo ./float-sidebar.sh install            # finds code-server / openvscode-server by itself
# or name the install directory:
sudo ./float-sidebar.sh install /usr/lib/code-server
```

Then reload the browser tab. You do not need to restart the server. Use `sudo` only if the server files are owned by root (as with the code-server .deb/.rpm packages).

```sh
./float-sidebar.sh status      # where it is installed
sudo ./float-sidebar.sh uninstall
```

**Run `install` again after every server upgrade.** An upgrade replaces the patched file. The command is idempotent. To re-apply automatically after code-server package upgrades on Debian/Ubuntu (change the path to where you cloned this repository):

```sh
echo 'DPkg::Post-Invoke { "/opt/vscode-web-float-sidebar/float-sidebar.sh install /usr/lib/code-server || true"; };' \
  | sudo tee /etc/apt/apt.conf.d/99float-sidebar
```

Docker images (add to your Dockerfile):

```dockerfile
# gitpod/openvscode-server
COPY vscode-web-float-sidebar /opt/float-sidebar
RUN /opt/float-sidebar/float-sidebar.sh install /home/.openvscode-server

# codercom/code-server
COPY vscode-web-float-sidebar /opt/float-sidebar
RUN sudo /opt/float-sidebar/float-sidebar.sh install /usr/lib/code-server
```

Tip: install the page as an app (Chrome/Edge "Install", Safari "Add to Home Screen"). In app mode you get the whole screen, and the browser takes fewer keyboard shortcuts for itself.

## What it changes

- It adds one `<script>` tag to `…/out/vs/code/browser/workbench/workbench.html` and copies `float-sidebar.js` next to it. The first install also keeps a backup copy as `workbench.html.float-sidebar.orig`.
- It makes no network requests, collects nothing, and touches no settings or extensions.

## How it works

The workbench sizes itself from `window.innerWidth`. The script reports a width that is larger by exactly the width of the side bar (plus the activity bar) and moves the workbench left by the same amount. VS Code therefore lays the side bar out just past the left screen edge, and the editor and secondary side bar fill the visible width. Showing the side bar is then only a CSS translate, so nothing else is laid out again. Some details:

- Webviews in the side bar live in a separate layer that VS Code positions on its own. The script moves them along with the side bar and puts them above it.
- The title bar and status bar are pinned to the visible area.
- Quick Open is re-centred on the screen.
- If the script cannot find what it expects (an unknown VS Code version, or the side bar on the right), it reports a normal width and the workbench behaves as if the script were not installed.

## Compatibility and limits

| | Status |
|---|---|
| code-server 4.138.0 (VS Code 1.138.0) | automated tests pass |
| openvscode-server 1.109.5 | automated tests pass |
| Chrome / Edge / Android Chrome | expected to work (tests run on Chromium) |
| Safari on iPhone / iPad | expected to work (iOS layout uses `visualViewport`, which is handled as well), but not yet tested on a device |
| Real phones and tablets | not yet tested; the tests emulate touch in Chromium |
| Claude Code / Codex panels | not yet tested with the real extensions; the tests use stand-in webviews in the same places |

Limits:

- It only works with the side bar on the **left** (the default).
- If the bottom panel is set to span the full window width (`panel alignment: justify`), its left part sits under the parked side bar.
- It relies on VS Code internals: `window.innerWidth`, the `.part.*` class names and the webview layer. A future VS Code release may break it. Run the test suite against a new version before you upgrade a server you depend on.

## Tests

`test/` contains a fixture extension (a webview in the side bar and a webview "chat" in the editor), a script that starts throw-away servers, and an end-to-end suite of 36 checks per server. The suite runs headless Chromium through Playwright and covers layout, hovering the edge, Ctrl+B, Esc, touch, the context menu, Quick Open, the three modes, window resizes and a 2560 px desktop.

```sh
cd test && npm install
CS_DIR=/path/to/code-server-copy OVS_DIR=/path/to/openvscode-server ./servers.sh start
../float-sidebar.sh install /path/to/code-server-copy /path/to/openvscode-server
node e2e.mjs http://127.0.0.1:8091/
node e2e.mjs "http://127.0.0.1:8092/?folder=$PWD/.work/ws"
./servers.sh stop
```

To see why the side bar opens or closes, run `localStorage.setItem('floatSidebar.debug', '1')` in the browser console and reload. Every open and close is then logged with its reason.

Use **copies** of the servers for testing, never the server you work in. Set `CHROME=/path/to/chrome` if Playwright's headless shell is not in the default location.

## License

MIT. This project is not affiliated with Microsoft, Coder or Gitpod.
