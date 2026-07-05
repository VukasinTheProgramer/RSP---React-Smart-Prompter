import * as vscode from 'vscode';
import { detectContext, ProjectContext } from './context';
import { generateQuestions, expandPrompt, Question } from './gemini';

export class SmartPromptingViewProvider implements vscode.WebviewViewProvider {
	private pendingPrompt: string | null = null;
	private pendingContext: ProjectContext | null = null;
	private pendingQuestions: Question[] = [];

	resolveWebviewView(webviewView: vscode.WebviewView) {
		webviewView.webview.options = { enableScripts: true };
		webviewView.webview.html = this.getHtml(webviewView.webview);
		const webview = webviewView.webview;

		webview.onDidReceiveMessage((message) => {
			if (message.type === 'ready') {
				detectContext().then((ctx) => {
					webview.postMessage({ type: 'context', context: ctx });
				});
			}
			if (message.type === 'enhance') {
				this.handleEnhance(webview, message.prompt);
			}
			if (message.type === 'answers') {
				this.handleAnswers(webview, message.answers);
			}
			if (message.type === 'skip') {
				this.handleAnswers(webview, []);
			}
			if (message.type === 'reset') {
				this.pendingPrompt = null;
				this.pendingContext = null;
				this.pendingQuestions = [];
			}
		});
	}

	private async handleEnhance(webview: vscode.Webview, prompt: string) {
		try {
			const context = await detectContext();
			const maxQuestions = vscode.workspace.getConfiguration('smartprompting').get<number>('maxQuestions') ?? 3;
			const questions = await generateQuestions(context, prompt, maxQuestions);
			this.pendingPrompt = prompt;
			this.pendingContext = context;
			this.pendingQuestions = questions;

			if (questions.length === 0) {
				const text = await expandPrompt(context, prompt, []);
				webview.postMessage({ type: 'expanded', text });
			} else {
				webview.postMessage({ type: 'questions', questions });
			}
		} catch (err) {
			webview.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) });
		}
	}

	private async handleAnswers(webview: vscode.Webview, answers: string[]) {
		if (this.pendingPrompt === null) {return;}
		try {
			const qa = this.pendingQuestions.map((q, i) => ({ question: q.question, answer: answers[i] ?? '' }));
			const text = await expandPrompt(this.pendingContext, this.pendingPrompt, qa);
			webview.postMessage({ type: 'expanded', text });
		} catch (err) {
			webview.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) });
		}
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
	button { margin-top: 8px; margin-right: 4px; }
	select { width: 100%; margin-top: 4px; }
	#output { margin-top: 12px; white-space: pre-wrap; }
	#detected { opacity: 0.7; font-size: 0.9em; margin-bottom: 8px; }
	#error { color: var(--vscode-errorForeground); margin-top: 8px; }
	.question { margin-top: 8px; }
</style>
</head>
<body>
	<div id="detected">Detecting project...</div>
	<textarea id="prompt" placeholder="Rough prompt..."></textarea>
	<button id="enhance">Enhance</button>
	<button id="startOver">Start over</button>
	<div id="questions"></div>
	<div id="error"></div>
	<div id="output"></div>
	<script nonce="${nonce}">
		const vscode = acquireVsCodeApi();
		vscode.postMessage({ type: 'ready' });

		const enhanceBtn = document.getElementById('enhance');
		const startOverBtn = document.getElementById('startOver');
		const promptEl = document.getElementById('prompt');
		const questionsEl = document.getElementById('questions');
		const errorEl = document.getElementById('error');
		const outputEl = document.getElementById('output');

		enhanceBtn.addEventListener('click', () => {
			const prompt = promptEl.value;
			questionsEl.innerHTML = '';
			outputEl.innerHTML = '';
			errorEl.textContent = '';
			enhanceBtn.disabled = true;
			enhanceBtn.textContent = 'Thinking...';
			vscode.postMessage({ type: 'enhance', prompt });
		});

		startOverBtn.addEventListener('click', () => {
			promptEl.value = '';
			questionsEl.innerHTML = '';
			outputEl.innerHTML = '';
			errorEl.textContent = '';
			enhanceBtn.disabled = false;
			enhanceBtn.textContent = 'Enhance';
			vscode.postMessage({ type: 'reset' });
		});

		function renderQuestions(questions) {
			questionsEl.innerHTML = '';
			questions.forEach((q, i) => {
				const wrap = document.createElement('div');
				wrap.className = 'question';
				const label = document.createElement('label');
				label.textContent = q.question;
				const select = document.createElement('select');
				select.id = 'q' + i;
				q.options.forEach((opt) => {
					const option = document.createElement('option');
					option.value = opt;
					option.textContent = opt;
					select.appendChild(option);
				});
				wrap.appendChild(label);
				wrap.appendChild(select);
				questionsEl.appendChild(wrap);
			});
			const submit = document.createElement('button');
			submit.textContent = 'Submit answers';
			submit.addEventListener('click', () => {
				const answers = questions.map((_, i) => document.getElementById('q' + i).value);
				questionsEl.innerHTML = '';
				vscode.postMessage({ type: 'answers', answers });
			});
			const skip = document.createElement('button');
			skip.textContent = 'Skip questions';
			skip.addEventListener('click', () => {
				questionsEl.innerHTML = '';
				vscode.postMessage({ type: 'skip' });
			});
			questionsEl.appendChild(submit);
			questionsEl.appendChild(skip);
		}

		function renderOutput(text) {
			outputEl.innerHTML = '';
			const pre = document.createElement('div');
			pre.textContent = text;
			const copy = document.createElement('button');
			copy.textContent = 'Copy';
			copy.addEventListener('click', () => navigator.clipboard.writeText(text));
			outputEl.appendChild(pre);
			outputEl.appendChild(copy);
		}

		window.addEventListener('message', (event) => {
			if (event.data.type === 'context') {
				const c = event.data.context;
				const parts = c && c.react ? ['React ' + c.react] : ['No React detected'];
				if (c?.next) parts.push('Next ' + c.next);
				if (c?.router) parts.push(c.router);
				if (c?.state) parts.push(c.state);
				if (c?.styling) parts.push(c.styling);
				document.getElementById('detected').textContent = 'Detected: ' + parts.join(', ');
			}
			if (event.data.type === 'questions') {
				enhanceBtn.disabled = false;
				enhanceBtn.textContent = 'Enhance';
				renderQuestions(event.data.questions);
			}
			if (event.data.type === 'expanded') {
				enhanceBtn.disabled = false;
				enhanceBtn.textContent = 'Enhance';
				renderOutput(event.data.text);
			}
			if (event.data.type === 'error') {
				enhanceBtn.disabled = false;
				enhanceBtn.textContent = 'Enhance';
				errorEl.textContent = 'Error: ' + event.data.message;
			}
		});
	</script>
</body>
</html>`;
	}
}
