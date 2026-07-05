import { ProjectContext } from './context';
import { LibCategory } from './libGroups';

// Categories where API surface shifts most between major versions — grounding
// these with current docs pays off most. Ordered by priority.
const GROUND_CATEGORIES: LibCategory[] = ['router', 'dataFetching', 'forms', 'state', 'uiKit'];
const MAX_LIBS = 4;
const MAX_README_CHARS = 1200;
const FETCH_TIMEOUT_MS = 4000;

// Session cache keyed by "name@version" so we never re-fetch the same README.
const readmeCache = new Map<string, string | null>();

// Split "react-router-dom@6.21.0" or "@tanstack/react-query@5.0.0" into name + version.
export function splitNameVersion(entry: string): { name: string; version: string } | null {
	const at = entry.lastIndexOf('@');
	if (at <= 0) {return null;} // no '@' or leading-@ scope only
	return { name: entry.slice(0, at), version: entry.slice(at + 1) };
}

function librariesToGround(context: ProjectContext): string[] {
	const entries: string[] = [];
	if (context.react) {entries.push(`react@${context.react}`);}
	if (context.next) {entries.push(`next@${context.next}`);}
	for (const category of GROUND_CATEGORIES) {
		const value = context[category];
		if (value) {entries.push(value);}
	}
	return entries.slice(0, MAX_LIBS);
}

async function fetchReadme(name: string, version: string): Promise<string | null> {
	const key = `${name}@${version}`;
	if (readmeCache.has(key)) {return readmeCache.get(key) ?? null;}

	try {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
		const res = await fetch(`https://unpkg.com/${name}@${version}/README.md`, { signal: controller.signal });
		clearTimeout(timer);
		if (!res.ok) {
			readmeCache.set(key, null);
			return null;
		}
		const text = await res.text();
		const trimmed = text.length > MAX_README_CHARS ? text.slice(0, MAX_README_CHARS) + '\n… (truncated)' : text;
		readmeCache.set(key, trimmed);
		return trimmed;
	} catch {
		readmeCache.set(key, null); // network error / timeout — don't retry this session
		return null;
	}
}

/**
 * Fetches current README excerpts for the most version-sensitive detected
 * libraries and returns a prompt block. Returns '' when grounding is off, no
 * libraries qualify, or every fetch fails — grounding is best-effort and never
 * blocks the enhance flow.
 */
export async function fetchDocGrounding(context: ProjectContext | null): Promise<string> {
	if (!context) {return '';}

	const results: string[] = [];
	for (const entry of librariesToGround(context)) {
		const parsed = splitNameVersion(entry);
		if (!parsed) {continue;}
		const readme = await fetchReadme(parsed.name, parsed.version);
		if (readme) {
			results.push(`### ${entry}\n${readme}`);
		}
	}

	if (results.length === 0) {return '';}
	return `\n\nCurrent documentation excerpts for the detected library versions (authoritative — prefer these over your training knowledge if they conflict):\n\n${results.join('\n\n')}`;
}
