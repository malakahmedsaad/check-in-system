"use client";

// Purpose: Renders the magic-link sign-in page for students and mentors.

import { FormEvent, useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sentEmail, setSentEmail] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const normalizedEmail = email.trim();
      const response = await fetch("/api/auth/request-link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: normalizedEmail }),
      });

      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(data?.error ?? "Unable to send sign-in link");
      }

      setSentEmail(normalizedEmail);
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : "Unable to sign in",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 text-slate-950">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 flex flex-col items-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-indigo-100 bg-white text-lg font-semibold text-indigo-600 shadow-sm">
            BC
          </div>
          <p className="mt-3 text-sm font-medium text-slate-500">
            Bechtel Center Check-In
          </p>
        </div>

        {sentEmail ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
              Check your email
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              We sent a sign-in link to{" "}
              <span className="font-semibold text-slate-700">{sentEmail}</span>.
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm"
          >
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
                Sign in to your account
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Use your Purdue institutional email to continue.
              </p>
            </div>

            <div className="mt-7">
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-700"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="yourname@purdue.edu"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-950 outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
              />
              {error ? (
                <p className="mt-2 text-sm font-medium text-red-600">{error}</p>
              ) : null}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="mt-7 w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:scale-[1.02] hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:hover:scale-100"
            >
              {isLoading ? "Sending link..." : "Send sign-in link"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
