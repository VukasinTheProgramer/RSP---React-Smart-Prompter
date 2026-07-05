import * as assert from 'assert';
import { splitNameVersion } from '../docGrounding';

suite('splitNameVersion', () => {
	test('splits an unscoped package', () => {
		assert.deepStrictEqual(splitNameVersion('react-router-dom@6.21.0'), { name: 'react-router-dom', version: '6.21.0' });
	});

	test('splits a scoped package on the version @, not the scope @', () => {
		assert.deepStrictEqual(splitNameVersion('@tanstack/react-query@5.0.0'), { name: '@tanstack/react-query', version: '5.0.0' });
	});

	test('returns null for a scope-only string with no version', () => {
		assert.strictEqual(splitNameVersion('@scope/pkg'), null);
	});

	test('returns null when there is no @ at all', () => {
		assert.strictEqual(splitNameVersion('react'), null);
	});
});
