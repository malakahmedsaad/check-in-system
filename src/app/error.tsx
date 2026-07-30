"use client";

// Purpose: Provides a friendly fallback for unhandled application errors.

import Link from "next/link";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-9 w-9"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          >
            <path d="M10.3 3.7 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0Z" />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
          </svg>
        </div>
        <h1 className="mt-6 text-2xl font-bold text-slate-900">
          Something went wrong
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          An unexpected error occurred. Please try refreshing the page.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-8 inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          Try again
        </button>
        <div className="mt-4">
          <Link
            href="/"
            className="text-sm font-semibold text-slate-600 transition hover:text-slate-900"
          >
            Go back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
