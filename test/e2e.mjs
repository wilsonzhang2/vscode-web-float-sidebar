// End-to-end checks for float-sidebar against a running code-server / openvscode-server that
// has it installed and the fixture extension loaded (see servers.sh).
//   node e2e.mjs http://127.0.0.1:8091/ [screenshot-prefix]
import { chromium } from 'playwright-core';

const url = process.argv[2];
const shots = process.argv[3] || '';
const exe = process.env.CHROME ||
	`${process.env.HOME}/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell`;

let failed = 0;
const ok = (cond, name, detail = '') => {
	console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
	if (!cond) { failed++; }
};
const near = (a, b, tol = 2) => Math.abs(a - b) <= tol;

const browser = await chromium.launch({ executablePath: exe });

async function boot(opts, mode) {
	const ctx = await browser.newContext(opts);
	const page = await ctx.newPage();
	page.on('pageerror', e => console.log('  pageerror:', e.message.slice(0, 160)));
	await page.addInitScript(m => { try { localStorage.setItem('floatSidebar.debug', '1'); if (m) { localStorage.setItem('floatSidebar.mode', m); } } catch { } }, mode || '');
	if (process.env.FS_DEBUG) { page.on('console', m => { if (m.text().startsWith('[float-sidebar]')) { console.log('  log:', m.text()); } }); }
	await page.goto(url);
	await page.waitForSelector('.monaco-workbench .part.editor', { timeout: 60000 });
	// openvscode-server asks whether to trust the folder; the fixture extension only runs if trusted
	const trust = page.locator('.monaco-dialog-box .monaco-button', { hasText: /Yes, I trust/ });
	await trust.waitFor({ timeout: 8000 }).then(() => trust.click()).catch(() => { });
	await page.waitForFunction(() => [...document.querySelectorAll('iframe.webview')].length >= 2, null, { timeout: 60000 });
	await page.waitForTimeout(2500);
	return { ctx, page };
}

const geom = (page) => page.evaluate(() => {
	const r = (s) => { const e = document.querySelector(s); if (!e || !e.getClientRects().length) { return null; } const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, w: b.width, h: b.height }; };
	const wv = [...document.querySelectorAll('iframe.webview')].map(f => { const b = f.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, w: b.width, h: b.height }; });
	const fs = window.__floatSidebar;
	return {
		vw: document.documentElement.clientWidth, fs: { mode: fs.mode, shift: fs.shift, open: fs.isOpen, floating: fs.isFloating },
		side: r('.part.sidebar'), ed: r('.part.editor'), aux: r('.part.auxiliarybar'), status: r('.part.statusbar'), title: r('.part.titlebar'), wv
	};
});
// the side webview is the narrower one
const sideWv = (g) => g.wv.filter(w => w.w > 0).sort((a, b) => a.w - b.w)[0];
const topAt = (page, x, y) => page.evaluate(([x, y]) => {
	const e = document.elementFromPoint(x, y);
	if (!e) { return 'none'; }
	if (e.tagName === 'IFRAME') { return 'iframe:' + Math.round(e.getBoundingClientRect().width); }
	return e.closest('.part.sidebar') ? 'sidebar' : e.closest('.part.editor') ? 'editor' : e.tagName + '.' + e.className;
}, [x, y]);

