import * as vscode from 'vscode';
import { detectContext } from '../context';
import { expandPrompt, ensureApiKey, friendlyError } from '../ai';

// Chat is a linear conversation, so the participant runs the direct-expansion
// path (no interactive clarifying questions — the sidebar panel keeps those).
async function handler(
	request: vscode.ChatRequest,
	_context: vscode.ChatContext,
	stream: vscode.ChatResponseStream,
	_token: vscode.CancellationToken
): Promise<void> {
	const prompt = request.prompt.trim();
	if (!prompt) {
		stream.markdown('Type a rough prompt after `@smartprompt`, e.g. `@smartprompt add a login form`.');
		return;
	}

	if (!(await ensureApiKey())) {
		stream.markdown('An API key is required. Run **SmartPrompting: Set API Key** from the Command Palette.');
		return;
	}

	stream.progress('Detecting your stack and expanding the prompt…');
	try {
		const context = await detectContext();
		const expanded = await expandPrompt(context, prompt, []);
		stream.markdown(expanded);
	} catch (err) {
		stream.markdown(`**Error:** ${friendlyError(err)}`);
	}
}

export function registerChatParticipant(context: vscode.ExtensionContext): void {
	// vscode.chat is unavailable in editors without the chat API — guard so
	// activation doesn't throw there.
	if (!vscode.chat?.createChatParticipant) {
		return;
	}
	const participant = vscode.chat.createChatParticipant('smartprompting.chat', handler);
	context.subscriptions.push(participant);
}
