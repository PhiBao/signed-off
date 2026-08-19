import { listBundleSlugs, readBundle } from '@/lib/store';

/**
 * Index of published handovers.
 *
 * Not part of the client experience — a client only ever receives a direct link.
 * This exists so a maker (and the judges) can find what has been published on a
 * locally running instance.
 */
export default async function Home() {
  const slugs = await listBundleSlugs();
  const bundles = (await Promise.all(slugs.map(readBundle))).flatMap((b) => (b === undefined ? [] : [b]));

  return (
    <div className="mx-auto max-w-2xl px-5 py-14">
      <h1 className="font-display text-2xl">Signed Off</h1>
      <p className="mt-2 text-muted text-sm">
        Proof that delivered work does what was asked for.
      </p>

      {bundles.length === 0 ? (
        <div className="mt-8 rounded-xl border border-line bg-card p-5">
          <p className="text-sm">Nothing has been published yet.</p>
          <p className="mt-2 text-sm text-muted">
            From a project directory, run{' '}
            <code className="font-mono text-xs">signedoff publish --milestone 1</code>.
          </p>
        </div>
      ) : (
        <ul className="mt-8 grid gap-3">
          {bundles.map((bundle) => (
            <li key={bundle.slug}>
              <a
                href={`/p/${bundle.slug}`}
                className="block rounded-xl border border-line bg-card p-4 hover:border-ink transition-colors"
              >
                <p className="font-medium">{bundle.title}</p>
                <p className="mt-1 text-sm text-muted">
                  Milestone {bundle.milestone} · {bundle.summary.proven} of {bundle.summary.total}{' '}
                  proven
                  {bundle.summary.notProven > 0 && ` · ${bundle.summary.notProven} not proven`}
                </p>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
