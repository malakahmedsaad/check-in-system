"use client";

// Purpose: Renders admin kiosk controls for opening and closing check-ins.

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { useUser } from "../../../../context/UserContext";
import { APP_TIME_ZONE } from "../../../../lib/date-time";

type KioskStatus = {
  isOpen: boolean;
  openedAt: string | null;
  closedAt: string | null;
};

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function formatTimestamp(value: string | null) {
  if (!value) {
    return "Open Now";
  }

  return dateTimeFormatter.format(new Date(value));
}

export default function AdminKioskPage() {
  const { user, isUserLoading, logout } = useUser();
  const [status, setStatus] = useState<KioskStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const isToggleInFlight = useRef(false);

  const loadStatus = useCallback(async (): Promise<KioskStatus | null> => {
    const response = await fetch("/api/admin/kiosk", {
      credentials: "include",
    });

    if (!response.ok) {
      if (response.status === 401) {
        await logout();
        return null;
      }

      throw new Error("Unable to load kiosk status");
    }

    return (await response.json()) as KioskStatus;
  }, [logout]);

  useEffect(() => {
    let isMounted = true;

    async function loadInitialStatus() {
      if (isUserLoading || user?.role !== "admin") {
        setIsLoading(false);
        return;
      }

      try {
        const data = await loadStatus();

        if (isMounted && data) {
          setStatus(data);
        }
      } catch {
        if (isMounted) {
          setError("Unable to load kiosk status");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadInitialStatus();

    return () => {
      isMounted = false;
    };
  }, [isUserLoading, loadStatus, user?.role]);

  async function handleToggle() {
    if (!status || !pin || isToggleInFlight.current) {
      return;
    }

    isToggleInFlight.current = true;
    setIsToggling(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/kiosk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          action: status.isOpen ? "close" : "open",
          pin,
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;

        throw new Error(data?.error ?? "Unable to update kiosk status");
      }

      const data = await loadStatus();

      if (data) {
        setStatus(data);
      }
    } catch (toggleError) {
      setError(
        toggleError instanceof Error
          ? toggleError.message
          : "Unable to update kiosk status",
      );
    } finally {
      isToggleInFlight.current = false;
      setPin("");
      setIsToggling(false);
    }
  }

  const isOpen = status?.isOpen ?? false;

  if (!isUserLoading && user?.role !== "admin") {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
          You don&apos;t have access to this page
        </h1>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-sky-700 via-indigo-700 to-blue-800 p-6 shadow-lg">
        <h1 className="text-2xl font-bold text-white">Kiosk control</h1>
        <p className="mt-1 text-sm text-blue-100">Open or close the visitor check-in experience.</p>
      </div>
      <div className={`w-full rounded-2xl border p-6 shadow-sm sm:p-8 ${isOpen ? "border-green-200 bg-green-50" : "border-slate-200 bg-slate-50"}`}>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase text-slate-500">
              Kiosk status
            </p>
            <h1
              className={`mt-3 text-4xl font-semibold tracking-tight ${
                isOpen ? "text-green-800" : "text-slate-700"
              }`}
            >
              {isLoading
                ? "Loading kiosk..."
                : isOpen
                  ? "Kiosk is OPEN"
                  : "Kiosk is CLOSED"}
            </h1>
          </div>
          <div
            className={`h-16 w-16 rounded-full ring-8 ${
              isOpen
                ? "bg-green-600 ring-green-100"
                : "bg-slate-400 ring-slate-100"
            }`}
            aria-hidden="true"
          />
        </div>

        <dl className="mt-8 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <dt className="text-sm font-medium text-slate-500">Opened at</dt>
            <dd className="mt-2 text-base font-semibold text-slate-900">
              {formatTimestamp(status?.openedAt ?? null)}
            </dd>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <dt className="text-sm font-medium text-slate-500">Closed at</dt>
            <dd className="mt-2 text-base font-semibold text-slate-900">
              {formatTimestamp(status?.closedAt ?? null)}
            </dd>
          </div>
        </dl>

        {error ? (
          <p className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </p>
        ) : null}

        <div className="mt-8 grid gap-3 sm:grid-cols-[minmax(0,12rem)_1fr]">
          <div>
            <label
              htmlFor="kiosk-pin"
              className="block text-sm font-medium text-slate-700"
            >
              PIN
            </label>
            <input
              id="kiosk-pin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={pin}
              onChange={(event) => setPin(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-slate-100"
            />
          </div>
          <button
            type="button"
            onClick={handleToggle}
            disabled={isLoading || isToggling || !status || !pin}
            className={`self-end rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 ${
              isOpen
                ? "bg-red-600 hover:bg-red-700 focus:ring-red-500"
                : "bg-green-600 hover:bg-green-700 focus:ring-green-500"
            }`}
          >
            {isToggling
              ? "Updating kiosk..."
              : isOpen
                ? "Close kiosk"
                : "Open kiosk for today"}
          </button>
        </div>

        {isOpen ? (
          <Link
            href="/"
            className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:w-auto"
          >
            Open sign-in page
          </Link>
        ) : null}
      </div>
    </div>
  );
}
