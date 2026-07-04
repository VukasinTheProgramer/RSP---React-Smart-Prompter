import * as vscode from 'vscode';
import { detectContext } from './context';

export class SmartPromptingViewProvider implements vscode.WebviewViewProvider {
	resolveWebviewView(webviewView: vscode.WebviewView) {
		webviewView.webview.options = { enableScripts: true };
		webviewView.webview.html = this.getHtml(webviewView.webview);

		webviewView.webview.onDidReceiveMessage((message) => {
			if (message.type === 'ready') {
				detectContext().then((ctx) => {
					webviewView.webview.postMessage({ type: 'context', context: ctx });
				});
			}
			if (message.type === 'enhance') {
				webviewView.webview.postMessage({ type: 'result', text: message.prompt });
			}
		});
	}

	private getHtml(webview: vscode.Webview): string {
		const nonce = String(Date.now());
		return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
<style>
	body { font-family: var(--vscode-font-family); padding: 8px; }
	textarea { width: 100%; box-sizing: border-box; min-height: 80px; }
	button { margin-top: 8px; }
	#output { margin-top: 12px; white-space: pre-wrap; }
	#detected { opacity: 0.7; font-size: 0.9em; margin-bottom: 8px; }
</style>
</head>
<body>
	<div id="detected">Detecting project...</div>
	<textarea id="prompt" placeholder="Rough prompt..."></textarea>
	<button id="enhance">Enhance</button>
	<div id="output"></div>
	<script nonce="${nonce}">
		const vscode = acquireVsCodeApi();
		vscode.postMessage({ type: 'ready' });
		document.getElementById('enhance').addEventListener('click', () => {
			const prompt = document.getElementById('prompt').value;
			vscode.postMessage({ type: 'enhance', prompt });
		});
		window.addEventListener('message', (event) => {
			if (event.data.type === 'result') {
				document.getElementById('output').textContent = event.data.text;
			}
			if (event.data.type === 'context') {
				const c = event.data.context;
				const parts = c && c.react ? ['React ' + c.react] : ['No React detected'];
				if (c?.next) parts.push('Next ' + c.next);
				if (c?.router) parts.push(c.router);
				if (c?.state) parts.push(c.state);
				if (c?.styling) parts.push(c.styling);
				document.getElementById('detected').textContent = 'Detected: ' + parts.join(', ');
			}
		});
	</script>
</body>
</html>`;
	}
}
