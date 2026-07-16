"use client";

// Purpose: Renders the student dashboard for kiosk status, bookings, and check-ins.

import { useEffect, useRef, useState } from "react";

import { useUser } from "../../../context/UserContext";
import { computeCheckinWindow } from "../../../lib/checkin-window";
import type { BookingWithStudentSummary } from "../../../lib/db/bookings";
import { APP_TIME_ZONE } from "../../../lib/date-time";

type MentorType = "CONSULTATION" | "LAB" | null;

type Checkin = {
  id: string;
  bookingId: string;
  checkedInAt: string;
};

type SerializedBookingWithStudentSummary = Omit<
  BookingWithStudentSummary,
  "timeslot" | "checkin"
> & {
  timeslot: {
    date: string;
    startTime: string;
    endTime: string;
  };
  checkin: Checkin | null;
};

type KioskStatus = {
  isOpen: boolean;
  openedAt: string | null;
  closedAt: string | null;
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  weekday: "long",
  month: "long",
  day: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
});

function formatMentorType(mentorType: MentorType) {
  if (mentorType === "LAB") {
    return "Lab";
  }

  return "Consultation";
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function SkeletonCards() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="animate-pulse rounded-xl border border-slate-200 bg-white p-5"
        >
          <div className="flex items-center gap-4">
            <div className="h-11 w-11 rounded-full bg-slate-200" />
            <div className="min-w-0 flex-1 space-y-3">
              <div className="h-4 w-44 rounded bg-slate-200" />
              <div className="h-3 w-64 max-w-full rounded bg-slate-200" />
            </div>
            <div className="hidden h-7 w-24 rounded-full bg-slate-200 sm:block" />
            <div className="hidden h-9 w-24 rounded-lg bg-slate-200 sm:block" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { user, logout } = useUser();
  const [bookings, setBookings] = useState<SerializedBookingWithStudentSummary[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);
  const [kioskStatus, setKioskStatus] = useState<KioskStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [checkingInId, setCheckingInId] = useState<string | null>(null);
  const [checkInErrors, setCheckInErrors] = useState<Record<string, string>>({});
  const [lastUpdated, setLastUpdated] = useState(() => Date.now());
  const inFlightCheckins = useRef(new Set<string>());

  const todayDate = new Date().toDateString();
  const checkedInTodayCount = bookings.filter(
    (booking) =>
      booking.checkin &&
      new Date(booking.checkin.checkedInAt).toDateString() === todayDate,
  ).length;
  const nextOpenBooking = bookings.find((booking) => !booking.checkin);
  const nextAppointmentTime = nextOpenBooking
    ? timeFormatter.format(new Date(nextOpenBooking.timeslot.startTime))
    : "None";

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      const kioskResponse = await fetch("/api/admin/kiosk", {
        credentials: "include",
      });

      if (!isMounted) {
        return;
      }

      if (!kioskResponse.ok) {
        if (kioskResponse.status === 401) {
          await logout();
          return;
        }

        setLoadError("Unable to load kiosk status. Please try again.");
        setBookings([]);
        return;
      }

      const status = (await kioskResponse.json()) as KioskStatus;
      setLoadError(null);
      setKioskStatus(status);

      if (!status.isOpen) {
        setBookings([]);
        return;
      }

      const response = await fetch("/api/bookings", {
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

        setLoadError("Unable to load appointments. Please try again.");
        setBookings([]);
        return;
      }

      const data =
        (await response.json()) as SerializedBookingWithStudentSummary[];
      setLoadError(null);
      setBookings(data);
    }

    loadDashboard()
      .catch(() => {
        if (isMounted) {
          setLoadError("Unable to load appointments. Please try again.");
          setBookings([]);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

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

  async function handleCheckIn(bookingId: string) {
    if (inFlightCheckins.current.has(bookingId)) {
      return;
    }

    inFlightCheckins.current.add(bookingId);
    setCheckingInId(bookingId);
    setCheckInErrors((currentErrors) => {
      const nextErrors = { ...currentErrors };
      delete nextErrors[bookingId];
      return nextErrors;
    });

    try {
      const response = await fetch(`/api/bookings/${bookingId}/checkin`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
          message?: string;
        } | null;

        throw new Error(data?.message ?? data?.error ?? "Check-in failed");
      }

      const checkin = (await response.json()) as Checkin;

      setBookings((currentBookings) =>
        currentBookings.map((booking) =>
          booking.id === bookingId ? { ...booking, checkin } : booking,
        ),
      );
    } catch (error) {
      setCheckInErrors((currentErrors) => ({
        ...currentErrors,
        [bookingId]:
          error instanceof Error
            ? error.message
            : "Check-in failed. Please try again.",
      }));
    } finally {
      inFlightCheckins.current.delete(bookingId);
      setCheckingInId(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <p className="text-base font-semibold tracking-tight text-slate-950 sm:text-lg">
            Bechtel Center Check-In
          </p>
          <div className="flex items-center gap-3">
            <p className="hidden text-sm font-medium text-slate-600 sm:block">
              {user?.name ?? "Student"}
            </p>
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

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        {!isLoading && kioskStatus?.isOpen === false ? (
          <div className="flex min-h-[calc(100vh-9rem)] items-center justify-center py-12 text-center">
            <div>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400 ring-1 ring-slate-200">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-8 w-8"
                >
                  <path
                    d="M7 11V8a5 5 0 0 1 10 0v3m-9 0h8a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2Z"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h1 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">
                Check-in is currently closed
              </h1>
              <p className="mt-2 text-base leading-7 text-slate-500">
                Please check back during open hours.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="max-w-2xl">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
                Welcome, {user?.name ?? "Student"}
              </h1>
              <p className="mt-2 text-base leading-7 text-slate-500">
                Your upcoming appointments
              </p>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <p className="text-sm font-medium text-slate-500">Upcoming</p>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                  {isLoading ? "-" : bookings.length}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <p className="text-sm font-medium text-slate-500">
                  Checked in today
                </p>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                  {isLoading ? "-" : checkedInTodayCount}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <p className="text-sm font-medium text-slate-500">
                  Next appointment
                </p>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                  {isLoading ? "-" : nextAppointmentTime}
                </p>
              </div>
            </div>

            <div className="mt-8">
              {loadError ? (
                <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {loadError}
                </p>
              ) : null}

              {isLoading ? <SkeletonCards /> : null}

              {!isLoading && bookings.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-2xl text-slate-400">
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="h-7 w-7"
                    >
                      <path
                        d="M8 7V3m8 4V3M4 10h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <p className="mt-4 text-sm font-medium text-slate-600">
                    No upcoming appointments found.
                  </p>
                </div>
              ) : null}

              {!isLoading && bookings.length > 0 ? (
                <div
                  className="space-y-3"
                  data-window-updated-at={lastUpdated}
                >
                  {bookings.map((booking) => {
                    const isCheckingIn = checkingInId === booking.id;
                    const appointmentDate = new Date(booking.timeslot.date);
                    const startTime = new Date(booking.timeslot.startTime);
                    const endTime = new Date(booking.timeslot.endTime);
                    const {
                      windowOpen,
                      isOpen,
                      tooEarly,
                      tooLate,
                    } = computeCheckinWindow(startTime);

                    return (
                      <article
                        key={booking.id}
                        className="rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:bg-slate-50"
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex min-w-0 items-start gap-4">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-semibold text-indigo-700 ring-1 ring-indigo-100">
                              {getInitials(booking.mentor.name)}
                            </div>

                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-base font-semibold text-slate-950">
                                  {booking.mentor.name}
                                </h2>
                                <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 ring-1 ring-indigo-100">
                                  {formatMentorType(booking.mentor.mentorType)}
                                </span>
                              </div>

                              <p className="mt-2 text-sm font-medium text-slate-700">
                                {dateFormatter.format(appointmentDate)}
                              </p>
                              <p className="mt-1 text-sm text-slate-500">
                                {timeFormatter.format(startTime)} –{" "}
                                {timeFormatter.format(endTime)}
                              </p>
                              {!booking.checkin && tooEarly ? (
                                <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                                  <svg
                                    aria-hidden="true"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.8"
                                    className="h-4 w-4"
                                  >
                                    <circle cx="12" cy="12" r="9" />
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M12 7v5l3 2"
                                    />
                                  </svg>
                                  Check-in opens at{" "}
                                  {timeFormatter.format(windowOpen)}
                                </p>
                              ) : null}
                              {!booking.checkin && tooLate ? (
                                <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                                  <svg
                                    aria-hidden="true"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.8"
                                    className="h-4 w-4"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M12 9v4m0 4h.01M10.29 3.86 2.82 17a2 2 0 0 0 1.74 3h14.88a2 2 0 0 0 1.74-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
                                    />
                                  </svg>
                                  Check-in window has closed
                                </p>
                              ) : null}
                            </div>
                          </div>

                          <div className="flex flex-col items-start gap-3 sm:items-end">
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                booking.checkin
                                  ? "bg-teal-50 text-teal-700 ring-1 ring-teal-100"
                                  : "bg-amber-50 text-amber-700 ring-1 ring-amber-100"
                              }`}
                            >
                              {booking.checkin ? "Checked in" : "Confirmed"}
                            </span>

                            {!booking.checkin && isOpen ? (
                              <>
                                <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                  Open now
                                </span>
                              <button
                                type="button"
                                onClick={() => handleCheckIn(booking.id)}
                                disabled={isCheckingIn}
                                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:scale-[1.02] hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:hover:scale-100"
                              >
                                {isCheckingIn ? "Checking in..." : "Check In"}
                              </button>
                              </>
                            ) : null}
                          </div>
                        </div>

                        {checkInErrors[booking.id] ? (
                          <p className="mt-4 text-sm font-medium text-red-600">
                            {checkInErrors[booking.id]}
                          </p>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
