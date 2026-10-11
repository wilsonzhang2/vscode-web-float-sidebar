# Working on this repository

- Start by reading `README.md` and `CHANGELOG.md`. If `notes/` exists, read the latest file in it. `notes/` holds local handoff notes and is ignored by Git.
- `src/float-sidebar.js` is the whole feature. `float-sidebar.sh` installs it. Keep both dependency-free.
- **Test only against copies of the servers**, never against a server someone is working in. Copy the code-server install directory, or download openvscode-server, then run `test/servers.sh start` (ports 8091/8092, local only, no auth) and `node test/e2e.mjs <url>`. All 36 checks must pass on both servers before a commit that touches `src/`.
- Start test servers with `env -i HOME="$HOME" PATH="$PATH"`, as `servers.sh` does. Otherwise a code-server started from inside code-server inherits its environment and exits with "not spawned with IPC".
- Do not install into, uninstall from or restart the owner's live code-server without asking first. That server is how the owner reaches the machine. Back up `workbench.html` before any change.
- This is a public repository. Never commit hostnames, domains, IP addresses, tokens or personal data. Run `gitleaks git --staged` before every push.
- When behaviour changes, update both READMEs (`README.md` and `README.zh-CN.md`) and `CHANGELOG.md`. Rebuild the demo video with `demo/make.sh` when the visible behaviour changes.
