"use client";

// Purpose: Renders the OTP sign-in page for students and mentors.

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { useUser } from "../../../context/UserContext";

export default function LoginPage() {
  const router = useRouter();
  const { setAuthenticatedUser } = useUser();
  const [email, setEmail] = useState("");
  const [sentEmail, setSentEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleRequestCode(event: FormEvent<HTMLFormElement>) {
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
        throw new Error(data?.error ?? "Unable to send sign-in code");
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

  async function handleVerifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/verify-link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({
          email: sentEmail,
          code: code.trim(),
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

      if (!response.ok || !data?.user) {
        throw new Error(data?.error ?? "Unable to verify sign-in code");
      }

      setAuthenticatedUser(data.user);
      router.push(data.user.role === "mentor" ? "/mentor" : "/dashboard");
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : "Unable to verify sign-in code",
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
          <form
            onSubmit={handleVerifyCode}
            className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm"
          >
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
                Enter your code
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                We sent a 4-digit sign-in code to{" "}
                <span className="font-semibold text-slate-700">
                  {sentEmail}
                </span>
                .
              </p>
            </div>

            <div className="mt-7">
              <label
                htmlFor="code"
                className="block text-sm font-medium text-slate-700"
              >
                Code
              </label>
              <input
                id="code"
                name="code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{4}"
                maxLength={4}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                required
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-center text-2xl font-semibold text-slate-950 outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
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
              {isLoading ? "Verifying..." : "Verify code"}
            </button>

            <button
              type="button"
              onClick={() => {
                setSentEmail("");
                setCode("");
                setError("");
              }}
              className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:scale-[1.02] hover:border-slate-400 hover:bg-slate-50"
            >
              Use a different email
            </button>
          </form>
        ) : (
          <form
            onSubmit={handleRequestCode}
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
              {isLoading ? "Sending code..." : "Send sign-in code"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
