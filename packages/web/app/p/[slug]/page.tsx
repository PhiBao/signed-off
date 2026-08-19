import { notFound } from 'next/navigation';
import { latestSignOff, readBundle, readSignOffs, type BundlePromise } from '@/lib/store';
import { PromiseRow } from './promise-row';
import { SignOffForm } from './signoff-form';

/**
 * The handover page.
 *
 * This is the surface the whole product exists to produce, and its only reader
 * is someone non-technical who is being asked to release money. It is modelled
 * on a signed delivery note, not a test report: no test names, no ids, no
 * coverage percentages, no dashboard. Each row is a thing they asked for, in
 * their words, with the option to see it happen.
 *
 * It opens with no account and no install, on a phone, and it prints.
 */

interface PageProps {
  readonly params: Promise<{ slug: string }>;
}

export default async function HandoverPage({ params }: PageProps) {
  const { slug } = await params;
  const bundle = await readBundle(slug);
  if (bundle === undefined) notFound();

  const signOffs = await readSignOffs(slug);
  const signed = latestSignOff(signOffs);
  const { summary } = bundle;

  // Group promises the way the work was scoped, preserving order.
  const groups: { title: string; promises: BundlePromise[] }[] = [];
  for (const promise of bundle.promises) {
    const title = promise.groupTitle === '' ? 'Everything else' : promise.groupTitle;
    const existing = groups.find((g) => g.title === title);
    if (existing === undefined) groups.push({ title, promises: [promise] });
    else existing.promises.push(promise);
  }

  const outstanding = summary.notProven;
  const allProven = outstanding === 0 && summary.cannotCheck === 0;

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:py-14">
      <header>
        <p className="text-sm text-muted">
          Milestone {bundle.milestone}
          {bundle.client === '' ? '' : ` · for ${bundle.client}`}
        </p>
        <h1 className="mt-1 font-display text-2xl sm:text-3xl leading-tight">{bundle.title}</h1>
      </header>

      {/* The headline. Stated as plainly as possible. */}
      <section className="mt-8 rounded-2xl border border-line bg-card p-5 sm:p-6">
        <p className="font-display text-xl sm:text-2xl leading-snug">
          {allProven
            ? `All ${summary.total} things you asked for are proven.`
            : `${summary.proven} of ${summary.total} things you asked for are proven.`}
        </p>

        {!allProven && (
          <ul className="mt-3 grid gap-1 text-sm">
            {outstanding > 0 && (
              <li className="text-unproven">
                {outstanding} {outstanding === 1 ? 'is' : 'are'} not proven yet.
              </li>
            )}
            {summary.cannotCheck > 0 && (
              <li className="text-unknown">
                {summary.cannotCheck} {summary.cannotCheck === 1 ? "couldn't" : "couldn't"} be
                checked in a browser — the reason is given below.
              </li>
            )}
          </ul>
        )}

        <p className="mt-4 text-sm text-muted leading-relaxed">
          Each line below was checked by opening the real website in a real browser and doing what a
          customer would do. Open <em>Show me</em> on any line to see what happened.
        </p>
      </section>

      {signed !== undefined && (
        <section
          className={`mt-5 rounded-xl border p-4 text-sm ${
            signed.verdict === 'accepted'
              ? 'border-proven/30 bg-proven-soft text-proven'
              : 'border-unproven/30 bg-unproven-soft text-unproven'
          }`}
        >
          {signed.verdict === 'accepted' ? (
            <p>
              <strong>{signed.name}</strong> accepted this on{' '}
              {new Date(signed.at).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
              .
            </p>
          ) : (
            <p>
              <strong>{signed.name}</strong> flagged a problem with this handover.
            </p>
          )}
          {signed.note !== undefined && signed.note !== '' && (
            <p className="mt-1.5 italic">&ldquo;{signed.note}&rdquo;</p>
          )}
        </section>
      )}

      {groups.map((group) => {
        // The contract quote belongs to the group, not to each promise: Kane
        // derives a whole use-case from a line range, so repeating it on every
        // row implied a precision that was not there.
        const quote = group.promises.find((p) => p.quote !== undefined)?.quote;

        return (
          <section key={group.title} className="mt-9">
            <h2 className="font-display text-lg">{group.title}</h2>
            {quote !== undefined && (
              <p className="mt-1.5 mb-1 text-sm text-muted border-l-2 border-line pl-3 italic">
                You asked for: &ldquo;{quote}&rdquo;
              </p>
            )}
            <ul>
              {group.promises.map((promise) => (
                <PromiseRow key={promise.id} promise={promise} />
              ))}
            </ul>
          </section>
        );
      })}

      <SignOffForm
        slug={bundle.slug}
        runId={bundle.run.id}
        milestone={bundle.milestone}
        alreadySigned={signed?.verdict === 'accepted'}
        outstanding={outstanding}
      />

      {/* For the sceptical reader: this page is a rendering, and the underlying
          record can be checked without trusting us or the developer. */}
      <footer className="mt-12 pt-6 border-t border-line text-sm text-muted grid gap-3">
        <p>
          Checked on{' '}
          {new Date(bundle.createdAt).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}{' '}
          in {bundle.run.browser}, by {bundle.run.producer}.
        </p>

        <details>
          <summary className="underline decoration-line hover:decoration-ink">
            Check this yourself
          </summary>
          <div className="mt-2 grid gap-2">
            <p>
              This page is generated from a sealed evidence file. Anyone can verify that the file
              has not been altered and that its results match its own recordings, without trusting
              this website:
            </p>
            <code className="block font-mono text-xs bg-paper border border-line rounded-md p-2.5 overflow-x-auto">
              kane-cli evidence validate &lt;file&gt; --profile L1
            </code>
            <p className="text-xs">
              Reference <span className="font-mono">{bundle.run.id}</span>
              {bundle.packOffered
                ? ' — ask your developer for the evidence file.'
                : ' — the evidence file was not published with this page.'}
            </p>
          </div>
        </details>

        <p className="text-xs no-print">
          Made with <strong>Signed Off</strong>.
        </p>
      </footer>
    </div>
  );
}
