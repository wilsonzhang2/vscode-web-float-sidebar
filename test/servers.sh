#!/bin/sh
# Start / stop throw-away test servers on 127.0.0.1 (no auth). Point them at COPIES of the
# servers, because the test installs float-sidebar into them.
#   CS_DIR=/path/to/code-server-copy OVS_DIR=/path/to/openvscode-server ./servers.sh start|stop
set -eu
HERE=$(cd "$(dirname "$0")" && pwd)
W="$HERE/.work"
CS_PORT=${CS_PORT:-8091}; OVS_PORT=${OVS_PORT:-8092}
case ${1:-} in
start)
	mkdir -p "$W/ws" "$W/cs-ud/User" "$W/ovs-data" "$W/ext"
	rm -rf "$W/ext/fstest.fs-fixture-0.0.1"; cp -r "$HERE/fixture-ext" "$W/ext/fstest.fs-fixture-0.0.1"
	printf '%s\n' '{ "workbench.startupEditor": "none", "workbench.secondarySideBar.defaultVisibility": "hidden",' \
		'"security.workspace.trust.enabled": false, "window.menuBarVisibility": "classic", "chat.disableAIFeatures": true }' > "$W/cs-ud/User/settings.json"
	mkdir -p "$W/ovs-data/data/User" && cp "$W/cs-ud/User/settings.json" "$W/ovs-data/data/User/settings.json"
	echo "hello" > "$W/ws/readme.txt"
	: > "$W/empty-config.yaml"
	if [ -n "${CS_DIR:-}" ]; then
		nohup env -i HOME="$HOME" PATH="$PATH" LANG=C.UTF-8 "$CS_DIR/bin/code-server" --config "$W/empty-config.yaml" --bind-addr 127.0.0.1:$CS_PORT --auth none \
			--user-data-dir "$W/cs-ud" --extensions-dir "$W/ext" --disable-telemetry --disable-update-check "$W/ws" \
			> "$W/cs.log" 2>&1 & echo $! > "$W/cs.pid"
	fi
	if [ -n "${OVS_DIR:-}" ]; then
		nohup env -i HOME="$HOME" PATH="$PATH" LANG=C.UTF-8 "$OVS_DIR/bin/openvscode-server" --host 127.0.0.1 --port $OVS_PORT --without-connection-token \
			--server-data-dir "$W/ovs-data" --extensions-dir "$W/ext" --telemetry-level off \
			> "$W/ovs.log" 2>&1 & echo $! > "$W/ovs.pid"
	fi
	for i in $(seq 1 60); do
		ok=1
		[ -z "${CS_DIR:-}" ] || curl -fs -o /dev/null "http://127.0.0.1:$CS_PORT/healthz" || ok=0
		[ -z "${OVS_DIR:-}" ] || curl -fs -o /dev/null "http://127.0.0.1:$OVS_PORT/" || ok=0
		[ $ok = 1 ] && { echo "servers up"; exit 0; }
		sleep 1
	done
	echo "servers did not come up; see $W/*.log" >&2; exit 1 ;;
stop)
	for f in "$W/cs.pid" "$W/ovs.pid"; do [ -f "$f" ] && { kill "$(cat "$f")" 2>/dev/null || true; rm -f "$f"; }; done
	echo "servers stopped" ;;
*) echo "usage: $0 start|stop" >&2; exit 1 ;;
esac
