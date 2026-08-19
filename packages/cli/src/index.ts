#!/usr/bin/env node
import { resolve } from 'node:path';
import { Command } from 'commander';
import pc from 'picocolors';
import { init } from './commands/init.ts';
import { brief } from './commands/brief.ts';
import { publish } from './commands/publish.ts';
import { verify } from './commands/verify.ts';
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

program
  .command('verify')
  .description('check the promises against a real build')
  .requiredOption('--url <url>', 'where the build is running')
  .option('--milestone <n>', 'which milestone this covers', '1')
  .option('--show-browser', 'watch the browser instead of running headless', false)
  .option('--json', 'machine-readable output', false)
  .action(async (opts: Record<string, unknown>) => {
    const milestone = Number.parseInt(String(opts['milestone'] ?? '1'), 10);
    process.exitCode = await verify({
      cwd: process.cwd(),
      url: String(opts['url']),
      milestone: Number.isFinite(milestone) && milestone > 0 ? milestone : 1,
      headless: opts['showBrowser'] !== true,
      json: opts['json'] === true,
    });
  });

program
  .command('brief')
  .description('turn what is not proven into a repair brief for a coding agent')
  .option('--milestone <n>', 'which milestone to report on', '1')
  .option('--json', 'machine-readable output', false)
  .action(async (opts: Record<string, unknown>) => {
    const milestone = Number.parseInt(String(opts['milestone'] ?? '1'), 10);
    process.exitCode = await brief({
      cwd: process.cwd(),
      milestone: Number.isFinite(milestone) && milestone > 0 ? milestone : 1,
      json: opts['json'] === true,
    });
  });

program
  .command('publish')
  .description('turn a verified milestone into a page your client can open')
  .option('--milestone <n>', 'which milestone to publish', '1')
  .option('--web-root <path>', 'where the handover site lives', '../web')
  .option('--base-url <url>', 'public base URL of the handover site', 'http://localhost:4300')
  .option('--include-pack', 'also offer the sealed evidence file for download', false)
  .option('--json', 'machine-readable output', false)
  .action(async (opts: Record<string, unknown>) => {
    const milestone = Number.parseInt(String(opts['milestone'] ?? '1'), 10);
    process.exitCode = await publish({
      cwd: process.cwd(),
      milestone: Number.isFinite(milestone) && milestone > 0 ? milestone : 1,
      webRoot: resolve(process.cwd(), String(opts['webRoot'] ?? '../web')),
      baseUrl: String(opts['baseUrl'] ?? 'http://localhost:4300'),
      includePack: opts['includePack'] === true,
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

// Kane leaves a detached Chrome behind, and anything still holding a handle on
// its pipes would keep this process alive indefinitely. `runKane` releases what
// it owns; this is the backstop, after stdout has been flushed.
process.stdout.write('', () => {
  process.exit(process.exitCode ?? 0);
});
