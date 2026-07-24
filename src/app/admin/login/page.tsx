"use client";

// Purpose: Renders the admin email and PIN sign-in form.

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { useUser } from "../../../../context/UserContext";

export default function AdminLoginPage() {
  const router = useRouter();
  const { setAuthenticatedUser } = useUser();
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          pin,
        }),
      });

      const data = (await response.json().catch(() => null)) as {
        error?: string;
        user?: {
          name: string;
          email: string;
          role: string;
        };
      } | null;

      if (!response.ok) {
        throw new Error(data?.error ?? "Unable to sign in");
      }

      if (data?.user) {
        setAuthenticatedUser(data.user);
      }

      router.push("/admin/overview");
    } catch (loginError) {
      setError(
        loginError instanceof Error ? loginError.message : "Unable to sign in",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 text-slate-900">
      <div className="w-full max-w-md space-y-8">
        <div className="mb-8 flex flex-col items-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-indigo-100 bg-white text-lg font-semibold text-indigo-600 shadow-sm">
            BC
          </div>
          <p className="mt-3 text-sm font-medium text-slate-500">
            Bechtel Center Staff
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
        >
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Staff sign in
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Enter the staff email and kiosk PIN to continue.
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
              placeholder="staff@purdue.edu"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-slate-100"
            />
          </div>

          <div className="mt-5">
            <label
              htmlFor="pin"
              className="block text-sm font-medium text-slate-700"
            >
              PIN
            </label>
            <input
              id="pin"
              name="pin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={pin}
              onChange={(event) => setPin(event.target.value)}
              required
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-slate-100"
            />
            {error ? (
              <p className="mt-2 text-sm font-medium text-red-600">{error}</p>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="mt-7 w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {isLoading ? <><span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Signing in...</> : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
