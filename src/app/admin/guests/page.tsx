"use client";

import { useEffect, useState } from "react";

import { useUser } from "../../../../context/UserContext";
import { APP_TIME_ZONE } from "../../../../lib/date-time";

type Guest = {
  id: string;
  name: string;
  email: string;
  purpose: string;
  visitedAt: string;
};

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function formatDateTime(value: string) {
  return dateTimeFormatter.format(new Date(value));
}

export default function AdminGuestsPage() {
  const { logout } = useUser();
  const [date, setDate] = useState("");
  const [guests, setGuests] = useState<Guest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadGuests() {
      setIsLoading(true);
      setError(null);

      try {
        const query = date ? `?date=${encodeURIComponent(date)}` : "";
        const response = await fetch(`/api/admin/guests${query}`, {
          credentials: "include",
        });

        if (!isMounted) {
          return;
        }

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            await logout();
            return;
          }

          const data = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(data?.error ?? "Unable to load guest visits");
        }

        setGuests((await response.json()) as Guest[]);
      } catch (loadError) {
        if (isMounted) {
          setGuests([]);
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load guest visits",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadGuests();

    return () => {
      isMounted = false;
    };
  }, [date, logout]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
            Guests
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Review public guest check-ins.
          </p>
        </div>
        <div>
          <label
            htmlFor="guest-date"
            className="block text-sm font-medium text-slate-700"
          >
            Date
          </label>
          <input
            id="guest-date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="mt-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-950 outline-none transition-colors focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
          />
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                  Name
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                  Email
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                  Purpose
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                  Visited at
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {isLoading ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-5 py-10 text-center text-sm font-medium text-slate-500"
                  >
                    Loading guest visits...
                  </td>
                </tr>
              ) : null}

              {!isLoading && guests.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-5 py-10 text-center text-sm font-medium text-slate-500"
                  >
                    No guest visits recorded.
                  </td>
                </tr>
              ) : null}

              {!isLoading
                ? guests.map((guest) => (
                    <tr key={guest.id}>
                      <td className="whitespace-nowrap px-5 py-4 text-sm font-semibold text-slate-950">
                        {guest.name}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">
                        {guest.email}
                      </td>
                      <td className="max-w-md px-5 py-4 text-sm text-slate-600">
                        {guest.purpose}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">
                        {formatDateTime(guest.visitedAt)}
                      </td>
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
