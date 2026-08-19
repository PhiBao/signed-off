import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { corroborate, forbiddenTerm, verdictsFromPack } from '../domain/verdict.ts';
import { readPack } from './pack.ts';

/**
 * These run against `sunday-false-pass.evidence` — a real sealed pack from a
 * real Kane run against the Bloom & Vine storefront.
 *
 * That run reported `passed` for the criterion "Sunday is not shown as the
 * selected delivery date" while the storefront was genuinely offering three
 * Sundays. The generated assertion compared the `<select>` element's value
 * (`2026-08-23`) rather than its visible text (`Sunday 23 August`), so it never
 * saw the violation.
 *
 * The pack is kept as a fixture precisely because it is a false pass. It is the
 * hardest case the product has to get right, and the one that justifies the
 * whole three-state verdict model.
 */

const PACK = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'test-fixtures',
  'packs',
  'sunday-false-pass.evidence',
);

test('reads the sealed pack', () => {
  const pack = readPack(PACK);

  assert.equal(pack.run.status, 'finalized');
  assert.match(pack.run.producer, /kane-cli/);
  assert.equal(pack.run.totals.tests, 1);
  assert.equal(pack.run.totals.passed, 1);
  assert.equal(pack.run.totals.failed, 0, 'Kane reported this run as fully passing');
});

test('reads coverage, provenance and the embedded source document', () => {
  const pack = readPack(PACK);

  assert.ok(pack.criteria.length >= 10, 'the pack carries the whole coverage projection');
  assert.ok(pack.useCases.length >= 1);

  // The client's own document travels inside the pack, so a handover page can
  // quote the contract without needing the maker's working copy.
  assert.ok(pack.sources.size >= 1, 'the source document is embedded');
  const scope = pack.sources.get('scope');
  assert.ok(scope !== undefined && scope.includes('Sunday'), 'the scope text is readable');

  const withProvenance = pack.criteria.filter((c) => c.derivedFrom !== undefined);
  assert.ok(withProvenance.length > 0, 'criteria cite where in the document they came from');
});

test('collects what the run actually observed', () => {
  const pack = readPack(PACK);

  assert.ok(pack.observations.length > 0, 'observations are recoverable from the logs');

  const sundayEvidence = pack.observations.find((o) => o.value.includes('Sunday 23 August'));
  assert.ok(
    sundayEvidence !== undefined,
    'the pack contains the observation that disproves its own verdict',
  );
});

test('extracts the distinctive term from a forbidden-presence operand', () => {
  assert.equal(
    forbiddenTerm('Sunday shown as the selected delivery date after the selection attempt'),
    'Sunday',
  );
  assert.equal(forbiddenTerm("a selectable 'Sunday' delivery date"), 'Sunday');
  // No proper noun and no quoted literal means the check must not run at all.
  assert.equal(forbiddenTerm('a mandatory account-creation step before order submission'), undefined);
});

test('evidence contradicting a passing assertion is caught', () => {
  const pack = readPack(PACK);

  const sunday = pack.criteria.find(
    (c) => c.kind === 'forbidden-presence' && /Sunday/.test(c.operand ?? ''),
  );
  assert.ok(sunday, 'the Sunday criterion should be in the pack');
  assert.equal(sunday.execution, 'passed', 'Kane recorded this as passing');

  const result = corroborate(sunday, pack.observations);
  assert.equal(result.contradicted, true, 'the evidence must be recognised as contradicting');
  assert.match(result.observed ?? '', /Sunday/);
  assert.match(result.detail ?? '', /promised not to happen/);
});

test('page copy naming the forbidden thing is not a violation', () => {
  const pack = readPack(PACK);

  // The checkout page says "We deliver Monday to Saturday. Sundays are not
  // available." Reading reassuring copy as a violation would make the product
  // cry wolf on correct implementations.
  const copy = pack.observations.filter((o) => /validation|message/i.test(o.key));
  assert.ok(copy.length > 0, 'the fixture does contain page copy mentioning Sunday');

  const sunday = pack.criteria.find(
    (c) => c.kind === 'forbidden-presence' && /Sunday/.test(c.operand ?? ''),
  );
  assert.ok(sunday);
  assert.equal(corroborate(sunday, copy).contradicted, false);
});

test('the Sunday promise is reported as NOT proven despite the green run', () => {
  const pack = readPack(PACK);
  const promises = verdictsFromPack(pack);

  const sunday = promises.find((p) => /Sunday/.test(p.text) && p.kind === 'forbidden-presence');
  assert.ok(sunday, 'the Sunday promise should be present');
  assert.equal(
    sunday.state,
    'not_proven',
    'a promise the evidence disproves must never be shown as proven',
  );
  assert.match(sunday.why ?? '', /Sunday/);
});

test('criteria nobody ran are cannot_check, never not_proven', () => {
  const pack = readPack(PACK);
  const promises = verdictsFromPack(pack);

  for (const promise of promises) {
    const criterion = pack.criteria.find((c) => c.id === promise.id);
    if (criterion?.execution === 'not-run') {
      assert.equal(
        promise.state,
        'cannot_check',
        `${promise.id}: absence of evidence is not evidence of a defect`,
      );
      assert.ok(promise.why !== undefined, 'and it must explain itself');
    }
  }
});
