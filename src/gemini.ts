import * as vscode from 'vscode';
import { ProjectContext } from './context';

export interface Question {
	question: string;
	options: string[];
}

export interface QaPair {
	question: string;
	answer: string;
}

const QUESTIONS_SCHEMA = {
	type: 'object',
	properties: {
		questions: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					question: { type: 'string' },
					options: { type: 'array', items: { type: 'string' } },
				},
				required: ['question', 'options'],
				additionalProperties: false,
			},
		},
	},
	required: ['questions'],
	additionalProperties: false,
};

async function getClient() {
	const { GoogleGenAI } = await import('@google/genai');
	const apiKey = vscode.workspace.getConfiguration('smartprompting').get<string>('apiKey');
	// No key configured: let the SDK fall back to the GEMINI_API_KEY / GOOGLE_API_KEY env var.
	return apiKey ? new GoogleGenAI({ apiKey }) : new GoogleGenAI({});
}

function getModel(): string {
	return vscode.workspace.getConfiguration('smartprompting').get<string>('model') || 'gemini-2.5-flash';
}

function describeContext(context: ProjectContext | null): string {
	if (!context || !context.react) {
		return 'No React project detected.';
	}
	const parts = [`React ${context.react}`];
	if (context.next) {parts.push(`Next ${context.next}`);}
	if (context.router) {parts.push(context.router);}
	if (context.state) {parts.push(context.state);}
	if (context.styling) {parts.push(context.styling);}
	if (context.dataFetching) {parts.push(context.dataFetching);}
	if (context.forms) {parts.push(context.forms);}
	if (context.activeFileName) {parts.push(`active file: ${context.activeFileName}`);}
	return parts.join(', ');
}

export async function generateQuestions(context: ProjectContext | null, prompt: string): Promise<Question[]> {
	const client = await getClient();
	const system = `You are a React specialist helping a developer refine a coding prompt before sending it to an AI coding assistant.

Detected project context: ${describeContext(context)}

Only ask questions whose answer would change the generated code. Never ask something answerable from the context above. Max 3 questions, fewer is better — return an empty array if the prompt is already clear enough. Each question should have 2-4 short answer options.`;

	const response = await client.models.generateContent({
		model: getModel(),
		contents: prompt,
		config: {
			systemInstruction: system,
			responseMimeType: 'application/json',
			responseJsonSchema: QUESTIONS_SCHEMA,
		},
	});

	const text = response.text;
	if (!text) {return [];}
	const parsed = JSON.parse(text) as { questions: Question[] };
	return parsed.questions.slice(0, 3);
}

export async function expandPrompt(context: ProjectContext | null, prompt: string, qa: QaPair[]): Promise<string> {
	const client = await getClient();
	const system = `You are a React specialist helping a developer refine a coding prompt before sending it to an AI coding assistant.

Detected project context: ${describeContext(context)}

Expand the developer's rough prompt into a precise, detailed prompt. State the goal, the exact library versions to target based on the context above, constraints (styling approach, state pattern already in use), and what NOT to do (e.g. don't introduce a different state library than the one detected). Respond with only the expanded prompt as plain text, no preamble.`;

	const qaText = qa.length > 0
		? qa.map((p) => `Q: ${p.question}\nA: ${p.answer}`).join('\n\n')
		: '(no clarifying questions were needed)';

	const response = await client.models.generateContent({
		model: getModel(),
		contents: `Rough prompt:\n${prompt}\n\nClarifying Q&A:\n${qaText}`,
		config: { systemInstruction: system },
	});

	return response.text ?? '';
}
