import * as vscode from 'vscode';
import { ProjectContext } from '../context';
import { fetchDocGrounding } from '../docGrounding';
import { Question, QaPair } from './providers/types';
import * as gemini from './providers/gemini';
import * as openai from './providers/openai';
import * as anthropic from './providers/anthropic';
import { ProviderName, DEFAULT_MODELS, ENV_VARS, LABELS, KEY_URLS } from '../constants';

const PROVIDERS: Record<ProviderName, typeof gemini> = { gemini, openai, anthropic };

function config() {
	return vscode.workspace.getConfiguration('smartprompting');
}

function getProvider(): ProviderName {
	const value = config().get<string>('provider');
	return value === 'openai' || value === 'anthropic' ? value : 'gemini';
}

function getModel(provider: ProviderName): string {
	return config().get<string>('model') || DEFAULT_MODELS[provider];
}

function getConfiguredApiKey(): string | undefined {
	return config().get<string>('apiKey') || undefined;
}

function hasEnvKey(provider: ProviderName): boolean {
	return ENV_VARS[provider].some((name) => Boolean(process.env[name]));
}

/**
 * If no key is configured and no matching environment variable is set, prompts
 * the user for one and saves it to global settings. Returns false if the user
 * cancels — callers should bail out and surface that to the UI.
 */
export async function ensureApiKey(): Promise<boolean> {
	if (getConfiguredApiKey() || hasEnvKey(getProvider())) {
		return true;
	}

	const provider = getProvider();
	const key = await vscode.window.showInputBox({
		title: `SmartPrompting needs a ${LABELS[provider]} API key`,
		prompt: `Get a free key at ${KEY_URLS[provider]}`,
		password: true,
		ignoreFocusOut: true,
	});
	if (!key) {return false;}

	await config().update('apiKey', key, vscode.ConfigurationTarget.Global);
	return true;
}

export async function promptForApiKey(): Promise<void> {
	const provider = getProvider();
	const key = await vscode.window.showInputBox({
		title: `Set ${LABELS[provider]} API key`,
		prompt: `Get a free key at ${KEY_URLS[provider]}`,
		password: true,
		ignoreFocusOut: true,
	});
	if (!key) {return;}
	await config().update('apiKey', key, vscode.ConfigurationTarget.Global);
	vscode.window.showInformationMessage(`SmartPrompting: ${LABELS[provider]} API key saved.`);
}

// Gemini, OpenAI, and Anthropic's SDKs all throw an error object with a numeric
// `status` field for API-level failures, so one check covers all three providers.
export function friendlyError(err: unknown): string {
	const provider = getProvider();
	const label = LABELS[provider];
	const status = typeof err === 'object' && err !== null && 'status' in err ? (err as { status?: unknown }).status : undefined;

	if (status === 401 || status === 403) {
		return `Invalid or unauthorized ${label} API key. Run "SmartPrompting: Set API Key" to fix it.`;
	}
	if (status === 429) {
		return `${label} rate limit or quota exceeded. Wait a bit and try again, or check your plan/billing at ${KEY_URLS[provider]}.`;
	}
	if (typeof status === 'number' && status >= 500) {
		return `${label}'s API is temporarily unavailable (server error ${status}). Try again shortly.`;
	}
	if (err instanceof Error && /ENOTFOUND|ECONNREFUSED|ETIMEDOUT|fetch failed|network/i.test(err.message)) {
		return `Couldn't reach ${label}'s API. Check your internet connection.`;
	}
	return err instanceof Error ? err.message : String(err);
}

export async function generateQuestions(context: ProjectContext | null, prompt: string, maxQuestions: number, chosenLibraries: string[] = []): Promise<Question[]> {
	const provider = getProvider();
	return PROVIDERS[provider].generateQuestions(getConfiguredApiKey(), getModel(provider), context, prompt, maxQuestions, chosenLibraries);
}

export async function expandPrompt(context: ProjectContext | null, prompt: string, qa: QaPair[], chosenLibraries: string[] = []): Promise<string> {
	const provider = getProvider();
	const docs = config().get<boolean>('docGrounding') ? await fetchDocGrounding(context) : '';
	return PROVIDERS[provider].expandPrompt(getConfiguredApiKey(), getModel(provider), context, prompt, qa, chosenLibraries, docs);
}

export async function explainSuggestion(context: ProjectContext | null, category: string, pkg: string, note: string): Promise<string> {
	const provider = getProvider();
	return PROVIDERS[provider].explainSuggestion(getConfiguredApiKey(), getModel(provider), context, category, pkg, note);
}

export type { Question };
