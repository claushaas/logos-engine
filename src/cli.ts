#!/usr/bin/env node
import { PACKAGE_NAME, PACKAGE_VERSION } from './index.js';

const args = process.argv.slice(2);

function showHelp(): void {
	console.log(`${PACKAGE_NAME} — scaffold build`);
	console.log('');
	console.log('Usage: logos [options]');
	console.log('');
	console.log('Options:');
	console.log('  -h, --help     Show this help message');
	console.log('  -v, --version  Show version number');
	console.log('');
	console.log(
		'Note: The TUI and runtime behavior will be implemented in later phases.',
	);
}

function showVersion(): void {
	console.log(`${PACKAGE_VERSION}`);
}

function showPlaceholder(): void {
	console.log(`${PACKAGE_NAME} v${PACKAGE_VERSION} — scaffold build`);
	console.log('');
	console.log(
		'The TUI and runtime behavior will be implemented in later phases.',
	);
}

if (args.length === 0) {
	showPlaceholder();
	process.exit(0);
}

if (args.includes('--help') || args.includes('-h')) {
	showHelp();
	process.exit(0);
}

if (args.includes('--version') || args.includes('-v')) {
	showVersion();
	process.exit(0);
}

console.error(`Unknown option: ${args[0]}`);
process.exit(1);
