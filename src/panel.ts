import * as vscode from 'vscode';
import { detectContext, ProjectContext } from './context';
import { generateQuestions, expandPrompt, ensureApiKey, friendlyError, Question } from './ai';
import { suggestLibraries } from './recommendations';

interface HistoryEntry {
	prompt: string;
	output: string;
}

const HISTORY_KEY = 'smartprompting.history';
const LAST_PROMPT_KEY = 'smartprompting.lastPrompt';
const LAST_OUTPUT_KEY = 'smartprompting.lastOutput';
const MAX_HISTORY = 10;

export class SmartPromptingViewProvider implements vscode.WebviewViewProvider {
	private pendingPrompt: string | null = null;
	private pendingContext: ProjectContext | null = null;
	private pendingQuestions: Question[] = [];
	private chosenLibraries: string[] = [];

	constructor(private readonly state: vscode.Memento) {}

	resolveWebviewView(webviewView: vscode.WebviewView) {
		webviewView.webview.options = { enableScripts: true };
		webviewView.webview.html = this.getHtml(webviewView.webview);
		const webview = webviewView.webview;

		webview.onDidReceiveMessage((message) => {
			if (message.type === 'ready') {
				webview.postMessage({
					type: 'restore',
					lastPrompt: this.state.get<string>(LAST_PROMPT_KEY, ''),
					lastOutput: this.state.get<string>(LAST_OUTPUT_KEY, ''),
					history: this.state.get<HistoryEntry[]>(HISTORY_KEY, []),
					// The webview's copy resets when the panel hides — resync ours so the
					// UI never silently diverges from what Enhance will actually use.
					chosenLibraries: this.chosenLibraries,
				});
				detectContext().then((ctx) => {
					webview.postMessage({ type: 'context', context: ctx });
				});
			}
			if (message.type === 'suggest') {
				this.handleSuggest(webview);
			}
			if (message.type === 'chooseLibraries') {
				this.chosenLibraries = Array.isArray(message.libraries) ? message.libraries : [];
			}
			if (message.type === 'enhance') {
				this.handleEnhance(webview, message.prompt, message.skipQuestions === true);
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
				this.chosenLibraries = [];
				// Clear the persisted prompt/output too, or a hidden-then-reopened
				// panel would resurrect what the user just cleared. History stays.
				this.state.update(LAST_PROMPT_KEY, undefined);
				this.state.update(LAST_OUTPUT_KEY, undefined);
			}
		});
	}

	private async saveResult(webview: vscode.Webview, prompt: string, output: string) {
		await this.state.update(LAST_PROMPT_KEY, prompt);
		await this.state.update(LAST_OUTPUT_KEY, output);
		const history = this.state.get<HistoryEntry[]>(HISTORY_KEY, []);
		const next = [{ prompt, output }, ...history.filter((h) => h.prompt !== prompt)].slice(0, MAX_HISTORY);
		await this.state.update(HISTORY_KEY, next);
		webview.postMessage({ type: 'expanded', text: output, history: next });
	}

	private async handleSuggest(webview: vscode.Webview) {
		const context = await detectContext();
		const suggestions = suggestLibraries(context);
		webview.postMessage({ type: 'suggestions', suggestions });
	}

	private async handleEnhance(webview: vscode.Webview, prompt: string, skipQuestions: boolean) {
		try {
			if (!(await ensureApiKey())) {
				webview.postMessage({ type: 'error', message: 'An API key is required to use SmartPrompting.' });
				return;
			}
			const context = await detectContext();
			const configured = vscode.workspace.getConfiguration('smartprompting').get<number>('maxQuestions') ?? 3;
			const maxQuestions = skipQuestions ? 0 : configured;
			const questions = await generateQuestions(context, prompt, maxQuestions, this.chosenLibraries);
			this.pendingPrompt = prompt;
			this.pendingContext = context;
			this.pendingQuestions = questions;

			if (questions.length === 0) {
				const text = await expandPrompt(context, prompt, [], this.chosenLibraries);
				await this.saveResult(webview, prompt, text);
			} else {
				webview.postMessage({ type: 'questions', questions });
			}
		} catch (err) {
			webview.postMessage({ type: 'error', message: friendlyError(err) });
		}
	}

