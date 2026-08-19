import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildInventory, summarise } from '../domain/promise.ts';
import { loadGraph, quoteAnchor } from './graph.ts';

/**
 * These run against a real Kane assurance graph, committed under
 * `test-fixtures/bloom-scope/`. It was produced by actually running
 * `context ingest` and `design tests` on the Bloom & Vine scope document, so the
 * shapes here are Kane's real output rather than something we invented. If a
 * Kane upgrade changes the store layout, these tests are what will catch it.
 */

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'test-fixtures', 'bloom-scope');

/** The machine-assertion warning Kane emitted for this exact design. */
const REAL_WARNINGS = [
  't1: verifies ac-1 which is still DERIVED (unapproved) — committed anyway; approve it in chat or via review',
  't1: verifies 4 ACs but machine-asserts only 1 (check.verified_against=ac-3) — the rest ride prose only',
  't2: verifies ac-5 which is still DERIVED (unapproved) — committed anyway; approve it in chat or via review',
];

test('loads use-cases with document line anchors', async () => {
  const graph = await loadGraph(FIXTURE);

  assert.equal(graph.useCases.length, 3);
  const titles = graph.useCases.map((u) => u.title).sort();
  assert.deepEqual(titles, [
    'Add an available bouquet to the basket',
    'Browse the bouquet catalogue and prices',
    'Place an order as a guest',
  ]);

  // Provenance is the point: every use-case must cite where it came from.
  for (const uc of graph.useCases) {
    assert.match(uc.anchor ?? '', /^L\d+(-L\d+)?$/, `${uc.id} should carry a line anchor`);
  }
});

test('loads acceptance criteria, gaps and tests', async () => {
  const graph = await loadGraph(FIXTURE);

  assert.equal(graph.acs.length, 6);
  assert.equal(graph.gaps.length, 3);
  assert.equal(graph.tests.length, 2);

  const sunday = graph.acs.find((ac) => ac.text.includes('Sunday'));
  assert.ok(sunday, 'the Sunday rule should be an acceptance criterion');
  assert.equal(sunday.kind, 'forbidden-presence');
  assert.equal(sunday.expected?.operand, 'a selectable Sunday delivery date');
});

test('wires tests to the criteria they verify', async () => {
  const graph = await loadGraph(FIXTURE);

  const sunday = graph.acs.find((ac) => ac.text.includes('Sunday'));
  assert.ok(sunday);
  const verifying = graph.acToTests.get(sunday.id) ?? [];
  assert.ok(verifying.length > 0, 'the Sunday rule must be verified by a test');

  // Every AC belongs to a use-case.
  for (const ac of graph.acs) {
    assert.ok(graph.acToUseCase.has(ac.id), `${ac.id} should be scoped to a use-case`);
  }
});

test('an unmeasurable promise is never reported as checkable', async () => {
  const graph = await loadGraph(FIXTURE);
  const doc = await readFile(join(FIXTURE, 'scope.md'), 'utf8');
  const inventory = buildInventory(graph, doc, REAL_WARNINGS);

  // Kane classified "order is sent to Sarah by email" as unmeasurable: email
  // delivery is not observable in a browser. We must carry that through rather
  // than quietly claiming it passes.
  const email = inventory.promises.find((p) => /email/i.test(p.text));
  assert.ok(email, 'the email promise should exist');
  assert.equal(email.checkability, 'unmeasurable');
  assert.ok(
    (email.question?.reason ?? '').length > 0,
    'an unmeasurable promise must carry the reason the client will read',
  );

  assert.equal(inventory.counts.unmeasurable, 1);
});

test('quotes the client back their own words', async () => {
  const graph = await loadGraph(FIXTURE);
  const doc = await readFile(join(FIXTURE, 'scope.md'), 'utf8');
  const inventory = buildInventory(graph, doc, REAL_WARNINGS);

  const quoted = inventory.promises.filter((p) => p.quote !== undefined);
  assert.ok(quoted.length > 0, 'promises should quote the source document');
});

test('a promise riding on prose is marked observed, not asserted', async () => {
  const graph = await loadGraph(FIXTURE);
  const doc = await readFile(join(FIXTURE, 'scope.md'), 'utf8');
  const inventory = buildInventory(graph, doc, REAL_WARNINGS);

  // Kane warned that t1 machine-asserts only ac-3. The other criteria it claims
  // to verify must be downgraded, because "the test ran and nothing objected"
  // is not the same as "we checked this".
  const asserted = inventory.promises.find((p) => p.id === 'ac-3');
  assert.equal(asserted?.strength, 'asserted');

  const observed = inventory.promises.filter((p) => p.strength === 'observed').map((p) => p.id);
  assert.ok(observed.includes('ac-1'), 'ac-1 rides prose only and must be marked observed');
  assert.ok(!observed.includes('ac-3'), 'ac-3 is machine-asserted');
});

test('summarise counts unproven and uncheckable separately', () => {
  const summary = summarise([
    { id: 'a', text: '', risk: 'high', kind: 'presence', useCaseId: 'uc-1', useCaseTitle: '', checkability: 'checkable', testIds: [], strength: 'asserted', state: 'proven' },
    { id: 'b', text: '', risk: 'high', kind: 'presence', useCaseId: 'uc-1', useCaseTitle: '', checkability: 'checkable', testIds: [], strength: 'asserted', state: 'not_proven' },
    { id: 'c', text: '', risk: 'high', kind: 'propagation', useCaseId: 'uc-1', useCaseTitle: '', checkability: 'unmeasurable', testIds: [], strength: 'asserted', state: 'cannot_check' },
  ]);

  assert.deepEqual(summary, { proven: 1, notProven: 1, cannotCheck: 1, total: 3 });
});

test('quoteAnchor resolves inclusive line ranges', () => {
  const doc = 'one\ntwo\nthree\nfour';
  assert.equal(quoteAnchor(doc, 'L2'), 'two');
  assert.equal(quoteAnchor(doc, 'L2-L3'), 'two three');
  assert.equal(quoteAnchor(doc, 'nonsense'), undefined);
  assert.equal(quoteAnchor(doc, 'L99'), undefined);
});
