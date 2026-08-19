#!/usr/bin/env node
/**
 * Redact every evidence pack committed to this repository.
 *
 * The packs are committed on purpose — they are the evidence behind the claims in
 * the README, and they let `pnpm test` and `pnpm demo` run with no TestMu AI
 * account. But a pack's `result.yaml` carries the maker's account email, org id,
 * and a dashboard share token, and this repository is public.
 *
 * Redacting leaves the packs valid at L1. Run this before committing a new pack:
 *
 *   node scripts/redact-committed-packs.mjs
 *   kane-cli evidence validate <pack> --profile L1
 */
import { readdirSync, statSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { redactPack } from '../packages/cli/src/kane/redact.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const searchDirs = [
  join(root, 'packages/cli/test-fixtures/packs'),
  join(root, 'demo/bloom-vine-project/.testmuai/evidence'),
];

let total = 0;

for (const dir of searchDirs) {
  let names;
  try {
    names = readdirSync(dir);
  } catch {
    continue;
  }

  for (const name of names) {
    if (!name.endsWith('.evidence')) continue;
    const path = join(dir, name);
    if (!statSync(path).isFile()) continue;

    const temp = `${path}.redacting`;
    const report = redactPack(path, temp);
    renameSync(temp, path);

    console.log(
      `${name}: ${report.fieldsRedacted} field${report.fieldsRedacted === 1 ? '' : 's'} ` +
        `in ${report.filesTouched} result.yaml`,
    );
    total += report.fieldsRedacted;
  }
}

console.log(`\n${total} fields redacted. Re-validate before committing.`);
