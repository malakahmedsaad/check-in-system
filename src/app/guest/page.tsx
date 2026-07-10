"use client";

// Purpose: Renders the public guest check-in form.

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type GuestField = "name" | "email" | "purpose";

type FieldErrors = Partial<Record<GuestField, string>>;
const MAX_NAME_LENGTH = 120;
const MAX_EMAIL_LENGTH = 254;
const MAX_PURPOSE_LENGTH = 1000;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-10 w-10"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export default function GuestPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [purpose, setPurpose] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [submittedName, setSubmittedName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmitInFlight = useRef(false);

  function validateForm() {
    const errors: FieldErrors = {};
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedPurpose = purpose.trim();

    if (!trimmedName) {
      errors.name = "Name is required";
    } else if (trimmedName.length > MAX_NAME_LENGTH) {
      errors.name = `Name must be ${MAX_NAME_LENGTH} characters or fewer`;
    }

    if (!trimmedEmail) {
      errors.email = "Email is required";
    } else if (trimmedEmail.length > MAX_EMAIL_LENGTH) {
      errors.email = `Email must be ${MAX_EMAIL_LENGTH} characters or fewer`;
    } else if (!emailPattern.test(trimmedEmail)) {
      errors.email = "Enter a valid email address";
    }

    if (!trimmedPurpose) {
      errors.purpose = "Purpose of visit is required";
    } else if (trimmedPurpose.length > MAX_PURPOSE_LENGTH) {
      errors.purpose = `Purpose must be ${MAX_PURPOSE_LENGTH} characters or fewer`;
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    if (isSubmitInFlight.current) {
      return;
    }

    if (!validateForm()) {
      return;
    }

    isSubmitInFlight.current = true;
    setIsSubmitting(true);

    try {
      const trimmedName = name.trim();
      const response = await fetch("/api/guest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: trimmedName,
          email: email.trim(),
          purpose: purpose.trim(),
        }),
      });

      const data = (await response.json().catch(() => null)) as {
        field?: GuestField;
        error?: string;
      } | null;

      if (!response.ok) {
        if (data?.field && data.error) {
          setFieldErrors({ [data.field]: data.error });
          return;
        }

        throw new Error(data?.error ?? "Unable to log your visit");
      }

      setSubmittedName(trimmedName);
    } catch (submitError) {
      setFormError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to log your visit",
      );
    } finally {
      isSubmitInFlight.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 text-slate-950">
      <div className="w-full max-w-[480px]">
        <div className="mb-8 flex flex-col items-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-indigo-100 bg-white text-lg font-semibold text-indigo-600 shadow-sm">
            BC
          </div>
          <p className="mt-3 text-sm font-medium text-slate-500">
            Bechtel Center Check-In Kiosk
          </p>
        </div>

        {submittedName ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckIcon />
            </div>
            <h1 className="mt-6 text-2xl font-semibold tracking-tight text-slate-950">
              Thanks, {submittedName}! Your visit has been logged.
            </h1>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="mt-7 w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:scale-[1.02] hover:bg-indigo-500"
            >
              Done
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm"
          >
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
                Welcome to the Bechtel Center for Innovation and Design!
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">
               tell us about your visit today
              </p>
            </div>

            <div className="mt-7">
              <label
                htmlFor="name"
                className="block text-sm font-medium text-slate-700"
              >
                Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                value={name}
                maxLength={MAX_NAME_LENGTH}
                onChange={(event) => {
                  setName(event.target.value);
                  setFieldErrors((current) => ({ ...current, name: "" }));
                }}
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-950 outline-none transition-colors focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
              />
              {fieldErrors.name ? (
                <p className="mt-2 text-sm font-medium text-red-600">
                  {fieldErrors.name}
                </p>
              ) : null}
            </div>

            <div className="mt-5">
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
                value={email}
                maxLength={MAX_EMAIL_LENGTH}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setFieldErrors((current) => ({ ...current, email: "" }));
                }}
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-950 outline-none transition-colors focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
              />
              {fieldErrors.email ? (
                <p className="mt-2 text-sm font-medium text-red-600">
                  {fieldErrors.email}
                </p>
              ) : null}
            </div>

            <div className="mt-5">
              <label
                htmlFor="purpose"
                className="block text-sm font-medium text-slate-700"
              >
                Purpose of visit
              </label>
              <textarea
                id="purpose"
                name="purpose"
                placeholder="e.g. meeting with a mentor, dropping something off"
                value={purpose}
                maxLength={MAX_PURPOSE_LENGTH}
                onChange={(event) => {
                  setPurpose(event.target.value);
                  setFieldErrors((current) => ({ ...current, purpose: "" }));
                }}
                rows={4}
                className="mt-2 w-full resize-none rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-950 outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
              />
              {fieldErrors.purpose ? (
                <p className="mt-2 text-sm font-medium text-red-600">
                  {fieldErrors.purpose}
                </p>
              ) : null}
            </div>

            {formError ? (
              <p className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {formError}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-7 w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:scale-[1.02] hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:hover:scale-100"
            >
              {isSubmitting ? "Submitting..." : "Submit"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
