"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-text">
      <section className="w-full max-w-lg rounded-md border border-white/10 bg-white/[0.035] p-6 text-center shadow-panel backdrop-blur-xl">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md border border-rose-300/25 bg-rose-300/10 text-rose-200">
          <TriangleAlert className="h-5 w-5" aria-hidden="true" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold text-white">
          Something failed
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          OpenBench hit an unexpected UI or data boundary. The app can retry the
          current view without losing the project state.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-semibold text-white transition hover:bg-blue-400 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background"
        >
          Retry
        </button>
      </section>
    </main>
  );
}
