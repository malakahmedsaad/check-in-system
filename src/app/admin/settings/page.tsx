"use client";

// Purpose: Renders admin settings for changing the shared admin PIN.

import { FormEvent, useRef, useState } from "react";

import { useUser } from "../../../../context/UserContext";

export default function AdminSettingsPage() {
  const { logout } = useUser();
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const isSaveInFlight = useRef(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSaveInFlight.current) {
      return;
    }

    setError(null);
    setSuccess(null);

    if (newPin !== confirmPin) {
      setError("New PIN and confirmation do not match.");
      return;
    }

    isSaveInFlight.current = true;
    setIsSaving(true);

    try {
      const response = await fetch("/api/admin/settings/pin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          currentPin,
          newPin,
        }),
      });

      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          await logout();
          return;
        }

        throw new Error(data?.error ?? "Unable to update PIN");
      }

      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
      setSuccess("PIN updated.");
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Unable to update PIN",
      );
    } finally {
      isSaveInFlight.current = false;
      setIsSaving(false);
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Settings
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Manage the staff PIN used for admin sign-in and kiosk controls.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Admin PIN</h2>
        </div>

        <div className="mt-6 space-y-5">
          <div>
            <label
              htmlFor="current-pin"
              className="block text-sm font-medium text-slate-700"
            >
              Current PIN
            </label>
            <input
              id="current-pin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={currentPin}
              onChange={(event) => setCurrentPin(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-slate-100"
              required
            />
          </div>

          <div>
            <label
              htmlFor="new-pin"
              className="block text-sm font-medium text-slate-700"
            >
              New PIN
            </label>
            <input
              id="new-pin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]{4,6}"
              maxLength={6}
              value={newPin}
              onChange={(event) => setNewPin(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-slate-100"
              required
            />
          </div>

          <div>
            <label
              htmlFor="confirm-pin"
              className="block text-sm font-medium text-slate-700"
            >
              Confirm new PIN
            </label>
            <input
              id="confirm-pin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]{4,6}"
              maxLength={6}
              value={confirmPin}
              onChange={(event) => setConfirmPin(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-slate-100"
              required
            />
          </div>
        </div>

        {error ? (
          <p className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </p>
        ) : null}

        {success ? (
          <p className="mt-5 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            {success}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSaving}
          className="mt-7 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Save PIN"}
        </button>
      </form>
    </div>
  );
}
