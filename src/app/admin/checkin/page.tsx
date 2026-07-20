"use client";

// Purpose: Gives front desk admins a searchable daily appointment check-in list.

import { useEffect, useMemo, useState } from "react";

import { useUser } from "../../../../context/UserContext";
import { computeCheckinWindow } from "../../../../lib/checkin-window";
import { APP_TIME_ZONE } from "../../../../lib/date-time";

type Checkin = { id: string; bookingId: string; checkedInAt: string };

type Booking = {
  id: string;
  student: { name: string; email: string };
  mentor: {
    name: string;
    email: string;
  };
  timeslot: { startTime: string; endTime: string };
  checkin: Checkin | null;
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
});

export default function AdminCheckinPage() {
  const { logout } = useUser();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [lastUpdated, setLastUpdated] = useState(() => Date.now());

  useEffect(() => {
    let isMounted = true;

    async function loadBookings() {
      try {
        const response = await fetch("/api/admin/checkin", {
          credentials: "include",
        });

        if (response.status === 401 || response.status === 403) {
          await logout();
          return;
        }

        if (!response.ok) throw new Error("Unable to load today's appointments");
        const data = (await response.json()) as Booking[];
        if (isMounted) setBookings(data);
      } catch (error) {
        if (isMounted) {
          setLoadError(
            error instanceof Error ? error.message : "Unable to load appointments",
          );
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadBookings();
    return () => {
      isMounted = false;
    };
  }, [logout]);

  useEffect(() => {
    const intervalId = window.setInterval(
      () => setLastUpdated(Date.now()),
      60_000,
    );

    return () => clearInterval(intervalId);
  }, []);

  const filteredBookings = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query
      ? bookings.filter((booking) =>
          booking.student.name.toLowerCase().includes(query),
        )
      : bookings;
  }, [bookings, search]);

  const checkedInCount = bookings.filter((booking) => booking.checkin).length;

  async function checkIn(bookingId: string) {
    setPendingId(bookingId);
    setRowErrors((current) => ({ ...current, [bookingId]: "" }));

    try {
      const response = await fetch("/api/admin/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ bookingId }),
      });
      const data = (await response.json().catch(() => null)) as
        | Checkin
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(
          data && "error" in data && data.error
            ? data.error
            : "Unable to check student in",
        );
      }

      setBookings((current) =>
        current.map((booking) =>
          booking.id === bookingId
            ? { ...booking, checkin: data as Checkin }
            : booking,
        ),
      );
    } catch (error) {
      setRowErrors((current) => ({
        ...current,
        [bookingId]:
          error instanceof Error ? error.message : "Unable to check student in",
      }));
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          Today&apos;s check-ins
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {dateFormatter.format(new Date())}
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <input
            type="search"
            placeholder="Search by student name..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full max-w-xl rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
          />
          <p className="mt-3 text-sm font-medium text-slate-600">
            {bookings.length} appointments today · {checkedInCount} checked in
          </p>
        </div>

        {isLoading ? (
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="grid animate-pulse gap-4 px-5 py-5 md:grid-cols-5">
                {Array.from({ length: 5 }).map((__, cell) => (
                  <div key={cell} className="h-5 rounded bg-slate-100" />
                ))}
              </div>
            ))}
          </div>
        ) : loadError ? (
          <p className="px-5 py-12 text-center text-sm font-medium text-red-600">
            {loadError}
          </p>
        ) : bookings.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-slate-500">
            No appointments scheduled for today.
          </p>
        ) : filteredBookings.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-slate-500">
            <p>No appointments match &apos;{search.trim()}&apos;.</p>
            <button type="button" onClick={() => setSearch("")} className="mt-2 font-semibold text-indigo-600 hover:text-indigo-500">
              Clear search
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Student</th>
                  <th className="px-5 py-3">Mentor</th>
                  <th className="px-5 py-3">Time</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody
                className="divide-y divide-slate-100"
                data-window-updated-at={lastUpdated}
              >
                {filteredBookings.map((booking) => {
                  const { tooLate } = computeCheckinWindow(
                    new Date(booking.timeslot.startTime),
                  );

                  return (
                  <tr key={booking.id} className="align-middle">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-900">{booking.student.name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{booking.student.email}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-800">{booking.mentor.name}</p>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 font-medium text-slate-700">
                      {timeFormatter.format(new Date(booking.timeslot.startTime))} – {timeFormatter.format(new Date(booking.timeslot.endTime))}
                    </td>
                    <td className="px-5 py-4">
                      {booking.checkin ? (
                        <>
                          <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">Checked in</span>
                          <p className="mt-1 text-xs text-slate-500">{timeFormatter.format(new Date(booking.checkin.checkedInAt))}</p>
                        </>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">Not arrived</span>
                          {tooLate ? (
                            <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-300">
                              Window closed
                            </span>
                          ) : null}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {!booking.checkin ? (
                        <>
                          <button type="button" onClick={() => void checkIn(booking.id)} disabled={pendingId === booking.id} className="rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400">
                            {pendingId === booking.id ? "Checking in..." : "Check in"}
                          </button>
                          {rowErrors[booking.id] ? <p className="mt-2 text-xs font-medium text-red-600">{rowErrors[booking.id]}</p> : null}
                        </>
                      ) : null}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
