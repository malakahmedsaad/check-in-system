"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { useUser } from "../../../context/UserContext";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useUser();
  const router = useRouter();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      await login(email);
      router.push("/dashboard");
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
            {isLoading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
