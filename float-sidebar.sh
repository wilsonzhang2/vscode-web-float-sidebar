#!/bin/sh
# float-sidebar.sh — install / remove the floating side bar in code-server or openvscode-server.
# https://github.com/wilsonzhang2/vscode-web-float-sidebar   MIT License
#
#   ./float-sidebar.sh install   [DIR...]   add it (idempotent; run again after every server upgrade)
#   ./float-sidebar.sh uninstall [DIR...]   remove it and restore the original page
#   ./float-sidebar.sh status    [DIR...]   show where it is installed
#
# DIR is the server's install directory (e.g. /usr/lib/code-server, ~/openvscode-server-v1.x)
# or the workbench.html file itself. Without DIR, common install locations are searched.
# Only workbench.html is edited (a single <script> tag) and float-sidebar.js is copied next to it.
# No restart is needed; reload the browser tab.
set -eu

VERSION=0.1.0
HERE=$(cd "$(dirname "$0")" && pwd)
JS="$HERE/src/float-sidebar.js"
REL=out/vs/code/browser/workbench
BEGIN='<!-- float-sidebar:begin'
END='<!-- float-sidebar:end -->'

die() { echo "error: $*" >&2; exit 1; }

# html_for DIR -> path of workbench.html, or nothing
html_for() {
	d=$1
	case $d in *.html) [ -f "$d" ] && echo "$d"; return 0 ;; esac
	for c in "$d/lib/vscode/$REL/workbench.html" "$d/$REL/workbench.html"; do
		[ -f "$c" ] && { echo "$c"; return 0; }
	done
	return 0
}

candidates() {
	for b in code-server openvscode-server; do
		p=$(command -v "$b" 2>/dev/null || true)
		[ -n "$p" ] && { p=$(readlink -f "$p"); dirname "$(dirname "$p")"; }
	done
	for d in /usr/lib/code-server /usr/local/lib/code-server "$HOME"/.local/lib/code-server-* \
		/home/.openvscode-server /opt/openvscode-server* "$HOME"/openvscode-server* /app/openvscode-server*; do
		[ -d "$d" ] && echo "$d"
	done
	return 0
}

targets() {
	if [ $# -gt 0 ]; then
		for d in "$@"; do
			h=$(html_for "$d"); [ -n "$h" ] || die "no workbench.html found under $d"
			echo "$h"
		done
	else
		candidates | while read -r d; do html_for "$d"; done
	fi | awk '!seen[$0]++'
}

strip_block() { # file -> stdout without our block
	awk -v b="$BEGIN" -v e="$END" 'index($0,b){skip=1} !skip{print} index($0,e){skip=0}' "$1"
}

do_install() {
	h=$1; dir=$(dirname "$h")
	[ -w "$h" ] && [ -w "$dir" ] || die "no write access to $h (try: sudo $0 install $(dirname "$h"))"
	grep -q '{{WORKBENCH_WEB_BASE_URL}}' "$h" || die "$h does not look like a VS Code web workbench page"
	[ -f "$h.float-sidebar.orig" ] || cp -p "$h" "$h.float-sidebar.orig"
	cp "$JS" "$dir/float-sidebar.js"; chmod 644 "$dir/float-sidebar.js"
	nonce=''
	grep -q '{{WORKBENCH_SCRIPT_NONCE}}' "$h" && nonce=' nonce="{{WORKBENCH_SCRIPT_NONCE}}"'
	tag="<script$nonce src=\"{{WORKBENCH_WEB_BASE_URL}}/$REL/float-sidebar.js?v=$VERSION\"></script>"
	tmp="$h.float-sidebar.tmp"
	strip_block "$h" | awk -v b="$BEGIN v$VERSION -->" -v t="$tag" -v e="$END" '
		!done && /<\/head>/ { print "\t\t" b; print "\t\t" t; print "\t\t" e; done=1 }
		{ print }
		END { if (!done) exit 3 }' > "$tmp" || { rm -f "$tmp"; die "no </head> in $h"; }
	cat "$tmp" > "$h"; rm -f "$tmp"   # keep owner and mode of the original file
	echo "installed v$VERSION: $h"
}

do_uninstall() {
	h=$1; dir=$(dirname "$h")
	[ -w "$h" ] || die "no write access to $h (try sudo)"
	if grep -q "$BEGIN" "$h"; then
		tmp="$h.float-sidebar.tmp"; strip_block "$h" > "$tmp"; cat "$tmp" > "$h"; rm -f "$tmp"
		echo "removed: $h"
	else
		echo "not installed: $h"
	fi
	rm -f "$dir/float-sidebar.js" "$h.float-sidebar.orig"
}

do_status() {
	h=$1
	v=$(grep -o "$BEGIN v[0-9.]*" "$h" 2>/dev/null | sed 's/.* v//' || true)
	if [ -n "$v" ]; then echo "installed v$v: $h"; else echo "not installed: $h"; fi
}

cmd=${1:-}; [ $# -gt 0 ] && shift
case $cmd in
	install|uninstall|status) ;;
	-v|--version) echo "$VERSION"; exit 0 ;;
	*) sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'; exit 1 ;;
esac
[ "$cmd" != install ] || [ -f "$JS" ] || die "missing $JS"
list=$(targets "$@")
[ -n "$list" ] || die "no code-server / openvscode-server installation found; pass its directory"
echo "$list" | while read -r h; do "do_$cmd" "$h"; done
