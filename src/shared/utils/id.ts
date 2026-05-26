/**
 * ID generation — produces lexicographically sortable, non-colliding IDs.
 *
 * Format: `<timestamp>_<counter>_<entropy>`
 * - `timestamp`: logical milliseconds since epoch, zero-padded to 15 digits.
 *   Uses a logical clock (`max(now, prevTimestamp)`) so IDs never sort out of
 *   order even if the system clock moves backward.
 * - `counter`: monotonic per-millisecond counter, zero-padded to 6 digits.
 *   If the counter would overflow, the logical timestamp is incremented and
 *   the counter resets.
 * - `entropy`: 8 random hex characters for collision resistance.
 *
 * Lexicographic sort order matches chronological generation order because
 * the logical timestamp is leftmost, monotonic, and the counter is monotonic
 * within each timestamp.
 */

const MAX_COUNTER = 999_999;

let _prevTimestamp = 0;
let _counter = 0;

/** Reset the internal counter (for testing only). */
export function _resetIdCounter(): void {
	_prevTimestamp = 0;
	_counter = 0;
}

/**
 * Generate a unique, lexicographically sortable identifier.
 *
 * @returns A string ID like `000001746702434611_000000_a1b2c3d4`.
 */
export function generateId(): string {
	const rawNow = Date.now();

	// Logical clock: never go backward.
	const now = Math.max(rawNow, _prevTimestamp);

	if (now === _prevTimestamp) {
		_counter += 1;
		if (_counter > MAX_COUNTER) {
			// Counter overflow: bump logical timestamp forward.
			_prevTimestamp = now + 1;
			_counter = 0;
		}
	} else {
		_prevTimestamp = now;
		_counter = 0;
	}

	const ts = String(_prevTimestamp).padStart(15, '0');
	const cnt = String(_counter).padStart(6, '0');
	const entropy = randomHex(8);

	return `${ts}_${cnt}_${entropy}`;
}

/** Generate `n` random hex characters. */
function randomHex(n: number): string {
	let result = '';
	for (let i = 0; i < n; i++) {
		result += Math.floor(Math.random() * 16).toString(16);
	}
	return result;
}
