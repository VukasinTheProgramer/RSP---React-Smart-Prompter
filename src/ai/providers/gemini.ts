import { ProjectContext } from '../../context';
import { Question, QaPair, QUESTIONS_SCHEMA, questionsSystemPrompt, expandSystemPrompt, explainSuggestionSystemPrompt, explainSuggestionUserMessage, qaText } from './types';

async function getClient(apiKey: string | undefined) {
	const { GoogleGenAI } = await import('@google/genai');
	// No key configured: let the SDK fall back to the GEMINI_API_KEY / GOOGLE_API_KEY env var.
	return apiKey ? new GoogleGenAI({ apiKey }) : new GoogleGenAI({});
}

export async function generateQuestions(apiKey: string | undefined, model: string, context: ProjectContext | null, prompt: string, maxQuestions: number, chosenLibraries: string[] = []): Promise<Question[]> {
	if (maxQuestions <= 0) {return [];}

	const client = await getClient(apiKey);
	const response = await client.models.generateContent({
		model,
		contents: prompt,
		config: {
			systemInstruction: questionsSystemPrompt(context, maxQuestions, chosenLibraries),
			responseMimeType: 'application/json',
			responseJsonSchema: QUESTIONS_SCHEMA,
		},
	});

	const text = response.text;
	if (!text) {return [];}
	const parsed = JSON.parse(text) as { questions: Question[] };
	return parsed.questions.slice(0, maxQuestions);
}

export async function expandPrompt(apiKey: string | undefined, model: string, context: ProjectContext | null, prompt: string, qa: QaPair[], chosenLibraries: string[] = [], docs = ""): Promise<string> {
	const client = await getClient(apiKey);
	const response = await client.models.generateContent({
		model,
		contents: `Rough prompt:\n${prompt}\n\nClarifying Q&A:\n${qaText(qa)}`,
		config: { systemInstruction: expandSystemPrompt(context, chosenLibraries, docs) },
	});

	return response.text ?? '';
}

export async function explainSuggestion(apiKey: string | undefined, model: string, context: ProjectContext | null, category: string, pkg: string, note: string): Promise<string> {
	const client = await getClient(apiKey);
	const response = await client.models.generateContent({
		model,
		contents: explainSuggestionUserMessage(category, pkg, note),
		config: { systemInstruction: explainSuggestionSystemPrompt(context) },
	});

	return response.text ?? '';
}
