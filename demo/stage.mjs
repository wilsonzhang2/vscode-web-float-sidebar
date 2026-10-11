// Render the static layers for the square (1080x1080) Moments video.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const D = process.argv[2], F = process.env.FONT_DIR || new URL('./demo-ext/fonts', import.meta.url).pathname;
const exe = `${process.env.HOME}/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell`;
const font = `@font-face{font-family:SHS;src:url(file://${F}/SourceHanSansCN-Regular.woff2);font-weight:400}
@font-face{font-family:SHS;src:url(file://${F}/SourceHanSansCN-Medium.woff2);font-weight:500}
@font-face{font-family:SHS;src:url(file://${F}/SourceHanSansCN-Bold.woff2);font-weight:700}
html,body{margin:0;width:1080px;height:1080px;font-family:SHS,sans-serif}`;
// phone: screen 980x690 at (50,266); body = screen + 16px bezel
const SX = 50, SY = 266, SW = 980, SH = 690, BZ = 16;
const pages = {
	bg: `<body style="background:linear-gradient(180deg,#eef1f5,#e2e7ee)">
 <div style="position:absolute;left:${SX - BZ}px;top:${SY - BZ}px;width:${SW + 2 * BZ}px;height:${SH + 2 * BZ}px;border-radius:44px;background:#16181c;box-shadow:0 30px 60px rgba(20,30,50,.28),0 0 0 2px #3a3f47 inset"></div>
 <div style="position:absolute;left:${SX}px;top:${SY}px;width:${SW}px;height:${SH}px;border-radius:30px;background:#000"></div>
 <div style="position:absolute;left:0;right:0;top:${SY + SH + BZ + 30}px;text-align:center;font-size:24px;color:#6a7280;letter-spacing:.02em">iPhone Duo 内屏 7.6″ · 890×626 pt · code-server 全屏</div></body>`,
	crease: `<body style="background:transparent"><div style="position:absolute;left:${SX + SW / 2 - 1}px;top:${SY}px;width:2px;height:${SH}px;background:linear-gradient(90deg,rgba(0,0,0,.05),rgba(255,255,255,.18),rgba(0,0,0,.05))"></div>
 <div style="position:absolute;left:${SX}px;top:${SY}px;width:${SW}px;height:${SH}px;border-radius:30px;box-shadow:0 0 0 30px #16181c"></div></body>`,
	end: `<body style="background:linear-gradient(180deg,#eef1f5,#e2e7ee);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px;color:#1d2330">
 <div style="font-size:30px;color:#A32638;font-weight:500;letter-spacing:.08em">FLOAT SIDEBAR</div>
 <div style="font-size:64px;font-weight:700">浏览器版 VS Code 浮动侧栏</div>
 <div style="font-size:32px;color:#4b5462">侧栏浮在上面弹出，不挤压正在写的内容</div>
 <div style="margin-top:28px;font-size:28px;color:#1d2330;background:#fff;border-radius:14px;padding:16px 28px;box-shadow:0 6px 20px rgba(20,30,50,.08);font-family:ui-monospace,Menlo,monospace">github.com/wilsonzhang2/vscode-web-float-sidebar</div>
 <div style="font-size:24px;color:#6a7280">支持 code-server / openvscode-server · MIT 开源</div></body>`
};
const caps = [
	['iPhone Duo 展开，全屏写代码', 'Claude 和 Codex 并排，占满整块屏'],
	['点左边缘 → 侧栏浮出', '盖在上面，下面两栏一动不动'],
	['点别处 → 收起', '两栏的宽度一个像素都没变'],
	['对比：普通侧栏', '一打开就把 Claude 挤窄、重新折行'],
	['Float on：侧栏要用才出来', '折叠屏、平板、小窗口都适用']
];
caps.forEach(([t, s], i) => {
	pages['cap' + i] = `<body style="background:transparent">
 <div style="position:absolute;left:0;right:0;top:64px;text-align:center;font-size:58px;font-weight:700;color:#1d2330">${t}</div>
 <div style="position:absolute;left:0;right:0;top:152px;text-align:center;font-size:32px;color:#4b5462">${s}</div></body>`;
});
const b = await chromium.launch({ executablePath: exe });
const p = await b.newPage({ viewport: { width: 1080, height: 1080 } });
for (const [name, body] of Object.entries(pages)) {
	const file = `${D}/stage-${name}.html`;
	fs.writeFileSync(file, `<!doctype html><html><head><meta charset="utf-8"><style>${font}</style></head>${body}</html>`);
	await p.goto('file://' + file);
	await p.evaluate(() => document.fonts.ready);
	const ok = await p.evaluate(async () => { for (const w of [400, 500, 700]) { await document.fonts.load(w + ' 40px SHS', '浮动'); } await document.fonts.ready; return document.fonts.check('700 40px SHS', '浮动') && document.fonts.check('400 40px SHS', '浮动'); });
	if (!ok) { throw new Error('font not loaded for ' + name); }
	await p.waitForTimeout(150);
	await p.screenshot({ path: `${D}/${name}.png`, omitBackground: name !== 'bg' && name !== 'end' });
}
await b.close();
console.log('rendered', Object.keys(pages).length);
