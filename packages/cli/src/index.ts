#!/usr/bin/env node
import { Command } from 'commander';
import pc from 'picocolors';
import { init } from './commands/init.ts';
import { KaneUnavailableError } from './kane/proc.ts';
import { NoContextError } from './kane/graph.ts';
import { NoProjectError } from './domain/project.ts';
import * as ui from './ui/render.ts';

/**
 * Signed Off — attach client-readable proof of delivery to a milestone.
 *
 * The maker's entire surface is this CLI. There is no maker dashboard by design:
 * the maker already lives in a terminal and their coding agent already drives
 * one. The polished surface in this product belongs to the *client*, who gets a
 * page rather than a prompt.
 *
 * Every command supports `--json` so a coding agent can drive the same flow a
 * human does.
 */

const program = new Command();

program
  .name('signedoff')
  .description('Turn the scope your client signed into proof they can read.')
  .version('0.1.0')
  .showHelpAfterError();

program
  .command('init')
  .description("read a scope document and list what it promises")
  .argument('<document>', 'the scope, SOW or brief your client signed')
  .option('--client <name>', "the client's name, shown on the handover page")
  .option('--title <title>', 'project title (defaults to the document heading)')
  .option('--max <n>', 'cap on scenario+test pairs per use-case', '4')
  .option('--skip-design', 'stop after finding use-cases; do not design tests yet', false)
  .option('--json', 'machine-readable output', false)
  .action(async (document: string, opts: Record<string, unknown>) => {
    const max = Number.parseInt(String(opts['max'] ?? '4'), 10);
    process.exitCode = await init({
      cwd: process.cwd(),
      document,
      ...(typeof opts['client'] === 'string' ? { client: opts['client'] } : {}),
      ...(typeof opts['title'] === 'string' ? { title: opts['title'] } : {}),
      max: Number.isFinite(max) && max > 0 ? max : 4,
      skipDesign: opts['skipDesign'] === true,
      json: opts['json'] === true,
    });
  });

async function main(): Promise<void> {
  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    if (error instanceof KaneUnavailableError) {
      ui.fail(error.message);
      process.exitCode = 2;
      return;
    }
    if (error instanceof NoContextError || error instanceof NoProjectError) {
      ui.fail(error.message);
      process.exitCode = 2;
      return;
    }
    ui.fail(error instanceof Error ? error.message : String(error));
    if (process.env['SIGNEDOFF_DEBUG'] === '1' && error instanceof Error) {
      process.stderr.write(pc.dim(`${error.stack ?? ''}\n`));
    }
    process.exitCode = 1;
  }
}

await main();
