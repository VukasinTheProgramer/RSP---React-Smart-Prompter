import Anthropic from '@anthropic-ai/sdk';
import { ProjectContext } from '../../context';
import { Question, QaPair, QUESTIONS_SCHEMA, questionsSystemPrompt, expandSystemPrompt, explainSuggestionSystemPrompt, explainSuggestionUserMessage, qaText } from './types';

function getClient(apiKey: string | undefined): Anthropic {
	// No key configured: let the SDK fall back to ANTHROPIC_API_KEY or an `ant auth login` session.
	return apiKey ? new Anthropic({ apiKey }) : new Anthropic();
}

function firstText(content: Anthropic.ContentBlock[]): string {
	const block = content.find((b) => b.type === 'text');
	return block && block.type === 'text' ? block.text : '';
}

export async function generateQuestions(apiKey: string | undefined, model: string, context: ProjectContext | null, prompt: string, maxQuestions: number, chosenLibraries: string[] = []): Promise<Question[]> {
	if (maxQuestions <= 0) {return [];}

	const client = getClient(apiKey);
	const response = await client.messages.create({
		model,
		max_tokens: 1024,
		system: questionsSystemPrompt(context, maxQuestions, chosenLibraries),
		output_config: { format: { type: 'json_schema', schema: QUESTIONS_SCHEMA } },
		messages: [{ role: 'user', content: prompt }],
	});

	const text = firstText(response.content);
	if (!text) {return [];}
	const parsed = JSON.parse(text) as { questions: Question[] };
	return parsed.questions.slice(0, maxQuestions);
}

export async function expandPrompt(apiKey: string | undefined, model: string, context: ProjectContext | null, prompt: string, qa: QaPair[], chosenLibraries: string[] = [], docs = ""): Promise<string> {
	const client = getClient(apiKey);
	const response = await client.messages.create({
		model,
		max_tokens: 2048,
		system: expandSystemPrompt(context, chosenLibraries, docs),
		messages: [{ role: 'user', content: `Rough prompt:\n${prompt}\n\nClarifying Q&A:\n${qaText(qa)}` }],
	});

	return firstText(response.content);
}

export async function explainSuggestion(apiKey: string | undefined, model: string, context: ProjectContext | null, category: string, pkg: string, note: string): Promise<string> {
	const client = getClient(apiKey);
	const response = await client.messages.create({
		model,
		max_tokens: 512,
		system: explainSuggestionSystemPrompt(context),
		messages: [{ role: 'user', content: explainSuggestionUserMessage(category, pkg, note) }],
	});

	return firstText(response.content);
}