	private async handleAnswers(webview: vscode.Webview, answers: string[]) {
		if (this.pendingPrompt === null) {return;}
		try {
			// Skip sends no answers — expand with no Q&A rather than fabricating
			// question/blank-answer pairs that would only confuse the model.
			const qa = answers.length > 0
				? this.pendingQuestions.map((q, i) => ({ question: q.question, answer: answers[i] ?? '' }))
				: [];
			const text = await expandPrompt(this.pendingContext, this.pendingPrompt, qa, this.chosenLibraries);
			await this.saveResult(webview, this.pendingPrompt, text);
		} catch (err) {
			webview.postMessage({ type: 'error', message: friendlyError(err) });
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
	#chosen { margin-top: 8px; font-size: 0.9em; opacity: 0.8; }
	.suggestion { margin-top: 8px; padding: 8px; border: 1px solid var(--vscode-panel-border); border-radius: 4px; }
	.suggestion .cat { text-transform: capitalize; opacity: 0.7; font-size: 0.85em; }
	.suggestion .pkg { font-weight: bold; }
	.suggestion .note { font-size: 0.9em; opacity: 0.85; margin: 2px 0; }
	.suggestion .pairs { font-size: 0.85em; opacity: 0.75; }
	.tier { font-size: 0.75em; padding: 1px 6px; border-radius: 8px; margin-left: 6px; }
	.tier-high { background: rgba(80, 200, 120, 0.25); }
	.tier-medium { background: rgba(230, 190, 80, 0.25); }
	.tier-low { background: rgba(200, 120, 120, 0.25); }
	#history { margin-top: 16px; border-top: 1px solid var(--vscode-panel-border); padding-top: 8px; }
	#history h4 { margin: 0 0 4px; font-size: 0.85em; opacity: 0.7; font-weight: normal; }
	.hist { font-size: 0.9em; padding: 4px 0; border-bottom: 1px solid var(--vscode-panel-border); }
	.hist .hp { opacity: 0.85; }
	.hist button { margin-top: 2px; }
</style>
</head>
<body>
	<div id="detected">Detecting project...</div>
	<textarea id="prompt" placeholder="Rough prompt..."></textarea>
	<button id="suggest">Suggest libraries</button>
	<button id="enhance">Enhance</button>
	<button id="expandDirect">Just expand</button>
	<button id="startOver">Start over</button>
	<div id="chosen"></div>
	<div id="suggestions"></div>
	<div id="questions"></div>
	<div id="error"></div>
	<div id="output"></div>
	<div id="history"></div>
	<script nonce="${nonce}">
		const vscode = acquireVsCodeApi();
		vscode.postMessage({ type: 'ready' });

		const suggestBtn = document.getElementById('suggest');
		const enhanceBtn = document.getElementById('enhance');
		const expandDirectBtn = document.getElementById('expandDirect');
		const startOverBtn = document.getElementById('startOver');
		const promptEl = document.getElementById('prompt');
		const suggestionsEl = document.getElementById('suggestions');
		const chosenEl = document.getElementById('chosen');
		const questionsEl = document.getElementById('questions');
		const errorEl = document.getElementById('error');
		const outputEl = document.getElementById('output');
		const historyEl = document.getElementById('history');

		let chosenLibraries = [];

		suggestBtn.addEventListener('click', () => {
			errorEl.textContent = '';
			vscode.postMessage({ type: 'suggest' });
		});

		function setThinking() {
			enhanceBtn.disabled = true;
			expandDirectBtn.disabled = true;
			enhanceBtn.textContent = 'Thinking...';
		}

		function runEnhance(skipQuestions) {
			const prompt = promptEl.value.trim();
			if (!prompt) {
				errorEl.textContent = 'Type a rough prompt first.';
				return;
			}
			questionsEl.innerHTML = '';
			outputEl.innerHTML = '';
			errorEl.textContent = '';
			setThinking();
			vscode.postMessage({ type: 'enhance', prompt, skipQuestions });
		}

		enhanceBtn.addEventListener('click', () => runEnhance(false));
		expandDirectBtn.addEventListener('click', () => runEnhance(true));

		startOverBtn.addEventListener('click', () => {
			promptEl.value = '';
			suggestionsEl.innerHTML = '';
			chosenEl.textContent = '';
			questionsEl.innerHTML = '';
			outputEl.innerHTML = '';
			errorEl.textContent = '';
			chosenLibraries = [];
			resetButtons();
			vscode.postMessage({ type: 'reset' });
		});

		function resetButtons() {
			enhanceBtn.disabled = false;
			expandDirectBtn.disabled = false;
			enhanceBtn.textContent = 'Enhance';
		}

		function renderHistory(history) {
			historyEl.innerHTML = '';
			if (!history || !history.length) return;
			const h = document.createElement('h4');
			h.textContent = 'Recent prompts';
			historyEl.appendChild(h);
			history.forEach((entry) => {
				const row = document.createElement('div');
				row.className = 'hist';
				const p = document.createElement('div');
				p.className = 'hp';
				p.textContent = entry.prompt;
				const copy = document.createElement('button');
				copy.textContent = 'Copy result';
				copy.addEventListener('click', () => navigator.clipboard.writeText(entry.output));
				const reuse = document.createElement('button');
				reuse.textContent = 'Reuse';
				reuse.addEventListener('click', () => {
					promptEl.value = entry.prompt;
					outputEl.innerHTML = '';
				});
				row.appendChild(p);
				row.appendChild(copy);
				row.appendChild(reuse);
				historyEl.appendChild(row);
			});
		}

		function renderChosen() {
			chosenEl.textContent = chosenLibraries.length
				? 'Chosen libraries: ' + chosenLibraries.join(', ')
				: '';
			vscode.postMessage({ type: 'chooseLibraries', libraries: chosenLibraries });
		}

		function addChosen(pkgs) {
			pkgs.forEach((p) => { if (!chosenLibraries.includes(p)) chosenLibraries.push(p); });
			renderChosen();
		}

		function renderSuggestions(suggestions) {
			suggestionsEl.innerHTML = '';
			if (!suggestions.length) {
				suggestionsEl.textContent = 'Your stack already covers the common categories — nothing to suggest.';
				return;
			}
			suggestions.forEach((s) => {
				let idx = 0; // which option in this category is currently shown
				const card = document.createElement('div');
				card.className = 'suggestion';

				function draw() {
					const opt = s.options[idx];
					card.innerHTML = '';

					const cat = document.createElement('div');
					cat.className = 'cat';
					cat.textContent = s.category;
					card.appendChild(cat);

					const pkg = document.createElement('span');
					pkg.className = 'pkg';
					pkg.textContent = opt.package;
					const tier = document.createElement('span');
					tier.className = 'tier tier-' + opt.tier;
					tier.textContent = opt.tier + ' compat';
					const pkgLine = document.createElement('div');
					pkgLine.appendChild(pkg);
					pkgLine.appendChild(tier);
					card.appendChild(pkgLine);

					const note = document.createElement('div');
					note.className = 'note';
					note.textContent = opt.note;
					card.appendChild(note);

					if (opt.pairsWith && opt.pairsWith.length) {
						const pairs = document.createElement('div');
						pairs.className = 'pairs';
						pairs.textContent = 'Works great with: ' + opt.pairsWith.join(', ');
						card.appendChild(pairs);
					}

					const accept = document.createElement('button');
					accept.textContent = 'Use this';
					accept.addEventListener('click', () => {
						addChosen([opt.package].concat(opt.pairsWith || []));
						card.remove();
					});

					const other = document.createElement('button');
					other.textContent = idx + 1 < s.options.length ? 'Suggest another' : 'No good option';
					other.addEventListener('click', () => {
						if (idx + 1 < s.options.length) { idx++; draw(); }
						else { card.remove(); } // out of options — skip category
					});

					card.appendChild(accept);
					card.appendChild(other);
				}

				draw();
				suggestionsEl.appendChild(card);
			});
		}

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
				setThinking();
				vscode.postMessage({ type: 'answers', answers });
			});
			const skip = document.createElement('button');
			skip.textContent = 'Skip questions';
			skip.addEventListener('click', () => {
				questionsEl.innerHTML = '';
				setThinking();
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
			if (event.data.type === 'restore') {
				if (event.data.lastPrompt) promptEl.value = event.data.lastPrompt;
				if (event.data.lastOutput) renderOutput(event.data.lastOutput);
				if (Array.isArray(event.data.chosenLibraries) && event.data.chosenLibraries.length) {
					chosenLibraries = event.data.chosenLibraries;
					renderChosen();
				}
				renderHistory(event.data.history);
			}
			if (event.data.type === 'context') {
				const c = event.data.context;
				const parts = c && c.react ? ['React ' + c.react] : ['No React detected'];
				if (c?.next) parts.push('Next ' + c.next + (c.nextRouter === 'app' ? ' (App Router)' : c.nextRouter === 'pages' ? ' (Pages Router)' : ''));
				const categories = ['router', 'state', 'styling', 'dataFetching', 'forms', 'uiKit', 'icons', 'testing', 'animation', 'tables', 'validation', 'auth', 'i18n', 'dates', 'charts', 'dragDrop', 'notifications', 'buildTool', 'backend'];
				categories.forEach((key) => { if (c?.[key]) parts.push(c[key]); });
				if (c?.selectedCode) parts.push('+ selected code');
				document.getElementById('detected').textContent = 'Detected: ' + parts.join(', ');
			}
			if (event.data.type === 'suggestions') {
				renderSuggestions(event.data.suggestions);
			}
			if (event.data.type === 'questions') {
				resetButtons();
				renderQuestions(event.data.questions);
			}
			if (event.data.type === 'expanded') {
				resetButtons();
				renderOutput(event.data.text);
				renderHistory(event.data.history);
			}
			if (event.data.type === 'error') {
				resetButtons();
				errorEl.textContent = 'Error: ' + event.data.message;
			}
		});
	</script>
</body>
</html>`;
	}
}