// ---------------------------------------------------------------- phone-size, mouse + keyboard
{
	console.log(`\n# ${url} — 933x704 (foldable inner screen), mouse`);
	const { ctx, page } = await boot({ viewport: { width: 933, height: 704 } });
	let g = await geom(page);
	const edRight = g.aux ? g.aux.r : g.ed.r;
	ok(g.fs.mode === 'auto' && g.fs.floating, 'auto mode floats below 1400px', JSON.stringify(g.fs));
	ok(near(g.ed.l, 0), 'editor starts at the left screen edge', `editor.left=${g.ed.l}`);
	ok(near(edRight, g.vw), 'editor (+ secondary side bar) fills the screen width', `right=${edRight} vw=${g.vw}`);
	ok(g.side && g.side.r <= 1, 'side bar is parked off screen', `side.right=${g.side && g.side.r}`);
	ok(g.status && near(g.status.l, 0) && near(g.status.r, g.vw), 'status bar spans the visible width');
	ok(g.title ? near(g.title.l, 0) && near(g.title.r, g.vw) : true, 'title bar spans the visible width');
	const chatW = g.wv.map(w => w.w).sort((a, b) => b - a)[0];
	if (shots) { await page.screenshot({ path: `${shots}-933-closed.png` }); }

	// hover the left edge
	await page.mouse.move(400, 300);
	await page.mouse.move(2, 300);
	await page.waitForFunction(() => window.__floatSidebar.isOpen, null, { timeout: 2000 }).catch(() => { });
	await page.waitForTimeout(400); // slide-in transition
	let g2 = await geom(page);
	ok(g2.fs.open, 'mouse at the left edge opens it');
	ok(near(g2.ed.l, g.ed.l) && near(g2.ed.w, g.ed.w), 'editor does not move or resize when it opens', `w ${g.ed.w} -> ${g2.ed.w}`);
	ok(near(g2.side.l, g.fs.shift - g.side.w, 2) && near(g2.side.r, g.fs.shift, 2), 'side bar slides fully into view', `side ${g2.side.l}..${g2.side.r}`);
	const sw = sideWv(g2);
	ok(sw && sw.l >= g2.side.l - 1 && sw.r <= g2.side.r + 1, 'side bar webview moves with it', sw && `${sw.l}..${sw.r}`);
	const onTop = sw ? await topAt(page, sw.l + sw.w / 2, sw.t + 40) : 'none';
	ok(onTop.startsWith('iframe:') && Math.abs(+onTop.split(':')[1] - sw.w) <= 2, 'side bar webview is on top (visible, clickable)', onTop);

	// moving the mouse from the side bar into its own webview must not close it
	await page.mouse.move(g2.side.l + 20, g2.side.t + 10);
	await page.mouse.move(sw.l + sw.w / 2, sw.t + 80, { steps: 3 });
	await page.waitForTimeout(700);
	ok((await geom(page)).fs.open, 'mouse inside the side bar webview keeps it open');
	await page.mouse.click(sw.l + sw.w / 2, sw.t + 80); // focus moves into the side bar webview
	await page.waitForTimeout(500);
	ok((await geom(page)).fs.open, 'clicking into the side bar webview keeps it open');
	ok(near(g2.wv.map(w => w.w).sort((a, b) => b - a)[0], chatW), 'chat webview keeps its width');
	if (shots) { await page.screenshot({ path: `${shots}-933-open.png` }); }

	// leave → closes
	await page.mouse.move(g2.side.r - 20, 300);
	await page.mouse.move(g2.side.r + 200, 300, { steps: 4 });
	await page.waitForTimeout(700);
	g = await geom(page);
	ok(!g.fs.open, 'moving the mouse away closes it');
	const after = await topAt(page, 40, 300);
	ok((after.startsWith('iframe:') && Math.abs(+after.split(':')[1] - chatW) <= 2) || after === 'editor', 'after closing, the editor is on top again', after);

	// Ctrl+B toggles, Esc closes
	await page.mouse.click(g.ed.l + 200, g.status.t - 3 > 0 ? 50 : 50); // focus the workbench (tab bar)
	await page.keyboard.press('Control+b'); await page.waitForTimeout(400);
	ok((await geom(page)).fs.open, 'Ctrl+B opens it (instead of hiding the side bar)');
	await page.keyboard.press('Control+b'); await page.waitForTimeout(400);
	g = await geom(page);
	ok(!g.fs.open && g.side && g.side.w > 0, 'Ctrl+B again closes it; side bar stays laid out');
	await page.keyboard.press('Control+b'); await page.waitForTimeout(300);
	await page.keyboard.press('Escape'); await page.waitForTimeout(400);
	ok(!(await geom(page)).fs.open, 'Esc closes it');

	// context menu inside the floating side bar
	await page.evaluate(() => window.__floatSidebar.open());
	await page.keyboard.press('Control+Shift+e'); await page.waitForTimeout(1200);
	const item = page.locator('.part.sidebar .monaco-list-row').first();
	const ib = await item.boundingBox().catch(() => null);
	if (ib) {
		await page.mouse.move(ib.x + 30, ib.y + ib.height / 2);
		await page.mouse.click(ib.x + 30, ib.y + ib.height / 2, { button: 'right' });
		await page.waitForTimeout(600);
		const mb = await page.locator('.context-view .monaco-menu').first().boundingBox().catch(() => null);
		ok(mb && mb.x >= 0 && mb.x + mb.width <= g.vw + 1 && Math.abs(mb.x - (ib.x + 30)) < 40, 'context menu opens next to the cursor, on screen', mb ? `menu.x=${Math.round(mb.x)} cursor=${Math.round(ib.x + 30)}` : 'no menu');
		ok((await geom(page)).fs.open, 'side bar stays open while its context menu is shown');
		if (shots) { await page.screenshot({ path: `${shots}-933-menu.png` }); }
		await page.keyboard.press('Escape'); await page.waitForTimeout(300);
	} else {
		ok(false, 'explorer row found for context-menu test');
	}
	await page.evaluate(() => window.__floatSidebar.close());

	// quick open is centred on the visible screen
	await page.keyboard.press('Control+p'); await page.waitForTimeout(700);
	const qb = await page.locator('.quick-input-widget').boundingBox().catch(() => null);
	ok(qb && near(qb.x + qb.width / 2, g.vw / 2, 12), 'Quick Open is centred on screen', qb ? `centre=${Math.round(qb.x + qb.width / 2)} vw/2=${g.vw / 2}` : 'not found');
	await page.keyboard.press('Escape');

	// dialogs are centred on screen
	await page.keyboard.press('F1'); await page.waitForTimeout(400);
	await page.keyboard.type('Help: About'); await page.waitForTimeout(600);
	await page.keyboard.press('Enter'); await page.waitForTimeout(900);
	const db = await page.locator('.monaco-dialog-box').boundingBox().catch(() => null);
	ok(db && near(db.x + db.width / 2, g.vw / 2, 12), 'dialogs are centred on screen', db ? `centre=${Math.round(db.x + db.width / 2)} vw/2=${g.vw / 2}` : 'no dialog');
	if (shots) { await page.screenshot({ path: `${shots}-933-dialog.png` }); }
	await page.keyboard.press('Escape'); await page.waitForTimeout(400);

	// switching off restores the normal layout
	await page.evaluate(() => window.__floatSidebar.setMode('off')); await page.waitForTimeout(1200);
	g = await geom(page);
	ok(!g.fs.floating && g.fs.shift === 0 && g.side.l >= 0 && near(g.ed.l, g.side.r, 2), 'mode off: normal docked layout', `side ${g.side.l}..${g.side.r} editor.left=${g.ed.l}`);
	ok(near((g.aux ? g.aux.r : g.ed.r), g.vw), 'mode off: workbench fits the screen');
	await page.evaluate(() => window.__floatSidebar.setMode('auto')); await page.waitForTimeout(1200);
	g = await geom(page);
	ok(g.fs.floating && near(g.ed.l, 0), 'back to auto: floating again');
	await page.setViewportSize({ width: 860, height: 954 }); await page.waitForTimeout(1200); // fold, portrait
	g = await geom(page);
	ok(g.fs.floating && near(g.ed.l, 0) && near((g.aux ? g.aux.r : g.ed.r), g.vw), 'window resize keeps the layout right (860x954)');
	if (shots) { await page.screenshot({ path: `${shots}-860-closed.png` }); }
	await ctx.close();
}

