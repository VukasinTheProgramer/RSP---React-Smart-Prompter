// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "smartprompting" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('smartprompting.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from SmartPrompting!');
	});

	context.subscriptions.push(disposable);

	const provider = new SmartPromptingViewProvider();
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider('smartprompting.panel', provider)
	);
}

class SmartPromptingViewProvider implements vscode.WebviewViewProvider {
	resolveWebviewView(webviewView: vscode.WebviewView) {
		webviewView.webview.options = { enableScripts: true };
		webviewView.webview.html = this.getHtml(webviewView.webview);

		webviewView.webview.onDidReceiveMessage((message) => {
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
</style>
</head>
<body>
	<textarea id="prompt" placeholder="Rough prompt..."></textarea>
	<button id="enhance">Enhance</button>
	<div id="output"></div>
	<script nonce="${nonce}">
		const vscode = acquireVsCodeApi();
		document.getElementById('enhance').addEventListener('click', () => {
			const prompt = document.getElementById('prompt').value;
			vscode.postMessage({ type: 'enhance', prompt });
		});
		window.addEventListener('message', (event) => {
			if (event.data.type === 'result') {
				document.getElementById('output').textContent = event.data.text;
			}
		});
	</script>
</body>
</html>`;
	}
}

// This method is called when your extension is deactivated
export function deactivate() {}
