"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useUser } from "../../../context/UserContext";

type Shift = {
  id: string;
  mentorId: string;
  clockInAt: string;
  clockOutAt: string | null;
  createdAt: string;
};

type ShiftStatus = {
  activeShift: Shift | null;
  recentShifts: Shift[];
};

type Appointment = {
  id: string;
  student: {
    name: string;
    email: string;
  };
  timeslot: {
    startTime: string;
    endTime: string;
  };
  checkin: {
    id: string;
    checkedInAt: string;
  } | null;
};

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

function formatTime(value: string) {
  return timeFormatter.format(new Date(value));
}

function formatDuration(start: string, end: string | null, now: Date) {
  const startTime = new Date(start).getTime();
  const endTime = end ? new Date(end).getTime() : now.getTime();
  const totalMinutes = Math.max(0, Math.floor((endTime - startTime) / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }

  return `${hours}h ${minutes}m`;
}

function formatHours(start: string, end: string | null) {
  if (!end) {
    return "In progress";
  }

  const hours = (new Date(end).getTime() - new Date(start).getTime()) /
    (1000 * 60 * 60);

  return `${Math.max(0, hours).toFixed(1)} hours`;
}

function AppointmentSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="animate-pulse rounded-xl border border-slate-200 bg-white p-5"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-3">
              <div className="h-4 w-40 rounded bg-slate-200" />
              <div className="h-3 w-56 rounded bg-slate-200" />
            </div>
            <div className="h-7 w-28 rounded-full bg-slate-200" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function MentorPage() {
  const { user, isUserLoading, logout } = useUser();
  const [shiftStatus, setShiftStatus] = useState<ShiftStatus>({
    activeShift: null,
    recentShifts: [],
  });
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isShiftLoading, setIsShiftLoading] = useState(true);
  const [isAppointmentsLoading, setIsAppointmentsLoading] = useState(true);
  const [isTogglingShift, setIsTogglingShift] = useState(false);
  const [shiftError, setShiftError] = useState<string | null>(null);
  const [appointmentsError, setAppointmentsError] = useState<string | null>(
    null,
  );
  const [now, setNow] = useState(() => new Date());

  async function loadShiftStatus() {
    const response = await fetch("/api/mentor/shift", {
      credentials: "include",
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      throw new Error(data?.error ?? "Unable to load shift status");
    }

    const data = (await response.json()) as ShiftStatus;
    setShiftStatus(data);
  }

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(new Date());
    }, 60000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadInitialShiftStatus() {
      try {
        const response = await fetch("/api/mentor/shift", {
          credentials: "include",
        });

        if (!isMounted) {
          return;
        }

        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;

          throw new Error(data?.error ?? "Unable to load shift status");
        }

        const data = (await response.json()) as ShiftStatus;
        setShiftStatus(data);
      } catch (error) {
        if (isMounted) {
          setShiftError(
            error instanceof Error
              ? error.message
              : "Unable to load shift status",
          );
        }
      } finally {
        if (isMounted) {
          setIsShiftLoading(false);
        }
      }
    }

    loadInitialShiftStatus();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadAppointments() {
      try {
        const response = await fetch("/api/mentor/appointments", {
          credentials: "include",
        });

        if (!isMounted) {
          return;
        }

        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;

          throw new Error(data?.error ?? "Unable to load appointments");
        }

        const data = (await response.json()) as Appointment[];
        setAppointments(data);
      } catch (error) {
        if (isMounted) {
          setAppointmentsError(
            error instanceof Error
              ? error.message
              : "Unable to load appointments",
          );
        }
      } finally {
        if (isMounted) {
          setIsAppointmentsLoading(false);
        }
      }
    }

    loadAppointments();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleShiftToggle() {
    const isClockedIn = Boolean(shiftStatus.activeShift);

    setIsTogglingShift(true);
    setShiftError(null);

    try {
      const response = await fetch("/api/mentor/shift", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          action: isClockedIn ? "clock_out" : "clock_in",
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;

        throw new Error(data?.error ?? "Unable to update shift");
      }

      await loadShiftStatus();
      setNow(new Date());
    } catch (error) {
      setShiftError(
        error instanceof Error ? error.message : "Unable to update shift",
      );
    } finally {
      setIsTogglingShift(false);
    }
  }

  const activeShift = shiftStatus.activeShift;
  const recentShifts = useMemo(
    () => shiftStatus.recentShifts.slice(0, 10),
    [shiftStatus.recentShifts],
  );

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <p className="text-base font-semibold tracking-tight text-slate-950 sm:text-lg">
            Bechtel Center Check-In
          </p>
          <div className="flex items-center gap-3">
            <p className="hidden text-sm font-medium text-slate-600 sm:block">
              {user?.name ?? "Mentor"}
            </p>
            {user?.isAdmin ? (
              <Link
                href="/admin/kiosk"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:scale-[1.02] hover:bg-slate-700"
              >
                Admin
              </Link>
            ) : null}
            <button
              type="button"
              onClick={logout}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:scale-[1.02] hover:border-slate-400 hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl space-y-8 px-4 py-10 sm:px-6">
        {isUserLoading ? (
          <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
              Loading mentor dashboard...
            </h1>
          </div>
        ) : user?.role !== "mentor" ? (
          <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
              You do not have access to this page
            </h1>
          </div>
        ) : (
          <>
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase text-slate-500">
                    Shift status
                  </p>
                  <h1
                    className={`mt-3 text-4xl font-semibold tracking-tight ${
                      activeShift ? "text-emerald-700" : "text-slate-700"
                    }`}
                  >
                    {isShiftLoading
                      ? "Loading shift..."
                      : activeShift
                        ? "You're clocked in"
                        : "You're clocked out"}
                  </h1>
                  {activeShift ? (
                    <p className="mt-3 text-base leading-7 text-slate-500">
                      Since {formatTime(activeShift.clockInAt)} ·{" "}
                      {formatDuration(activeShift.clockInAt, null, now)}
                    </p>
                  ) : (
                    <p className="mt-3 text-base leading-7 text-slate-500">
                      Clock in when you are ready to start your shift.
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleShiftToggle}
                  disabled={isShiftLoading || isTogglingShift}
                  className={`rounded-lg px-6 py-4 text-base font-semibold text-white transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:hover:scale-100 ${
                    activeShift
                      ? "bg-slate-800 hover:bg-slate-700"
                      : "bg-emerald-600 hover:bg-emerald-500"
                  }`}
                >
                  {isTogglingShift
                    ? "Updating..."
                    : activeShift
                      ? "Clock out"
                      : "Clock in"}
                </button>
              </div>

              {shiftError ? (
                <p className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {shiftError}
                </p>
              ) : null}
            </section>

            <section>
              <div className="mb-4">
                <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                  Today&apos;s appointments
                </h2>
              </div>

              {appointmentsError ? (
                <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {appointmentsError}
                </p>
              ) : null}

              {isAppointmentsLoading ? <AppointmentSkeleton /> : null}

              {!isAppointmentsLoading && appointments.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center">
                  <p className="text-sm font-medium text-slate-600">
                    No appointments scheduled for today.
                  </p>
                </div>
              ) : null}

              {!isAppointmentsLoading && appointments.length > 0 ? (
                <div className="space-y-3">
                  {appointments.map((appointment) => (
                    <article
                      key={appointment.id}
                      className="rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:bg-slate-50"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h3 className="text-base font-semibold text-slate-950">
                            {appointment.student.name}
                          </h3>
                          <p className="mt-1 text-sm text-slate-500">
                            {appointment.student.email}
                          </p>
                          <p className="mt-2 text-sm font-medium text-slate-700">
                            {formatTime(appointment.timeslot.startTime)} -{" "}
                            {formatTime(appointment.timeslot.endTime)}
                          </p>
                        </div>

                        <span
                          className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${
                            appointment.checkin
                              ? "bg-teal-50 text-teal-700 ring-1 ring-teal-100"
                              : "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
                          }`}
                        >
                          {appointment.checkin
                            ? "Checked in"
                            : "Not yet arrived"}
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}
            </section>

            <section>
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                  My timesheet
                </h2>
                {shiftStatus.recentShifts.length > 10 ? (
                  <p className="text-sm font-medium text-slate-500">
                    Showing 10 most recent shifts.
                  </p>
                ) : null}
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                          Date
                        </th>
                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                          Clock in
                        </th>
                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                          Clock out
                        </th>
                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                          Duration
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {isShiftLoading ? (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-5 py-10 text-center text-sm font-medium text-slate-500"
                          >
                            Loading timesheet...
                          </td>
                        </tr>
                      ) : null}

                      {!isShiftLoading && recentShifts.length === 0 ? (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-5 py-10 text-center text-sm font-medium text-slate-500"
                          >
                            No shifts recorded yet.
                          </td>
                        </tr>
                      ) : null}

                      {!isShiftLoading
                        ? recentShifts.map((shift) => (
                            <tr key={shift.id}>
                              <td className="whitespace-nowrap px-5 py-4 text-sm font-semibold text-slate-950">
                                {dateFormatter.format(
                                  new Date(shift.clockInAt),
                                )}
                              </td>
                              <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">
                                {formatTime(shift.clockInAt)}
                              </td>
                              <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">
                                {shift.clockOutAt
                                  ? formatTime(shift.clockOutAt)
                                  : "In progress"}
                              </td>
                              <td className="whitespace-nowrap px-5 py-4 text-sm font-medium text-slate-700">
                                {formatHours(
                                  shift.clockInAt,
                                  shift.clockOutAt,
                                )}
                              </td>
                            </tr>
                          ))
                        : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </>
        )}
      </section>
    </main>
  );
}
