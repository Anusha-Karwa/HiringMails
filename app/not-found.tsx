import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card mx-auto max-w-md text-center">
      <h1 className="font-display text-2xl font-semibold text-ink">Not found</h1>
      <p className="mt-1 text-sm text-muted">That candidate may have been deleted.</p>
      <Link href="/" className="btn-primary mt-5">
        Back to the ranking
      </Link>
    </div>
  );
}
