"use client";

import { FormEvent, KeyboardEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useUser } from "../../../context/UserContext";

type AuthUser = { name: string; email: string; role: string };

export default function LoginPage() {
  const router = useRouter();
  const { setAuthenticatedUser } = useUser();
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const verifyingRef = useRef(false);
  const [email, setEmail] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [digits, setDigits] = useState(["", "", "", ""]);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  async function requestCode(address: string) {
    const response = await fetch("/api/auth/request-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: address }),
    });
    const data = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;

    if (!response.ok) {
      throw new Error(data?.error ?? "Unable to send code");
    }
  }

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim();
    setError("");
    setIsSending(true);

    try {
      await requestCode(normalizedEmail);
      setSubmittedEmail(normalizedEmail);
      setDigits(["", "", "", ""]);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Unable to send code",
      );
    } finally {
      setIsSending(false);
    }
  }

  async function verifyCode(code: string) {
    if (code.length !== 4 || verifyingRef.current) return;

    verifyingRef.current = true;
    setIsVerifying(true);
    setError("");
    setConfirmation("");

    try {
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: submittedEmail, code }),
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
        user?: AuthUser;
      } | null;

      if (!response.ok || !data?.user) {
        throw new Error(data?.error ?? "Unable to verify code");
      }

      setAuthenticatedUser(data.user);
      router.push(data.user.role === "mentor" ? "/mentor" : "/dashboard");
    } catch (verifyError) {
      setDigits(["", "", "", ""]);
      setError(
        verifyError instanceof Error ? verifyError.message : "Unable to verify code",
      );
      inputRefs.current[0]?.focus();
    } finally {
      verifyingRef.current = false;
      setIsVerifying(false);
    }
  }

  function handleDigitChange(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const nextDigits = [...digits];
    nextDigits[index] = digit;
    setDigits(nextDigits);
    setError("");

    if (digit && index < 3) inputRefs.current[index + 1]?.focus();
    if (nextDigits.every(Boolean)) void verifyCode(nextDigits.join(""));
  }

  function handleDigitKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  async function handleResend() {
    setError("");
    setConfirmation("");
    setIsSending(true);

    try {
      await requestCode(submittedEmail);
      setDigits(["", "", "", ""]);
      setConfirmation("New code sent");
      inputRefs.current[0]?.focus();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Unable to send code",
      );
    } finally {
      setIsSending(false);
    }
  }

  function useDifferentEmail() {
    setSubmittedEmail("");
    setEmail("");
    setDigits(["", "", "", ""]);
    setError("");
    setConfirmation("");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 text-slate-950">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 flex flex-col items-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-indigo-100 bg-white text-lg font-semibold text-indigo-600 shadow-sm">BC</div>
          <p className="mt-3 text-sm font-medium text-slate-500">Bechtel Center Check-In</p>
        </div>

        {submittedEmail ? (
          <form onSubmit={(event) => { event.preventDefault(); void verifyCode(digits.join("")); }} className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
            <h1 className="text-2xl font-semibold tracking-tight">Check your email</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              We sent a 4-digit code to <span className="font-semibold text-slate-700">{submittedEmail}</span>. Enter it below.
            </p>

            <div className="mt-7 flex justify-center gap-4">
              {digits.map((digit, index) => (
                <input
                  key={index}
                  ref={(element) => { inputRefs.current[index] = element; }}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]"
                  maxLength={1}
                  aria-label={`Code digit ${index + 1}`}
                  value={digit}
                  onChange={(event) => handleDigitChange(index, event.target.value)}
                  onKeyDown={(event) => handleDigitKeyDown(index, event)}
                  autoFocus={index === 0}
                  className="h-16 w-14 rounded-lg border border-slate-300 bg-white text-center text-[28px] font-semibold outline-none transition-colors focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                />
              ))}
            </div>

            {error ? <p className="mt-3 text-center text-sm font-medium text-red-600">{error}</p> : null}
            {confirmation ? <p className="mt-3 text-center text-sm font-medium text-emerald-600">{confirmation}</p> : null}

            <button type="submit" disabled={isVerifying || digits.some((digit) => !digit)} className="mt-7 w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:scale-[1.02] hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:hover:scale-100">
              {isVerifying ? "Verifying..." : "Verify"}
            </button>
            <button type="button" onClick={() => void handleResend()} disabled={isSending} className="mt-4 w-full text-sm font-medium text-indigo-600 hover:text-indigo-500 disabled:text-slate-400">
              {isSending ? "Sending..." : "Resend code"}
            </button>
            <button type="button" onClick={useDifferentEmail} className="mt-3 w-full text-sm font-medium text-slate-600 hover:text-slate-900">Use a different email</button>
          </form>
        ) : (
          <form onSubmit={handleEmailSubmit} className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
            <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">Enter your Purdue email address and we&apos;ll send you a code</p>
            <div className="mt-7">
              <label htmlFor="email" className="block text-sm font-medium text-slate-700">Email</label>
              <input id="email" name="email" type="email" placeholder="yourname@purdue.edu" value={email} onChange={(event) => setEmail(event.target.value)} required className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" />
              {error ? <p className="mt-2 text-sm font-medium text-red-600">{error}</p> : null}
            </div>
            <button type="submit" disabled={isSending} className="mt-7 w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:scale-[1.02] hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:hover:scale-100">
              {isSending ? "Sending..." : "Send code"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
