// Record the iPhone Duo (890x626 pt) demo of the floating side bar against the demo instance.
// Run from this directory: node record.mjs <out-dir> <workspace-folder>  (needs the demo server, see make.sh)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const exe = `${process.env.HOME}/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell`;
const OUT = process.argv[2];
const W = 890, H = 626;
const URL_ = 'http://127.0.0.1:8093/?folder=' + encodeURIComponent(process.argv[3]);

const b = await chromium.launch({ executablePath: exe });
// 1) prepare layout once (Codex column ~ half width), stored in the profile
{
	const ctx = await b.newContext({ viewport: { width: W, height: H } });
	const p = await ctx.newPage();
	await p.addInitScript(() => localStorage.setItem('floatSidebar.mode', 'on'));
	await p.goto(URL_);
	await p.waitForFunction(() => document.querySelectorAll('iframe.webview').length >= 3, null, { timeout: 60000 });
	await p.waitForTimeout(3000);
	const aux = await p.locator('.part.auxiliarybar').boundingBox();
	await p.mouse.move(aux.x - 1, 300); await p.mouse.down();
	await p.mouse.move(W / 2 + 10, 300, { steps: 8 }); await p.mouse.up();
	await p.waitForTimeout(1500);
	console.log('aux width now', (await p.locator('.part.auxiliarybar').boundingBox()).width);
	await ctx.close();
}
// 2) record
const ctx = await b.newContext({
	viewport: { width: W, height: H }, deviceScaleFactor: 2, hasTouch: true, isMobile: true
});
const p = await ctx.newPage();
const tStart = Date.now();
await p.addInitScript(() => localStorage.setItem('floatSidebar.mode', 'on'));
await p.goto(URL_);
await p.waitForFunction(() => document.querySelectorAll('iframe.webview').length >= 3, null, { timeout: 60000 });
await p.waitForTimeout(4000);
// Slow-motion capture: CSS animations/transitions run at rate R, we take device-pixel screenshots
// continuously and map wall time back to real time (t * R). Screencast/recordVideo ignore DPR here.
const R = 0.2;
const cdp = await ctx.newCDPSession(p);
await cdp.send('Animation.enable');
await cdp.send('Animation.setPlaybackRate', { playbackRate: R });
const frames = [];
let fi = 0, shooting = true;
const shooter = (async () => {
	while (shooting) {
		const t = Date.now() / 1000;
		const name = `${OUT}/fr-${String(fi++).padStart(5, '0')}.jpg`;
		await p.screenshot({ path: name, type: 'jpeg', quality: 93 });
		frames.push({ name, ts: t });
	}
})();
const wait = (ms) => p.waitForTimeout(ms / R); // ms of real (demo) time
await p.waitForTimeout(300);
// touch marker (drawn in the page so it is in the recording)
await p.evaluate(() => {
	const st = document.createElement('style');
	st.textContent = `.tapdot{position:fixed;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;background:rgba(163,38,56,.35);border:2px solid rgba(163,38,56,.8);pointer-events:none;z-index:99999;animation:tap .7s ease-out forwards}
@keyframes tap{0%{transform:scale(.4);opacity:1}60%{transform:scale(1);opacity:.9}100%{transform:scale(1.25);opacity:0}}`;
	document.head.appendChild(st);
	window.__tap = (x, y) => { const d = document.createElement('div'); d.className = 'tapdot'; d.style.left = x + 'px'; d.style.top = y + 'px'; document.body.appendChild(d); setTimeout(() => d.remove(), 800 / 0.2); };
});
const marks = {};
const mark = (k) => { marks[k] = Date.now() / 1000; };
const tap = async (x, y, real = true) => { await p.evaluate(([x, y]) => window.__tap(x, y), [x, y]); await wait(180); if (real) { await p.touchscreen.tap(x, y); } };
const hb = await p.locator('.fs-handle').boundingBox();

mark('start');                       await wait(2200);
mark('open');                        await tap(hb.x + hb.width / 2, hb.y + hb.height / 2); await wait(2000);
mark('pick');                        await tap(150, 437, false); await wait(1300);
mark('close');                       await tap(620, 330); await wait(1900);
mark('compare');                     await p.evaluate(() => window.__floatSidebar.setMode('off')); await wait(2800);
mark('back');                        await p.evaluate(() => window.__floatSidebar.setMode('on')); await wait(1800);
mark('end');
shooting = false; await shooter;
const state = await p.evaluate(() => ({ mode: window.__floatSidebar.mode, floating: window.__floatSidebar.isFloating }));
await ctx.close();
// ffmpeg concat list with real frame durations, timeline starting at mark 'start'
const t0 = marks.start, tEnd = marks.end;
let list = '';
const fr = frames.filter(f => f.ts <= tEnd);
for (let i = 0; i < fr.length; i++) {
	const a = Math.max(fr[i].ts, t0), bnd = i + 1 < fr.length ? fr[i + 1].ts : tEnd;
	if (bnd <= t0) { continue; }
	list += `file '${fr[i].name}'\nduration ${((bnd - a) * R).toFixed(4)}\n`;
}
list += `file '${fr[fr.length - 1].name}'\n`;
fs.writeFileSync(OUT + '/frames.txt', list);
const rel = Object.fromEntries(Object.entries(marks).map(([k, v]) => [k, +((v - t0) * R).toFixed(3)]));
fs.writeFileSync(OUT + '/marks.json', JSON.stringify({ marks: rel, frames: frames.length, state }, null, 1));
console.log(JSON.stringify({ marks: rel, frames: frames.length, state }));
await b.close();
