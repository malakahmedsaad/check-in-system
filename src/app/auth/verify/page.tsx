"use client";

// Purpose: Points users to the OTP sign-in flow after magic-link sign-in was retired.

import Link from "next/link";

export default function VerifyPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 text-slate-950">
      <div className="w-full max-w-[440px] rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
          Use your sign-in code
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          Sign-in links have been replaced with 4-digit email codes.
        </p>
        <Link
          href="/login"
          className="mt-7 inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:scale-[1.02] hover:bg-indigo-500"
        >
          Back to sign in
        </Link>
      </div>
    </main>
  );
}
