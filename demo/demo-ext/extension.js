// Demo panels that imitate the owner's Claude Code / Codex layout (for a screen recording only).
const vscode = require('vscode');

function fontCss(webview, ext) {
	const u = (f) => webview.asWebviewUri(vscode.Uri.joinPath(ext, 'fonts', f));
	return `@font-face{font-family:SHS;src:url(${u('SourceHanSansCN-Regular.woff2')}) format("woff2");font-weight:400}
@font-face{font-family:SHS;src:url(${u('SourceHanSansCN-Medium.woff2')}) format("woff2");font-weight:500}
@font-face{font-family:SHS;src:url(${u('SourceHanSansCN-Bold.woff2')}) format("woff2");font-weight:700}
html,body{margin:0;height:100%;font-family:SHS,system-ui,sans-serif;color:#1f1f1f;background:#fff}
*{box-sizing:border-box}`;
}
const page = (webview, ext, css, body) => `<!doctype html><html><head><meta charset="utf-8"><style>${fontCss(webview, ext)}${css}</style></head><body>${body}</body></html>`;

const CLAUDE_CSS = `
body{display:flex;flex-direction:column;font-size:15px;line-height:1.65}
.top{height:44px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;flex:none;color:#2b2b2b}
.top b{color:#d97757;margin-right:6px}
.msgs{flex:1;overflow:hidden;padding:4px 18px 8px;display:flex;flex-direction:column;gap:10px}
.me{border:1px solid #e3e3e6;border-radius:8px;padding:8px 10px;color:#A32638;font-weight:500;background:#fbfbfc}
.tool{font-family:ui-monospace,Menlo,monospace;font-size:12.5px;color:#6b6b6b;border-left:2px solid #e3e3e6;padding-left:8px;line-height:1.5}
.ok{color:#2f7d4f}
p{margin:0}
ul{margin:0;padding-left:20px}
.inp{flex:none;margin:6px 10px 10px;border:2px solid #d1435b;border-radius:10px;padding:10px 12px 8px;color:#9a9a9a;font-size:14px}
.inp .bar{display:flex;align-items:center;gap:8px;margin-top:10px;color:#555;font-size:12px}
.chip{background:#efeff1;border-radius:6px;padding:1px 8px}
.send{margin-left:auto;width:24px;height:24px;border-radius:6px;background:#e8a0ab}
`;
const CLAUDE_BODY = `
<div class="top"><b>✳</b>Claude Code</div>
<div class="msgs">
 <div class="me">装到我自己的 code-server 上</div>
 <p>按规矩来：检查锁 → 建锁 → 备份 → 安装 → 验证 → 记录 → 删锁。</p>
 <div class="tool">Bash&nbsp; sudo ./float-sidebar.sh install /usr/lib/code-server<br><span class="ok">installed v0.1.0</span></div>
 <p>已经装好，不用重启。刷新页面后，状态栏右边会出现 <b>Float: auto</b>。</p>
 <div class="me">模拟 iPhone Duo 上的全屏效果</div>
 <p>iPhone Duo 内屏 7.6 寸，展开后 890×626 pt。Claude 和 Codex 并排时每栏约 445 pt：</p>
 <ul><li>侧栏平时停在屏幕外，两栏占满全宽</li><li>点左边缘的把手，侧栏浮在上面滑出</li><li>点别处收起，两栏一个像素都不动</li></ul>
</div>
<div class="inp">ctrl esc to focus or unfocus Claude<div class="bar">＋ <span class="chip">Opus 5.5 Medium</span><span class="send"></span></div></div>`;

