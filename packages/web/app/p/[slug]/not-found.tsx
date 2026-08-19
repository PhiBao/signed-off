export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-5 py-24 text-center">
      <h1 className="font-display text-2xl">This handover link isn&rsquo;t valid</h1>
      <p className="mt-3 text-muted text-sm leading-relaxed">
        The link may have expired, or it may have been copied incompletely. Ask whoever sent it to
        you for a fresh one.
      </p>
    </div>
  );
}
