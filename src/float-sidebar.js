/*!
 * float-sidebar.js — a floating (overlay) primary side bar for VS Code in the browser
 * (code-server, openvscode-server). https://github.com/wilsonzhang2/vscode-web-float-sidebar
 * MIT License.
 *
 * How it works, in one paragraph: the workbench sizes itself from window.innerWidth. We report
 * a width that is larger by exactly the width of the side bar (+ activity bar) and slide the
 * whole workbench left by the same amount, so VS Code lays the side bar out just off the left
 * edge of the screen and the editor (and secondary side bar) fill the visible width. Showing the
 * side bar is then a pure CSS translate on top of everything else: nothing else is re-laid out.
 *
 * Must be loaded as a classic <script> in <head>, before the workbench module script.
 */
(() => {
	'use strict';
	if (window.__floatSidebar) { return; }

	const VERSION = '0.1.0';
	const STORE_KEY = 'floatSidebar.mode';     // 'auto' | 'on' | 'off'
	const AUTO_MAX_WIDTH = 1400;               // 'auto' floats the side bar below this CSS width
	const EDGE_WIDTH = 6;                      // px hot zone at the left screen edge (mouse)
	const OPEN_DELAY = 120;                    // ms the mouse has to rest on the edge
	const CLOSE_DELAY = 300;                   // ms after the mouse leaves the side bar
	const log = (...a) => console.info('[float-sidebar]', ...a);
	let debug = false;
	try { debug = localStorage.getItem('floatSidebar.debug') === '1'; } catch { /* storage blocked */ }

	const root = document.documentElement;

	// ---- 1. report a wider window to the workbench layout -------------------------------------
	function findDescriptor(obj, key) {
		for (let o = obj; o; o = Object.getPrototypeOf(o)) {
			const d = Object.getOwnPropertyDescriptor(o, key);
			if (d) { return d; }
		}
		return undefined;
	}
	const innerWidthDesc = findDescriptor(window, 'innerWidth');
	if (!innerWidthDesc || typeof innerWidthDesc.get !== 'function') {
		log('window.innerWidth cannot be patched in this browser; disabled');
		return;
	}
	const realWidth = () => innerWidthDesc.get.call(window);
	let shift = 0; // px of workbench currently pushed past the left screen edge
	try {
		Object.defineProperty(window, 'innerWidth', {
			configurable: true, enumerable: true, get: () => realWidth() + shift
		});
		// VS Code measures visualViewport instead of innerWidth on iOS.
		const vv = window.visualViewport;
		const vvDesc = vv && findDescriptor(vv, 'width');
		if (vvDesc && typeof vvDesc.get === 'function') {
			Object.defineProperty(vv, 'width', {
				configurable: true, enumerable: true, get: () => vvDesc.get.call(vv) + shift
			});
		}
	} catch (err) {
		log('could not patch window size; disabled', err);
		return;
	}

	// ---- 2. styles -------------------------------------------------------------------------------
	const css = `
html.fs-on, html.fs-on body { overflow: hidden !important; }
html.fs-on body { margin-left: calc(-1 * var(--fs-shift, 0px)) !important; width: calc(100% + var(--fs-shift, 0px)) !important; }
html.fs-on .fs-full { margin-left: var(--fs-shift, 0px) !important; width: calc(100% - var(--fs-shift, 0px)) !important; }
html.fs-on .fs-full > .part { width: 100% !important; }
html.fs-on .fs-side { z-index: 2600 !important; transition: translate .16s ease-out; }
html.fs-on.fs-open .fs-side { translate: var(--fs-shift, 0px) 0; }
html.fs-on.fs-open .fs-side.fs-last { box-shadow: 6px 0 24px rgba(0, 0, 0, .28); }
html.fs-on .fs-wv { z-index: 2601 !important; transition: translate .16s ease-out; }
html.fs-on.fs-open .fs-wv.fs-wv-shift { translate: var(--fs-shift, 0px) 0; }
html.fs-on .fs-wv.fs-wv-hide { visibility: hidden !important; }
html.fs-on .quick-input-widget { translate: calc(var(--fs-shift, 0px) / 2) 0; }
.fs-edge, .fs-handle { display: none; }
html.fs-on.fs-ready .fs-edge { display: block; position: fixed; left: 0; top: 0; bottom: 0; width: ${EDGE_WIDTH}px; z-index: 2590; }
html.fs-on.fs-ready:not(.fs-open) .fs-handle { display: flex; }
.fs-handle { position: fixed; left: 0; top: 42%; width: 18px; height: 56px; z-index: 2590; align-items: center; justify-content: center;
	border: 0; padding: 0; border-radius: 0 10px 10px 0; cursor: pointer; opacity: .85; touch-action: manipulation;
	background: var(--vscode-button-background, #0e639c); color: var(--vscode-button-foreground, #fff); font: 14px/1 sans-serif; }
@media (pointer: fine) { .fs-handle { width: 6px; opacity: .35; } .fs-handle:hover { width: 14px; opacity: .9; } .fs-handle span { display: none; } }
.fs-statusbar .codicon { vertical-align: text-bottom; }
@media (prefers-reduced-motion: reduce) { html.fs-on .fs-side { transition: none; } }
`;
	const style = document.createElement('style');
	style.id = 'float-sidebar-style';
	style.textContent = css;
	(document.head || root).appendChild(style);

	// ---- 3. state ---------------------------------------------------------------------------------
	let mode = 'auto';
	try { mode = localStorage.getItem(STORE_KEY) || 'auto'; } catch { /* storage blocked */ }
	if (!['auto', 'on', 'off'].includes(mode)) { mode = 'auto'; }
	let open = false;
	let floatingSince = 0;
	let openedAt = 0; // focus may bounce back to the editor right after opening (e.g. Ctrl+B in a webview)
	const settling = () => Date.now() - openedAt < 500;
	let openWhenReady = false;

	const wanted = () => mode === 'on' || (mode === 'auto' && realWidth() < AUTO_MAX_WIDTH);
	const q = (sel) => document.querySelector(sel);
	const workbench = () => q('.monaco-workbench');
	const visible = (el) => !!el && el.offsetParent !== null && el.getClientRects().length > 0;

	// The side bar must be on the left for this to make sense.
	function sideBarOnLeft() {
		const sb = q('.monaco-workbench .part.sidebar');
		return !sb || !sb.classList.contains('right');
	}

	// How far the editor area starts from the left edge of the workbench = activity bar + side bar.
	function measure() {
		const wb = workbench();
		const ed = q('.monaco-workbench .part.editor');
		if (!wb || !visible(ed) || !sideBarOnLeft()) { return 0; }
		return Math.max(0, Math.round(ed.getBoundingClientRect().left - wb.getBoundingClientRect().left));
	}

	function viewOf(part) { return part.closest('.split-view-view') || part; }

	// Tag the views to float (activity bar + side bar) and the full-width rows (title, banner,
	// status bar). Only touch classes that change: re-adding them would restart the slide
	// transition and make an open side bar jump.
	function setClasses(el, want) {
		for (const c of ['fs-side', 'fs-full', 'fs-last']) {
			const on = want.includes(c);
			if (el.classList.contains(c) !== on) { el.classList.toggle(c, on); }
		}
	}
	let marked = new Set();
	function mark() {
		const want = new Map();
		const side = [];
		for (const sel of ['.part.activitybar', '.part.sidebar']) {
			const p = q('.monaco-workbench ' + sel);
			if (visible(p)) { side.push(viewOf(p)); }
		}
		side.forEach((v, i) => want.set(v, i === side.length - 1 ? ['fs-side', 'fs-last'] : ['fs-side']));
		for (const sel of ['.part.titlebar', '.part.banner', '.part.statusbar']) {
			const p = q('.monaco-workbench ' + sel);
			if (p && !want.has(viewOf(p))) { want.set(viewOf(p), ['fs-full']); }
		}
		for (const el of marked) { if (!want.has(el)) { setClasses(el, []); } }
		for (const [el, cls] of want) { setClasses(el, cls); }
		marked = new Set(want.keys());
	}

	// Webviews (e.g. the Claude session list) are not inside the side bar: VS Code draws them in
	// a layer of children of .monaco-workbench placed over their view. Newer VS Code (~1.110+)
	// pins that layer to the view with CSS anchor positioning, so it follows the side bar by itself
	// and only has to be lifted above it. Older versions position it with left/top and only update
	// on a workbench layout, so there we also move the side bar's webviews ourselves.
	const wvObserver = new MutationObserver(() => syncWebviews());
	const wvWatched = new WeakSet();
	function webviewLayers() {
		const wb = workbench();
		if (!wb) { return []; }
		return [...wb.children].filter(el => el.querySelector('iframe.webview'));
	}
	function syncWebviews() {
		const sb = q('.monaco-workbench .part.sidebar');
		const sbr = visible(sb) ? sb.getBoundingClientRect() : null;
		let parked = false;
		const wb = workbench();
		const wbLeft = wb ? wb.getBoundingClientRect().left + wb.clientLeft : 0;
		for (const el of webviewLayers()) {
			if (!wvWatched.has(el)) { wvWatched.add(el); wvObserver.observe(el, { attributes: true, attributeFilter: ['style'] }); }
			const anchored = /anchor/.test(el.getAttribute('style') || '');
			const r = el.getBoundingClientRect();
			// where VS Code put it, without our translate (which may be mid-transition)
			const left = anchored ? r.left : wbLeft + el.offsetLeft;
			const offscreen = !!sbr && shift > 0 && left >= -shift - 1 && left + r.width <= 1;
			const overSide = !!sbr && open && left >= sbr.left - 1 && left + r.width <= sbr.right + 1;
			const stale = !anchored && !!sbr && !open && shift > 0 && el.classList.contains('fs-wv') && !offscreen;
			el.classList.toggle('fs-wv', offscreen || overSide || stale);
			el.classList.toggle('fs-wv-shift', open && offscreen && !anchored);
			el.classList.toggle('fs-wv-hide', stale); // left over the editor after closing: hide until re-laid out
			parked = parked || stale;
		}
		if (parked) { nudgeLayout(); }
	}
	let nudgeTimer = 0;
	function nudgeLayout() {
		clearTimeout(nudgeTimer);
		nudgeTimer = setTimeout(() => { window.dispatchEvent(new Event('resize')); setTimeout(syncWebviews, 80); }, 30);
	}

	// ---- 4. layout sync ---------------------------------------------------------------------------
	let raf = 0;
	const schedule = () => { if (!raf) { raf = requestAnimationFrame(sync); } };

	function setShift(px) {
		if (px === shift) { return false; }
		shift = px;
		root.style.setProperty('--fs-shift', px + 'px');
		window.dispatchEvent(new Event('resize')); // the workbench re-reads innerWidth on resize
		return true;
	}

	// A resize event sent before the workbench listens is lost; if the workbench is not as wide as
	// the width we report, send another one (rate-limited).
	let lastNudge = 0;
	function nudgeIfStale() {
		const wb = workbench();
		if (!wb || !ready()) { return; }
		const expected = realWidth() + shift;
		if (Math.abs(wb.getBoundingClientRect().width - expected) > 1 && Date.now() - lastNudge > 250) {
			lastNudge = Date.now();
			window.dispatchEvent(new Event('resize'));
			setTimeout(schedule, 60);
		}
	}
	const ready = () => !!q('.monaco-workbench .part.editor');

	function sync() {
		raf = 0;
		const isReady = ready();
		root.classList.toggle('fs-ready', isReady);
		const on = isReady && wanted();
		if (on && !root.classList.contains('fs-on')) { floatingSince = Date.now(); }
		root.classList.toggle('fs-on', on);
		mark();
		let target = on ? measure() : 0;
		if (setShift(target)) {
			// re-measure after the workbench has re-laid out (side bar width may be clamped)
			setTimeout(schedule, 50);
		} else {
			nudgeIfStale();
		}
		if (!on || shift === 0) { setOpen(false, 'not floating'); }
		else if (openWhenReady) { openWhenReady = false; setOpen(true, 'side bar shown'); }
		ensureButton();
		ensureEdge();
		syncWebviews();
	}

	// ---- 5. open / close --------------------------------------------------------------------------
	function setOpen(v, why = '') {
		v = !!v && shift > 0 && root.classList.contains('fs-on');
		if (v === open) { return; }
		if (debug) { log((v ? 'open' : 'close') + (why ? ' (' + why + ')' : '')); }
		if (v) { syncWebviews(); } // classify the side bar's webviews while they are still parked
		open = v;
		if (v) { openedAt = Date.now(); }
		root.classList.toggle('fs-open', v);
		syncWebviews();
		if (v) {
			const sb = q('.monaco-workbench .part.sidebar');
			if (sb) { requestAnimationFrame(() => focusInside(sb)); }
		}
		updateButton();
	}
	// Move focus out of the editor (a webview there would swallow Esc) into the side bar.
	function focusInside(el) {
		if (el.contains(document.activeElement)) { return; }
		for (const sel of ['.monaco-list', '.pane-header[tabindex]', '[tabindex="0"]']) {
			const f = el.querySelector(sel);
			if (f && visible(f)) { f.focus({ preventScroll: true }); if (el.contains(document.activeElement)) { return; } }
		}
		if (!el.hasAttribute('tabindex')) { el.tabIndex = -1; }
		el.focus({ preventScroll: true });
	}

	let openTimer = 0, closeTimer = 0;
	const clear = () => { clearTimeout(openTimer); clearTimeout(closeTimer); };
	// real menus / pickers / dialogs (not hover tooltips, which also use .context-view)
	const menuVisible = () => [...document.querySelectorAll('.context-view .monaco-menu, .monaco-menu-container, .quick-input-widget, .monaco-dialog-box')]
		.some(el => visible(el) && el.childElementCount > 0 && getComputedStyle(el).display !== 'none');
	// the side bar itself, or one of its webview layers (which live outside it in the DOM)
	const inSide = (el) => !!el && !!el.closest && !!el.closest('.fs-side, .fs-wv');

	function armClose() {
		clearTimeout(closeTimer);
		closeTimer = setTimeout(() => {
			if (menuVisible() || dragging) { return armClose(); }
			setOpen(false, 'mouse left');
		}, CLOSE_DELAY);
	}

	let edge, handle;
	function ensureEdge() {
		if (!edge) {
			edge = document.createElement('div');
			edge.className = 'fs-edge';
			handle = document.createElement('button');
			handle.className = 'fs-handle';
			handle.type = 'button';
			handle.title = 'Show side bar';
			handle.setAttribute('aria-label', 'Show side bar');
			handle.innerHTML = '<span aria-hidden="true">›</span>';
			handle.addEventListener('click', () => setOpen(true, 'handle'));
			for (const el of [edge, handle]) { // mouse resting on the left edge (the handle is on the edge too)
				el.addEventListener('pointerenter', (e) => {
					if (e.pointerType === 'touch' || Date.now() - floatingSince < 1500) { return; } // not for a cursor that was already there
					clearTimeout(openTimer);
					openTimer = setTimeout(() => setOpen(true, 'edge'), OPEN_DELAY);
				});
				el.addEventListener('pointerleave', (e) => {
					if (!e.relatedTarget || (e.relatedTarget !== edge && e.relatedTarget !== handle)) { clearTimeout(openTimer); }
				});
			}
		}
		if (document.body && edge.parentNode !== document.body) {
			document.body.appendChild(edge);
			document.body.appendChild(handle);
		}
	}

	// mouse leaving / entering the floating side bar
	document.addEventListener('pointerover', (e) => {
		if (!open || e.pointerType === 'touch') { return; }
		if (inSide(e.target)) { clearTimeout(closeTimer); }
	}, true);
	document.addEventListener('pointerout', (e) => {
		if (!open || e.pointerType === 'touch') { return; }
		if (inSide(e.target) && !inSide(e.relatedTarget)) { armClose(); }
	}, true);

	// a click / tap anywhere outside closes it
	let dragging = false;
	document.addEventListener('pointerdown', (e) => {
		if (e.target && e.target.closest && e.target.closest('.monaco-sash')) { dragging = true; }
		if (!open) { return; }
		const t = e.target;
		if (inSide(t) || (t.closest && t.closest('.fs-handle, .fs-statusbar, .context-view, .monaco-menu-container, .quick-input-widget'))) { return; }
		setOpen(false, 'pointerdown outside');
	}, true);
	document.addEventListener('pointerup', () => { dragging = false; schedule(); }, true);

	// focus moving into an editor webview (e.g. the Claude / Codex chat) does not produce pointer
	// events in this document, only a blur of the window; close then.
	window.addEventListener('blur', () => {
		setTimeout(() => {
			if (!open || settling()) { return; }
			const a = document.activeElement;
			if (a && a.tagName === 'IFRAME' && !inSide(a)) { setOpen(false, 'focus into editor webview'); }
		}, 0);
	});
	document.addEventListener('focusin', (e) => {
		if (open && !settling() && !inSide(e.target) && !menuVisible() && !(e.target.closest && e.target.closest('.fs-handle, .fs-statusbar'))) { setOpen(false, 'focus outside: ' + e.target.tagName + '.' + e.target.className); }
	}, true);

	// keyboard: Ctrl/Cmd+B toggles the floating side bar; Ctrl+Alt+Shift+B cycles the mode; Esc closes
	window.addEventListener('keydown', (e) => {
		const k = (e.key || '').toLowerCase();
		const mod = e.ctrlKey || e.metaKey;
		if (mod && e.altKey && e.shiftKey && k === 'b') {
			e.preventDefault(); e.stopImmediatePropagation(); cycleMode(); return;
		}
		if (!root.classList.contains('fs-on')) { return; }
		if (mod && !e.altKey && !e.shiftKey && k === 'b') {
			if (shift > 0 && visible(q('.monaco-workbench .part.sidebar'))) {
				e.preventDefault(); e.stopImmediatePropagation(); setOpen(!open, 'Ctrl+B');
			} else {
				openWhenReady = true; // let VS Code show the side bar, then float it in
			}
			return;
		}
		if (open && k === 'escape' && !menuVisible()) { setOpen(false, 'Esc'); }
	}, true);

	// ---- 6. status bar switch ---------------------------------------------------------------------
	let btn;
	const LABEL = { auto: 'Float: auto', on: 'Float: on', off: 'Float: off' };
	function ensureButton() {
		const right = q('.monaco-workbench .part.statusbar .right-items');
		if (!right) { return; }
		if (!btn) {
			btn = document.createElement('div');
			btn.className = 'statusbar-item fs-statusbar';
			btn.innerHTML = '<a class="statusbar-item-label" role="button" tabindex="-1"><span class="codicon codicon-layout-sidebar-left"></span> <span class="fs-label"></span></a>';
			btn.addEventListener('click', (e) => { e.stopPropagation(); cycleMode(); });
		}
		if (btn.parentNode !== right) { right.insertBefore(btn, right.firstChild); }
		updateButton();
	}
	function updateButton() {
		if (!btn) { return; }
		const on = root.classList.contains('fs-on');
		btn.querySelector('.fs-label').textContent = LABEL[mode] + (mode === 'auto' ? (on ? ' (on)' : ' (off)') : '');
		btn.title = 'Floating side bar — click to switch auto / on / off (Ctrl+Alt+Shift+B).\n' +
			'auto: float when the window is narrower than ' + AUTO_MAX_WIDTH + 'px.\n' +
			'While floating: move the mouse to the left edge, tap the handle, or press Ctrl+B to show the side bar.';
	}
	function setMode(m) {
		if (!['auto', 'on', 'off'].includes(m)) { return; }
		mode = m;
		try { localStorage.setItem(STORE_KEY, m); } catch { /* storage blocked */ }
		schedule();
	}
	function cycleMode() { setMode(mode === 'auto' ? 'on' : mode === 'on' ? 'off' : 'auto'); }

	// ---- 7. watch the workbench ---------------------------------------------------------------------
	window.addEventListener('resize', schedule);
	const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
	let observed = new Set();
	function observeParts() {
		if (!ro) { return; }
		for (const sel of ['.part.activitybar', '.part.sidebar', '.part.editor', '.part.statusbar']) {
			const p = q('.monaco-workbench ' + sel);
			if (p && !observed.has(p)) { observed.add(p); ro.observe(p); }
		}
	}
	setInterval(() => { observeParts(); schedule(); }, 1000); // cheap safety net for missed changes
	const mo = new MutationObserver(() => { observeParts(); schedule(); });
	const start = () => {
		mo.observe(document.body, { childList: true });
		schedule();
	};
	if (document.body) { start(); } else { document.addEventListener('DOMContentLoaded', start); }

	window.__floatSidebar = {
		version: VERSION,
		get mode() { return mode; },
		get shift() { return shift; },
		get isOpen() { return open; },
		get isFloating() { return root.classList.contains('fs-on') && shift > 0; },
		setMode, open: () => setOpen(true, 'api'), close: () => setOpen(false, 'api'), toggle: () => setOpen(!open, 'api')
	};
	log('v' + VERSION + ' loaded, mode=' + mode);
})();
