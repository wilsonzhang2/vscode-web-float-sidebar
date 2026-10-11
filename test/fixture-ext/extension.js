// Test fixture: a webview in the side bar (like Claude's session list) and a webview panel in
// the editor area (like the Claude chat), so layout can be checked from the outside.
const vscode = require('vscode');
const page = (title, n) => `<!doctype html><html><body style="margin:0;font:13px sans-serif">
<h3 id="t" style="margin:8px">${title}</h3>
${Array.from({ length: n }, (_, i) => `<p style="margin:4px 8px">${title} line ${i + 1} — the quick brown fox jumps over the lazy dog</p>`).join('')}
</body></html>`;
exports.activate = async (ctx) => {
  ctx.subscriptions.push(vscode.window.registerWebviewViewProvider('fsFixture.side', {
    resolveWebviewView(v) { v.webview.html = page('SIDE-WEBVIEW', 30); }
  }));
  const p = vscode.window.createWebviewPanel('fsChat', 'Chat stand-in', vscode.ViewColumn.One, {});
  p.webview.html = page('CHAT-WEBVIEW', 80);
  await vscode.commands.executeCommand('workbench.view.extension.fsFixture');
};
