import { LibCategory } from '../libGroups';

// context.ts — caps on what gets sent to the AI as context, so a huge
// selection/import list/file set doesn't blow up the API call's token cost.
export const MAX_SELECTED_CODE_CHARS = 2000;
export const MAX_IMPORTS = 40;
export const MAX_ADDITIONAL_FILE_CHARS = 1500;
export const MAX_ADDITIONAL_FILES = 6;

// panel.ts — persisted state keys and history cap.
export const HISTORY_KEY = 'smartprompting.history';
export const LAST_PROMPT_KEY = 'smartprompting.lastPrompt';
export const LAST_OUTPUT_KEY = 'smartprompting.lastOutput';
export const MAX_HISTORY = 10;

// docGrounding.ts — README-grounding limits.
// Categories where API surface shifts most between major versions — grounding
// these with current docs pays off most. Ordered by priority.
export const GROUND_CATEGORIES: LibCategory[] = ['router', 'dataFetching', 'forms', 'state', 'uiKit'];
export const MAX_LIBS = 4;
export const MAX_README_CHARS = 1200;
export const FETCH_TIMEOUT_MS = 4000;

// recommendations.ts — categories worth proactively suggesting, in order.
export const SUGGEST_ORDER: LibCategory[] = [
	'uiKit', 'styling', 'icons', 'state', 'dataFetching', 'forms', 'validation',
	'router', 'animation', 'charts', 'tables', 'dragDrop', 'notifications',
	'auth', 'dates', 'i18n', 'testing',
];

// ai.ts — per-provider defaults.
export type ProviderName = 'gemini' | 'openai' | 'anthropic';

export const DEFAULT_MODELS: Record<ProviderName, string> = {
	gemini: 'gemini-2.5-flash',
	openai: 'gpt-4.1-mini',
	anthropic: 'claude-opus-4-8',
};

export const ENV_VARS: Record<ProviderName, string[]> = {
	gemini: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
	openai: ['OPENAI_API_KEY'],
	anthropic: ['ANTHROPIC_API_KEY'],
};

export const LABELS: Record<ProviderName, string> = {
	gemini: 'Gemini',
	openai: 'OpenAI',
	anthropic: 'Anthropic (Claude)',
};

export const KEY_URLS: Record<ProviderName, string> = {
	gemini: 'https://aistudio.google.com/apikey',
	openai: 'https://platform.openai.com/api-keys',
	anthropic: 'https://console.anthropic.com/settings/keys',
};
