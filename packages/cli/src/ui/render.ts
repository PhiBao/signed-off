import pc from 'picocolors';
import type { DeliveryPromise, PromiseInventory } from '../domain/promise.ts';

/**
 * Terminal output for the maker.
 *
 * The maker is a developer and lives in a terminal, so this is their whole
 * surface — there is no maker dashboard and there should never be one. But the
 * *language* here is already client language: promises, not test ids. The maker
 * needs to trust that what they read is what their client will read.
 */

const GLYPH = {
  proven: pc.green('✓'),
  notProven: pc.red('✗'),
  cannotCheck: pc.yellow('○'),
  bullet: pc.dim('·'),
} as const;

export function heading(text: string): string {
  return `\n${pc.bold(text)}\n`;
}

export function dim(text: string): string {
  return pc.dim(text);
}

/** Wrap prose to a readable width, indenting continuation lines. */
export function wrap(text: string, width = 76, indent = ''): string {
  const words = text.split(/\s+/).filter((w) => w !== '');
  const lines: string[] = [];
  let line = '';

  for (const word of words) {
    if (line === '') line = word;
    else if (`${line} ${word}`.length <= width) line += ` ${word}`;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line !== '') lines.push(line);

  return lines.map((l, i) => (i === 0 ? l : `${indent}${l}`)).join('\n');
}

/**
 * The use-case list, shown when design was skipped.
 *
 * Cheap first look: what the document appears to promise, before paying to
 * design assurance for it.
 */
export function renderUseCases(
  useCases: readonly {
    readonly title: string;
    readonly value: string;
    readonly criteria: readonly string[];
  }[],
): string {
  const out: string[] = [];
  out.push(heading(`${useCases.length} things your scope describes`));

  for (const uc of useCases) {
    out.push(`  ${pc.bold(uc.title)}`);
    if (uc.value !== '') out.push(pc.dim(`    ${wrap(uc.value, 70, '    ')}`));
    for (const c of uc.criteria) out.push(`    ${GLYPH.bullet} ${wrap(c, 70, '      ')}`);
    out.push('');
  }

  out.push(pc.dim('  These are not promises yet — no assurance has been designed.'));
  out.push(pc.dim('  Run without --skip-design to find what can and cannot be proven.'));
  return out.join('\n');
}

/**
 * The promise inventory, shown after `init`.
 *
 * This is the maker's first-light moment: their own contract, read back as a
 * list of things that can and cannot be proven. The unprovable ones are listed
 * with equal prominence, because finding them before quoting the work is worth
 * as much as proving the rest.
 */
export function renderInventory(inventory: PromiseInventory): string {
  const { counts, promises, openQuestions } = inventory;
  const out: string[] = [];

  out.push(heading(`${counts.total} promises found in your scope`));

  const byUseCase = new Map<string, DeliveryPromise[]>();
  for (const p of promises) {
    const list = byUseCase.get(p.useCaseTitle) ?? [];
    list.push(p);
    byUseCase.set(p.useCaseTitle, list);
  }

  for (const [title, group] of byUseCase) {
    out.push(pc.dim(`  ${title === '' ? 'Other' : title}`));
    for (const p of group) {
      const mark =
        p.checkability === 'checkable'
          ? pc.green('provable')
          : p.checkability === 'unmeasurable'
            ? pc.yellow('not provable in a browser')
            : p.checkability === 'blocked'
              ? pc.yellow('needs an answer first')
              : pc.dim('no test yet');

      out.push(`    ${GLYPH.bullet} ${wrap(p.text, 70, '      ')}`);
      out.push(`      ${mark}`);

      if (p.checkability === 'unmeasurable' && p.question?.reason !== undefined) {
        out.push(pc.dim(`      why: ${wrap(p.question.reason, 66, '           ')}`));
      }
    }
    out.push('');
  }

  if (counts.unmeasurable > 0) {
    out.push(
      pc.yellow(
        `  ${counts.unmeasurable} promise${counts.unmeasurable === 1 ? '' : 's'} cannot be proven in a browser. ` +
          `Your client will see this, with the reason.`,
      ),
    );
  }

  if (openQuestions.length > 0) {
    out.push(heading(`${openQuestions.length} things your scope doesn't say`));
    out.push(pc.dim('  Send these to your client before you build.\n'));

    openQuestions.forEach((q, i) => {
      out.push(`  ${pc.bold(`${i + 1}. ${q.header}`)}`);
      out.push(`     ${wrap(q.prompt, 70, '     ')}`);
      q.options.forEach((opt, j) => {
        const recommended = q.recommendedIndex === j ? pc.green(' (recommended)') : '';
        out.push(pc.dim(`       ${String.fromCharCode(97 + j)}) ${opt.label}${recommended}`));
      });
      out.push('');
    });

    out.push(pc.dim('  Turn these into a page for your client:  signedoff questions --send'));
  }

  return out.join('\n');
}

/** The verdict list, shown after `verify`. Mirrors what the client will see. */
export function renderVerdicts(promises: readonly DeliveryPromise[]): string {
  const out: string[] = [];

  for (const p of promises) {
    const glyph =
      p.state === 'proven'
        ? GLYPH.proven
        : p.state === 'not_proven'
          ? GLYPH.notProven
          : GLYPH.cannotCheck;

    const label =
      p.state === 'proven'
        ? p.strength === 'observed'
          ? pc.dim('proven (by review)')
          : pc.green('proven')
        : p.state === 'not_proven'
          ? pc.red('not proven')
          : pc.yellow("can't check");

    out.push(`  ${glyph} ${label.padEnd(22)} ${wrap(p.text, 52, '                         ')}`);
    if (p.why !== undefined && p.state !== 'proven') {
      out.push(pc.dim(`      → ${wrap(p.why, 66, '        ')}`));
    }
  }

  return out.join('\n');
}

/**
 * A live progress line, rewritten in place when the terminal supports it.
 *
 * Non-interactive callers get silence rather than a wall of activity lines: an
 * agent driving `--json` wants the result, and a CI log does not benefit from
 * "thought for 51.4s".
 */
export function progress(label: string): void {
  if (!process.stderr.isTTY) return;
  process.stderr.write(`\r${pc.dim(`  ${label}`.padEnd(78).slice(0, 78))}`);
}

export function clearProgress(): void {
  if (process.stderr.isTTY) process.stderr.write(`\r${' '.repeat(78)}\r`);
}

export function info(text: string): void {
  process.stderr.write(`${text}\n`);
}

export function warn(text: string): void {
  process.stderr.write(`${pc.yellow('!')} ${text}\n`);
}

export function fail(text: string): void {
  process.stderr.write(`${pc.red('✗')} ${text}\n`);
}
