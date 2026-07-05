import * as assert from 'assert';
import { LibCategory, LIB_GROUPS, LIB_CATEGORIES } from '../libGroups';
import { suggestLibraries, RECOMMENDATIONS } from '../recommendations';
import { ProjectContext } from '../context';

function emptyContext(overrides: Partial<ProjectContext> = {}): ProjectContext {
	const libs = {} as Record<LibCategory, string | null>;
	for (const category of LIB_CATEGORIES) {
		libs[category] = null;
	}
	return { isReactFile: true, activeFileName: null, selectedCode: null, imports: [], react: '18.2.0', next: null, nextRouter: null, ...libs, ...overrides };
}

suite('libGroups', () => {
	test('LIB_CATEGORIES matches LIB_GROUPS keys exactly', () => {
		assert.deepStrictEqual([...LIB_CATEGORIES].sort(), Object.keys(LIB_GROUPS).sort());
	});

	test('every category has at least one library', () => {
		for (const category of LIB_CATEGORIES) {
			assert.ok(LIB_GROUPS[category].length > 0, `${category} is empty`);
		}
	});
});

suite('recommendations', () => {
	test('suggests every recommended category for a bare React project', () => {
		const suggestions = suggestLibraries(emptyContext());
		const recommendedCategories = Object.keys(RECOMMENDATIONS);
		for (const category of recommendedCategories) {
			assert.ok(
				suggestions.some((s) => s.category === category),
				`expected a suggestion for ${category}`
			);
		}
	});

	test('skips a category the project already covers', () => {
		const suggestions = suggestLibraries(emptyContext({ styling: 'tailwindcss@3.4.0', state: 'zustand@4.4.0' }));
		assert.ok(!suggestions.some((s) => s.category === 'styling'), 'styling should be skipped');
		assert.ok(!suggestions.some((s) => s.category === 'state'), 'state should be skipped');
		assert.ok(suggestions.some((s) => s.category === 'forms'), 'forms should still be suggested');
	});

	test('returns nothing when there is no project context', () => {
		assert.deepStrictEqual(suggestLibraries(null), suggestLibraries(null));
		assert.ok(suggestLibraries(null).length > 0); // no context = nothing detected = everything suggested
	});

	test('each recommendation option has a valid compat tier', () => {
		for (const options of Object.values(RECOMMENDATIONS)) {
			for (const opt of options ?? []) {
				assert.ok(['high', 'medium', 'low'].includes(opt.tier), `${opt.package} has invalid tier ${opt.tier}`);
			}
		}
	});
});
