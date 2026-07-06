import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { detectContext, ProjectContext } from '../context';
import { generateQuestions, expandPrompt, explainSuggestion, ensureApiKey, friendlyError, Question } from '../ai';
import { suggestLibraries } from '../recommendations';
import { HISTORY_KEY, LAST_PROMPT_KEY, LAST_OUTPUT_KEY, MAX_HISTORY } from '../constants';

interface HistoryEntry {
	prompt: string;
	output: string;
}

export class SmartPromptingViewProvider implements vscode.WebviewViewProvider {
	private pendingPrompt: string | null = null;
	private pendingContext: ProjectContext | null = null;
	private pendingQuestions: Question[] = [];
	private chosenLibraries: string[] = [];
	private pickedFiles: string[] = [];

	constructor(private readonly state: vscode.Memento, private readonly extensionUri: vscode.Uri) {}

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
					pickedFiles: this.pickedFiles.map((f) => path.basename(f)),
				});
				detectContext().then((ctx) => {
					webview.postMessage({ type: 'context', context: ctx });
				});
			}
			if (message.type === 'suggest') {
				this.handleSuggest(webview);
			}
			if (message.type === 'explainSuggestion') {
				this.handleExplainSuggestion(webview, message.category, message.package, message.note);
			}
			if (message.type === 'chooseLibraries') {
				this.chosenLibraries = Array.isArray(message.libraries) ? message.libraries : [];
			}
			if (message.type === 'pickFiles') {
				this.handlePickFiles(webview);
			}
			if (message.type === 'removeFile') {
				if (typeof message.index === 'number') {this.pickedFiles.splice(message.index, 1);}
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
				this.pickedFiles = [];
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

	private async handlePickFiles(webview: vscode.Webview) {
		const files = await vscode.workspace.findFiles('**/*.{ts,tsx,js,jsx}', '**/node_modules/**', 500);
		const items = files.map((f) => ({ label: path.basename(f.fsPath), description: vscode.workspace.asRelativePath(f), fsPath: f.fsPath }));
		const picked = await vscode.window.showQuickPick(items, { canPickMany: true, placeHolder: 'Pick related files for cross-file refactor context' });
		if (!picked) {return;}
		for (const item of picked) {
			if (!this.pickedFiles.includes(item.fsPath)) {this.pickedFiles.push(item.fsPath);}
		}
		webview.postMessage({ type: 'pickedFiles', files: this.pickedFiles.map((f) => path.basename(f)) });
	}

	private async handleExplainSuggestion(webview: vscode.Webview, category: string, pkg: string, note: string) {
		try {
			if (!(await ensureApiKey())) {
				webview.postMessage({ type: 'error', message: 'An API key is required to use SmartPrompting.' });
				return;
			}
			const context = await detectContext(this.pickedFiles);
			const text = await explainSuggestion(context, category, pkg, note);
			webview.postMessage({ type: 'suggestionExplanation', category, package: pkg, text });
		} catch (err) {
			webview.postMessage({ type: 'error', message: friendlyError(err) });
		}
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
			const context = await detectContext(this.pickedFiles);
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
		const htmlPath = vscode.Uri.joinPath(this.extensionUri, 'media', 'webview.html');
		const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'webview.css'));
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'webview.js'));
		const html = fs.readFileSync(htmlPath.fsPath, 'utf8');
		return html
			.replaceAll('__CSP_SOURCE__', webview.cspSource)
			.replaceAll('__STYLE_URI__', styleUri.toString())
			.replaceAll('__SCRIPT_URI__', scriptUri.toString());
	}
}
