import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildInventory } from '../domain/promise.ts';
import { loadGraph } from './graph.ts';

/**
 * Regression tests against a fully designed graph: 3 use-cases, 16 acceptance
 * criteria, 11 gaps, 5 tests. Produced by running `signedoff init` for real on
 * the Bloom & Vine scope.
 *
 * This fixture exists because the first version of the reader got two things
 * wrong on exactly this data, and both were only visible at this scale.
 */

const FIXTURE = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'test-fixtures',
  'bloom-designed',
);

async function inventory() {
  const graph = await loadGraph(FIXTURE);
  const doc = await readFile(join(FIXTURE, 'scope.md'), 'utf8');
  return { graph, inv: buildInventory(graph, doc) };
}

test('the designed graph loads at full size', async () => {
  const { graph } = await inventory();
  assert.equal(graph.useCases.length, 3);
  assert.equal(graph.acs.length, 16);
  assert.equal(graph.gaps.length, 11);
  assert.equal(graph.tests.length, 5);
});

test('every promise belongs to a named use-case', async () => {
  const { graph, inv } = await inventory();

  // Kane scopes some criteria to a scenario rather than a use-case
  // (ac-10 -> sc-2, ac-11 -> sc-3, ac-13 -> sc-4). Those must resolve
  // transitively through `belongs_to`, otherwise the client is shown an
  // unexplained "Other" group — which is exactly what happened first time.
  for (const ac of graph.acs) {
    assert.ok(
      graph.acToUseCase.has(ac.id),
      `${ac.id} ("${ac.text.slice(0, 40)}…") should resolve to a use-case`,
    );
  }

  const orphaned = inv.promises.filter((p) => p.useCaseTitle === '');
  assert.deepEqual(orphaned, [], 'no promise may be left without a use-case title');
});

test('gaps that name a real criterion block it; the rest become questions', async () => {
  const { inv } = await inventory();

  // Only gap-5 names a resolvable criterion (ac-8, the email promise).
  const blocked = inv.promises.filter((p) => p.question !== undefined);
  assert.equal(blocked.length, 1);
  assert.match(blocked[0]?.text ?? '', /email/i);

  // The other ten reference temp refs (`a1`), use-cases (`uc-3`), tests (`t1`)
  // or named slots (`web-entry-point`) — none of which is a promise. They are
  // questions about the project, and dropping them silently would throw away
  // the most useful thing `init` produces.
  assert.ok(inv.openQuestions.length > 0, 'open questions must be surfaced');
  assert.ok(
    inv.openQuestions.length < 11,
    'duplicate questions (four separate "start URL" gaps) must be collapsed',
  );
});

test('duplicate questions are asked once', async () => {
  const { inv } = await inventory();
  const headers = inv.openQuestions.map((q) => q.header.toLowerCase());
  assert.equal(new Set(headers).size, headers.length, 'each question appears once');
});

test('the Sunday rule is a provable promise', async () => {
  const { inv } = await inventory();

  // The whole demo turns on this one: the scope forbids Sunday delivery, the
  // storefront ships a bug that allows it, and Kane has to catch it.
  const sunday = inv.promises.find((p) => /sunday/i.test(p.text) && /not selectable/i.test(p.text));
  assert.ok(sunday, 'the Sunday rule should be among the promises');
  assert.equal(sunday.checkability, 'checkable');
  assert.ok(sunday.testIds.length > 0, 'a test must cover the Sunday rule');
});

test('the email promise stays unprovable and keeps its reason', async () => {
  const { inv } = await inventory();

  const email = inv.promises.find((p) => p.checkability === 'unmeasurable');
  assert.ok(email, 'the email promise should be unmeasurable');
  assert.match(email.text, /email/i);
  assert.match(email.question?.reason ?? '', /out-of-band|inbox/i);
  assert.equal(inv.counts.unmeasurable, 1);
});
