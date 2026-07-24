"use client";

// Purpose: Renders the mentor dashboard for appointments, shift controls, and timesheet totals.

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { useUser } from "../../../context/UserContext";
import { APP_TIME_ZONE } from "../../../lib/date-time";

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
  completedShiftHours: number;
};

type Appointment = {
  id: string;
  startDate: string;
  endDate: string;
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
  timeZone: APP_TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
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

function formatTotalHours(hours: number) {
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
    completedShiftHours: 0,
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
  const isShiftToggleInFlight = useRef(false);

  async function loadShiftStatus() {
    const response = await fetch("/api/mentor/shift", {
      cache: "no-store",
      credentials: "include",
    });

    if (!response.ok) {
      if (response.status === 401) {
        await logout();
        return;
      }

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
          cache: "no-store",
          credentials: "include",
        });

        if (!isMounted) {
          return;
        }

        if (!response.ok) {
          if (response.status === 401) {
            await logout();
            return;
          }

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
  }, [logout]);

  useEffect(() => {
    let isMounted = true;

    async function loadAppointments() {
      try {
        const response = await fetch("/api/mentor/appointments", {
          cache: "no-store",
          credentials: "include",
        });

        if (!isMounted) {
          return;
        }

        if (!response.ok) {
          if (response.status === 401) {
            await logout();
            return;
          }

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
  }, [logout]);

  async function handleShiftToggle() {
    if (isShiftToggleInFlight.current) {
      return;
    }

    isShiftToggleInFlight.current = true;
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
        cache: "no-store",
        body: JSON.stringify({
          action: isClockedIn ? "clock_out" : "clock_in",
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          await logout();
          return;
        }

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
      isShiftToggleInFlight.current = false;
      setIsTogglingShift(false);
    }
  }

  const activeShift = shiftStatus.activeShift;
  const recentShifts = useMemo(
    () => shiftStatus.recentShifts.slice(0, 10),
    [shiftStatus.recentShifts],
  );
  const totalHoursWorked = useMemo(() => {
    if (!activeShift) {
      return shiftStatus.completedShiftHours;
    }

    const activeHours =
      (now.getTime() - new Date(activeShift.clockInAt).getTime()) /
      (1000 * 60 * 60);

    return shiftStatus.completedShiftHours + Math.max(0, activeHours);
  }, [activeShift, now, shiftStatus.completedShiftHours]);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="h-16 bg-white shadow">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <p className="text-lg font-semibold text-slate-900">
            Bechtel Center Check-In
          </p>
          <div className="flex items-center gap-3">
            <p className="hidden text-sm font-medium text-slate-600 sm:block">
              {user?.name ?? "Mentor"}
            </p>
            {user?.role === "admin" ? (
              <Link
                href="/admin/kiosk"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                Admin
              </Link>
            ) : null}
            <button
              type="button"
              onClick={logout}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
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
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-6 rounded-2xl bg-gradient-to-r from-sky-700 via-indigo-700 to-blue-800 p-6 shadow-lg">
                <h1 className="text-2xl font-bold text-white">
                  Welcome, {user?.name ?? "Mentor"}
                </h1>
                <p className="mt-1 text-sm text-blue-100">
                  Manage your shift, appointments, and timesheet.
                </p>
              </div>
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase text-slate-500">
                    Shift status
                  </p>
                  <h1
                    className={`mt-3 text-4xl font-bold ${
                      activeShift ? "text-green-800" : "text-slate-700"
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

                <div className="rounded-lg border border-slate-200 bg-slate-50 px-5 py-4 md:ml-auto">
                  <p className="text-xs font-semibold uppercase text-slate-500">
                    Total hours worked
                  </p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                    {isShiftLoading
                      ? "Loading..."
                      : formatTotalHours(totalHoursWorked)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleShiftToggle}
                  disabled={isShiftLoading || isTogglingShift}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 ${
                    activeShift
                      ? "border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50 focus:ring-indigo-500"
                      : "bg-green-600 text-white hover:bg-green-700 focus:ring-green-500"
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
                      className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm transition-colors hover:bg-slate-50"
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
                            {formatTime(appointment.startDate)} -{" "}
                            {formatTime(appointment.endDate)}
                          </p>
                        </div>

                        <span
                          className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                            appointment.checkin
                              ? "bg-green-100 text-green-800"
                              : "bg-yellow-100 text-yellow-800"
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
                            <tr key={shift.id} className="hover:bg-slate-50">
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
