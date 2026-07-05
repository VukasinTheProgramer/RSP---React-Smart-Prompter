import * as assert from 'assert';
import { friendlyError } from '../ai';

function apiError(status: number, message: string): Error {
	const err = new Error(message);
	(err as unknown as { status: number }).status = status;
	return err;
}

suite('friendlyError', () => {
	test('401/403 -> invalid key message mentions Set API Key command', () => {
		assert.match(friendlyError(apiError(401, 'unauthorized')), /Set API Key/);
		assert.match(friendlyError(apiError(403, 'forbidden')), /Set API Key/);
	});

	test('429 -> rate limit / quota message', () => {
		assert.match(friendlyError(apiError(429, 'quota exceeded')), /rate limit|quota/i);
	});

	test('5xx -> temporarily unavailable message', () => {
		assert.match(friendlyError(apiError(503, 'server error')), /temporarily unavailable/i);
	});

	test('network error -> connection message', () => {
		assert.match(friendlyError(new Error('fetch failed: ENOTFOUND api.example.com')), /internet connection/i);
	});

	test('unrecognized error falls back to the raw message', () => {
		assert.strictEqual(friendlyError(new Error('something weird happened')), 'something weird happened');
	});

	test('non-Error values are stringified', () => {
		assert.strictEqual(friendlyError('plain string error'), 'plain string error');
	});
});