// ---------------------------------------------------------------- touch
{
	console.log(`\n# ${url} — 890x626 touch (iPhone-style)`);
	const { ctx, page } = await boot({ viewport: { width: 890, height: 626 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
	let g = await geom(page);
	ok(g.fs.floating, 'floating on a touch screen');
	const hb = await page.locator('.fs-handle').boundingBox().catch(() => null);
	ok(!!hb && hb.x === 0 && hb.width >= 16, 'edge handle is shown for touch', hb ? `${hb.width}x${hb.height}` : 'missing');
	if (hb) { await page.touchscreen.tap(hb.x + hb.width / 2, hb.y + hb.height / 2); }
	await page.waitForTimeout(500);
	g = await geom(page);
	ok(g.fs.open, 'tapping the handle opens it');
	if (shots) { await page.screenshot({ path: `${shots}-890-touch-open.png` }); }
	await page.touchscreen.tap(g.vw - 60, 200); // tap into the chat (iframe)
	await page.waitForTimeout(600);
	ok(!(await geom(page)).fs.open, 'tapping the chat closes it');
	await ctx.close();
}

// ---------------------------------------------------------------- big screen
{
	console.log(`\n# ${url} — 2560x1440 (31.5" 4K at 150%)`);
	const { ctx, page } = await boot({ viewport: { width: 2560, height: 1440 } });
	let g = await geom(page);
	ok(!g.fs.floating && g.side.l >= 0, 'auto mode keeps the side bar docked on a big screen');
	const btn = await page.locator('.fs-statusbar').textContent().catch(() => '');
	ok(/Float: auto \(off\)/.test(btn), 'status bar switch shows the mode', btn.trim());
	await page.locator('.fs-statusbar').click(); await page.waitForTimeout(1200); // auto -> on
	g = await geom(page);
	ok(g.fs.mode === 'on' && g.fs.floating && near(g.ed.l, 0), 'status bar switch: on floats it on a big screen too');
	const stored = await page.evaluate(() => localStorage.getItem('floatSidebar.mode'));
	ok(stored === 'on', 'mode is remembered per browser', stored);
	await page.locator('.fs-statusbar').click(); await page.waitForTimeout(1200); // on -> off
	g = await geom(page);
	ok(g.fs.mode === 'off' && !g.fs.floating, 'status bar switch: off');
	await ctx.close();
}

await browser.close();
console.log(failed ? `\n${failed} check(s) FAILED` : '\nall checks passed');
process.exit(failed ? 1 : 0);
