#!/usr/bin/env node
/**
 * `signedoff` entry point.
 *
 * The CLI is authored in TypeScript and runs through tsx rather than a compiled
 * bundle. That keeps the source readable for anyone auditing what we send to a
 * client, at the cost of a slightly slower cold start.
 */
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { spawn } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const entry = join(here, '..', 'src', 'index.ts');
const tsx = join(here, '..', 'node_modules', '.bin', 'tsx');

const child = spawn(tsx, [entry, ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: false,
});

child.on('exit', (code, signal) => {
  process.exit(signal !== null ? 1 : (code ?? 0));
});