const CODEX_CSS = `
body{display:flex;flex-direction:column;padding:10px 14px;font-size:15px}
.h{font-size:11px;letter-spacing:.06em;color:#6b6b6b}
.t{font-size:17px;margin:12px 0 6px;color:#333}
.it{display:flex;justify-content:space-between;gap:8px;line-height:34px;color:#2f6fd0;white-space:nowrap}
.it span:first-child{overflow:hidden;text-overflow:ellipsis}
.it span:last-child{color:#8a8a8a;font-size:13px}
.box{margin-top:auto;border:1px solid #e3e3e6;border-radius:14px;padding:12px;color:#9a9a9a;height:96px;font-size:14px;display:flex;flex-direction:column}
.box .bar{margin-top:auto;display:flex;gap:10px;color:#555;font-size:12px;align-items:center}
.box .go{margin-left:auto;width:26px;height:26px;border-radius:50%;background:#bbb}
`;
const CODEX_BODY = `
<div class="t">Chats</div>
${[['评估网页PWA模式', '3h'], ['完善 Opus 项目文档', '13h'], ['查询新疆西藏自驾路线开放时间', '22h'], ['评估后备运维接手能力', '23h'], ['Check usage', '23h'], ['推荐屏幕阅读配色与字体', '1d'], ['识别当前对话类型', '2d'], ['检查服务器VM连通性', '2d']]
		.map(([a, b]) => `<div class="it"><span>${a}</span><span>${b}</span></div>`).join('')}
<div class="box">Do anything<div class="bar">＋ Approve for me<span class="go"></span></div></div>`;

const SESS_CSS = `
body{padding:6px 12px;font-size:13.5px;background:#f8f8f9}
.h{font-size:11px;letter-spacing:.06em;color:#6b6b6b;margin:10px 0 4px}
.row{display:flex;justify-content:space-between;line-height:28px}
.bar{height:4px;border-radius:2px;background:#e5e5e8;margin:0 0 6px}
.bar i{display:block;height:4px;border-radius:2px;background:#2f6fd0}
.new{line-height:30px;color:#333}
.g{display:flex;justify-content:space-between;line-height:30px;color:#333}
.n{background:#2f6fd0;color:#fff;border-radius:9px;font-size:11px;min-width:18px;height:18px;line-height:18px;text-align:center;margin-top:6px}
.s{display:flex;justify-content:space-between;line-height:30px;padding:0 6px;border-radius:6px;white-space:nowrap}
.s span:first-child{overflow:hidden;text-overflow:ellipsis}
.s span:last-child{color:#8a8a8a;font-size:12px;margin-left:6px}
.s.on{background:#e6e6ea;font-weight:500}
`;
const SESS_BODY = `
<div class="h">ACCOUNT &amp; USAGE</div>
<div class="row"><span>Session (5hr)</span><span>21%</span></div><div class="bar"><i style="width:21%"></i></div>
<div class="row"><span>Weekly (7 day)</span><span>70%</span></div><div class="bar"><i style="width:70%"></i></div>
<div class="h">SESSION MANAGER</div>
<div class="new">＋ New session</div>
<div class="g"><span>› PVE服务器运维</span><span class="n">3</span></div>
<div class="g"><span>› 硬件</span><span class="n">1</span></div>
<div class="g"><span>› VM虚拟机</span><span class="n">4</span></div>
<div class="g"><span>› VPS</span><span class="n">1</span></div>
<div class="g"><span>⌄ Ungrouped</span><span class="n">5</span></div>
<div class="s on"><span>浮动侧栏开源项目</span><span>now</span></div>
<div class="s"><span>Dell U3225与Fold8屏幕布局</span><span>2h</span></div>
<div class="s"><span>code-server是什么产品</span><span>5h</span></div>
<div class="s"><span>PVE虚拟机每日运行状态</span><span>18h</span></div>
<div class="s"><span>网络配置0929</span><span>2d</span></div>`;

exports.activate = async (ctx) => {
	const ext = ctx.extensionUri;
	const opts = { enableScripts: false, localResourceRoots: [ext] };
	const view = (css, body) => ({ resolveWebviewView(v) { v.webview.options = opts; v.webview.html = page(v.webview, ext, css, body); } });
	ctx.subscriptions.push(vscode.window.registerWebviewViewProvider('demo.sessions', view(SESS_CSS, SESS_BODY)));
	ctx.subscriptions.push(vscode.window.registerWebviewViewProvider('demo.codex', view(CODEX_CSS, CODEX_BODY)));
	const p = vscode.window.createWebviewPanel('demoClaude', 'Claude Code', vscode.ViewColumn.One, opts);
	p.iconPath = vscode.Uri.joinPath(ext, 'icon.svg');
	p.webview.html = page(p.webview, ext, CLAUDE_CSS, CLAUDE_BODY);
	await vscode.commands.executeCommand('workbench.view.extension.demoClaude');
	await vscode.commands.executeCommand('workbench.view.extension.demoCodex');
	await vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
};
