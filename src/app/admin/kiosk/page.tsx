"use client";

import { useCallback, useEffect, useState } from "react";

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
    return "Not recorded";
  }

  return dateTimeFormatter.format(new Date(value));
}

export default function AdminKioskPage() {
  const { user, isUserLoading, logout } = useUser();
  const [status, setStatus] = useState<KioskStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      if (isUserLoading || !user?.isAdmin) {
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
  }, [isUserLoading, loadStatus, user?.isAdmin]);

  async function handleToggle() {
    if (!status) {
      return;
    }

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
      setIsToggling(false);
    }
  }

  const isOpen = status?.isOpen ?? false;

  if (!isUserLoading && !user?.isAdmin) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
          You don&apos;t have access to this page
        </h1>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-12rem)] items-center">
      <div className="w-full rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase text-slate-500">
              Kiosk status
            </p>
            <h1
              className={`mt-3 text-4xl font-semibold tracking-tight ${
                isOpen ? "text-emerald-700" : "text-slate-700"
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
                ? "bg-emerald-500 ring-emerald-100"
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

        <button
          type="button"
          onClick={handleToggle}
          disabled={isLoading || isToggling || !status}
          className={`mt-8 w-full rounded-lg px-5 py-4 text-base font-semibold text-white transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:hover:scale-100 ${
            isOpen
              ? "bg-slate-800 hover:bg-slate-700"
              : "bg-emerald-600 hover:bg-emerald-500"
          }`}
        >
          {isToggling
            ? "Updating kiosk..."
            : isOpen
              ? "Close kiosk"
              : "Open kiosk for today"}
        </button>
      </div>
    </div>
  );
}
