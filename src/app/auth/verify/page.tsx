"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

type VerifyState = "loading" | "error";

function VerifyMagicLink() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<VerifyState>("loading");

  useEffect(() => {
    let isMounted = true;
    const token = searchParams.get("token");

    async function verifyLink() {
      if (!token) {
        setState("error");
        return;
      }

      try {
        const response = await fetch("/api/auth/verify-link", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token }),
        });

        const data = (await response.json().catch(() => null)) as {
          user?: {
            role: string;
          };
        } | null;

        if (!response.ok || !data?.user) {
          throw new Error("Invalid link");
        }

        if (!isMounted) {
          return;
        }

        router.replace(data.user.role === "mentor" ? "/mentor" : "/dashboard");
      } catch {
        if (isMounted) {
          setState("error");
        }
      }
    }

    verifyLink();

    return () => {
      isMounted = false;
    };
  }, [router, searchParams]);

  if (state === "error") {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
          This link is invalid or has expired.
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          Please request a new one.
        </p>
        <Link
          href="/login"
          className="mt-7 inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:scale-[1.02] hover:bg-indigo-500"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
        Verifying your sign-in link...
      </h1>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 text-slate-950">
      <div className="w-full max-w-[440px]">
        <Suspense
          fallback={
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
                Verifying your sign-in link...
              </h1>
            </div>
          }
        >
          <VerifyMagicLink />
        </Suspense>
      </div>
    </main>
  );
}
