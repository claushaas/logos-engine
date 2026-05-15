import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

describe('package.json contract', () => {
	it('has bin.logos pointing to ./dist/cli.js', () => {
		expect(pkg).toHaveProperty('bin');
		expect(pkg.bin).toHaveProperty('logos', './dist/cli.js');
	});

	it('has required baseline scripts', () => {
		expect(pkg.scripts).toHaveProperty('build');
		expect(pkg.scripts).toHaveProperty('test');
		expect(pkg.scripts).toHaveProperty('smoke:cli');
	});
});
