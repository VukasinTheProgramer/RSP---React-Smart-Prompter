import { ProjectContext, LIB_CATEGORIES } from '../context';

export interface Question {
	question: string;
	options: string[];
}

export interface QaPair {
	question: string;
	answer: string;
}

export const QUESTIONS_SCHEMA = {
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

export function describeContext(context: ProjectContext | null): string {
	if (!context || !context.react) {
		return 'No React project detected.';
	}
	const parts = [`React ${context.react}`];
	if (context.next) {
		const router = context.nextRouter === 'app' ? ' (App Router)' : context.nextRouter === 'pages' ? ' (Pages Router)' : '';
		parts.push(`Next ${context.next}${router}`);
	}
	for (const category of LIB_CATEGORIES) {
		const value = context[category];
		if (value) {parts.push(value);}
	}
	if (context.activeFileName) {parts.push(`active file: ${context.activeFileName}`);}
	return parts.join(', ');
}

function chosenLibrariesLine(chosenLibraries: string[]): string {
	if (chosenLibraries.length === 0) {return '';}
	return `\n\nThe developer has chosen to use these libraries for this task: ${chosenLibraries.join(', ')}. Target these explicitly and assume they are (or will be) installed.`;
}

function selectedCodeBlock(context: ProjectContext | null): string {
	if (!context?.selectedCode) {return '';}
	return `\n\nThe developer has this code selected in the editor — use it to understand existing patterns and naming, and only ask about things it doesn't already answer:\n\`\`\`\n${context.selectedCode}\n\`\`\``;
}

function importsBlock(context: ProjectContext | null): string {
	if (!context?.imports?.length) {return '';}
	return `\n\nThe active file already imports these — reuse them where relevant instead of re-creating equivalents:\n${context.imports.map((i) => `- ${i}`).join('\n')}`;
}

export function questionsSystemPrompt(context: ProjectContext | null, maxQuestions: number, chosenLibraries: string[] = []): string {
	return `You are a React specialist helping a developer refine a coding prompt before sending it to an AI coding assistant.

Detected project context: ${describeContext(context)}${chosenLibrariesLine(chosenLibraries)}${selectedCodeBlock(context)}${importsBlock(context)}

Only ask questions whose answer would change the generated code. Never ask something answerable from the context above, the chosen libraries, or the selected code. Max ${maxQuestions} question${maxQuestions === 1 ? '' : 's'}, fewer is better — return an empty array if the prompt is already clear enough. Each question should have 2-4 short answer options.`;
}

export function expandSystemPrompt(context: ProjectContext | null, chosenLibraries: string[] = [], docs = ''): string {
	return `You are a React specialist helping a developer refine a coding prompt before sending it to an AI coding assistant.

Detected project context: ${describeContext(context)}${chosenLibrariesLine(chosenLibraries)}${selectedCodeBlock(context)}${importsBlock(context)}${docs}

Expand the developer's rough prompt into a precise, detailed prompt. State the goal, the exact library versions to target based on the context above, constraints (styling approach, state pattern already in use), and what NOT to do (e.g. don't introduce a different state library than the one detected). If a UI kit or icon library was detected, tell the assistant to reuse its existing components/icons instead of building new ones or pulling in a different library. If code was selected, tell the assistant to match its existing naming and patterns. Respond with only the expanded prompt as plain text, no preamble.`;
}

export function qaText(qa: QaPair[]): string {
	return qa.length > 0
		? qa.map((p) => `Q: ${p.question}\nA: ${p.answer}`).join('\n\n')
		: '(no clarifying questions were needed)';
}
