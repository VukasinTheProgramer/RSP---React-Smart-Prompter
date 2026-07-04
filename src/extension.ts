// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';

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

interface ProjectContext {
	isReactFile: boolean;
	activeFileName: string | null;
	react: string | null;
	next: string | null;
	router: string | null;
	state: string | null;
	styling: string | null;
	dataFetching: string | null;
	forms: string | null;
}

const LIB_GROUPS: Record<'router' | 'state' | 'styling' | 'dataFetching' | 'forms', string[]> = {
	router: ['react-router-dom'],
	state: ['@reduxjs/toolkit', 'redux', 'zustand', 'jotai', 'recoil'],
	styling: ['tailwindcss', 'styled-components', '@emotion/react', 'sass'],
	dataFetching: ['@tanstack/react-query', 'swr', 'axios'],
	forms: ['react-hook-form', 'formik'],
};

function cleanVersion(v: string): string {
	return v.replace(/^[\^~]/, '');
}

function pickLib(deps: Record<string, string>, names: string[]): string | null {
	for (const name of names) {
		if (deps[name]) {
			return `${name}@${cleanVersion(deps[name])}`;
		}
	}
	return null;
}

function hasReact(pkg: Record<string, unknown>): boolean {
	const deps = pkg as { dependencies?: Record<string, string>; devDependencies?: Record<string, string>; peerDependencies?: Record<string, string> };
	return Boolean(deps.dependencies?.react || deps.devDependencies?.react || deps.peerDependencies?.react);
}

function closestTo(activeFilePath: string, files: vscode.Uri[]): vscode.Uri {
	const byDepth = [...files].sort((a, b) => b.fsPath.length - a.fsPath.length);
	return byDepth.find((f) => activeFilePath.startsWith(path.dirname(f.fsPath) + path.sep)) ?? files[0];
}

async function pickPackageJson(activeFilePath: string | null): Promise<vscode.Uri | null> {
	const files = await vscode.workspace.findFiles('**/package.json', '**/node_modules/**', 200);
	if (files.length === 0) {
		return null;
	}
	if (files.length === 1) {
		return files[0];
	}

	// Monorepo/fullstack case: search every package.json for one that actually
	// declares react. Break ties by picking whichever is closest to the file
	// the user has open.
	const reactCandidates: vscode.Uri[] = [];
	for (const file of files) {
		const raw = await vscode.workspace.fs.readFile(file);
		const pkg = JSON.parse(Buffer.from(raw).toString('utf8'));
		if (hasReact(pkg)) {
			reactCandidates.push(file);
		}
	}

	if (reactCandidates.length > 0) {
		return activeFilePath ? closestTo(activeFilePath, reactCandidates) : reactCandidates[0];
	}

	return activeFilePath ? closestTo(activeFilePath, files) : files[0];
}

async function detectContext(): Promise<ProjectContext | null> {
	const editor = vscode.window.activeTextEditor;
	const activeFilePath = editor?.document.fileName ?? null;
	const activeFileName = activeFilePath ? activeFilePath.split('/').pop() ?? null : null;
	const isReactFile = editor?.document.languageId === 'javascriptreact'
		|| editor?.document.languageId === 'typescriptreact';

	const file = await pickPackageJson(activeFilePath);
	if (!file) {
		return { isReactFile, activeFileName, react: null, next: null, router: null, state: null, styling: null, dataFetching: null, forms: null };
	}

	const raw = await vscode.workspace.fs.readFile(file);
	const pkg = JSON.parse(Buffer.from(raw).toString('utf8'));
	const deps: Record<string, string> = { ...pkg.peerDependencies, ...pkg.devDependencies, ...pkg.dependencies };

	return {
		isReactFile,
		activeFileName,
		react: deps.react ? cleanVersion(deps.react) : null,
		next: deps.next ? cleanVersion(deps.next) : null,
		router: pickLib(deps, LIB_GROUPS.router),
		state: pickLib(deps, LIB_GROUPS.state),
		styling: pickLib(deps, LIB_GROUPS.styling),
		dataFetching: pickLib(deps, LIB_GROUPS.dataFetching),
		forms: pickLib(deps, LIB_GROUPS.forms),
	};
}

class SmartPromptingViewProvider implements vscode.WebviewViewProvider {
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

// This method is called when your extension is deactivated
export function deactivate() {}
