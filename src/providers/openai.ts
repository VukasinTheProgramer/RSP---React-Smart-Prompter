import OpenAI from 'openai';
import { ProjectContext } from '../context';
import { Question, QaPair, QUESTIONS_SCHEMA, questionsSystemPrompt, expandSystemPrompt, qaText } from './types';

function getClient(apiKey: string | undefined): OpenAI {
	// No key configured: let the SDK fall back to the OPENAI_API_KEY env var.
	return apiKey ? new OpenAI({ apiKey }) : new OpenAI();
}

export async function generateQuestions(apiKey: string | undefined, model: string, context: ProjectContext | null, prompt: string, maxQuestions: number, chosenLibraries: string[] = []): Promise<Question[]> {
	if (maxQuestions <= 0) {return [];}

	const client = getClient(apiKey);
	const response = await client.chat.completions.create({
		model,
		messages: [
			{ role: 'system', content: questionsSystemPrompt(context, maxQuestions, chosenLibraries) },
			{ role: 'user', content: prompt },
		],
		response_format: {
			type: 'json_schema',
			json_schema: { name: 'clarifying_questions', schema: QUESTIONS_SCHEMA, strict: true },
		},
	});

	const text = response.choices[0]?.message?.content;
	if (!text) {return [];}
	const parsed = JSON.parse(text) as { questions: Question[] };
	return parsed.questions.slice(0, maxQuestions);
}

export async function expandPrompt(apiKey: string | undefined, model: string, context: ProjectContext | null, prompt: string, qa: QaPair[], chosenLibraries: string[] = [], docs = ""): Promise<string> {
	const client = getClient(apiKey);
	const response = await client.chat.completions.create({
		model,
		messages: [
			{ role: 'system', content: expandSystemPrompt(context, chosenLibraries, docs) },
			{ role: 'user', content: `Rough prompt:\n${prompt}\n\nClarifying Q&A:\n${qaText(qa)}` },
		],
	});

	return response.choices[0]?.message?.content ?? '';
}
