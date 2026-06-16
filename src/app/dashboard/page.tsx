"use client";

import { useEffect, useState } from "react";

import { useUser } from "../../../context/UserContext";

type MentorType = "CONSULTATION" | "LAB" | null;

type Checkin = {
  id: string;
  bookingId: string;
  checkedInAt: string;
};

type Booking = {
  id: string;
  timeslot: {
    date: string;
    startTime: string;
    endTime: string;
  };
  mentor: {
    name: string;
    email: string;
    mentorType: MentorType;
  };
  checkin: Checkin | null;
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

function formatMentorType(mentorType: MentorType) {
  if (mentorType === "LAB") {
    return "Lab";
  }

  return "Consultation";
}

function SkeletonCards() {
  return (
    <div className="space-y-4">
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="animate-pulse rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="w-full max-w-sm space-y-3">
              <div className="h-5 w-2/3 rounded bg-gray-200" />
              <div className="h-4 w-1/2 rounded bg-gray-200" />
              <div className="h-4 w-3/5 rounded bg-gray-200" />
            </div>
            <div className="h-8 w-24 rounded bg-gray-200" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { user, logout } = useUser();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [checkingInId, setCheckingInId] = useState<string | null>(null);
  const [checkInErrors, setCheckInErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let isMounted = true;

    async function loadBookings() {
      const response = await fetch("/api/bookings", {
        credentials: "include",
      });

      if (!isMounted) {
        return;
      }

      if (!response.ok) {
        setBookings([]);
        return;
      }

      const data = (await response.json()) as Booking[];
      setBookings(data);
    }

    loadBookings()
      .catch(() => {
        if (isMounted) {
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
  }, []);

  async function handleCheckIn(bookingId: string) {
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
        throw new Error("Check-in failed");
      }

      const checkin = (await response.json()) as Checkin;

      setBookings((currentBookings) =>
        currentBookings.map((booking) =>
          booking.id === bookingId ? { ...booking, checkin } : booking,
        ),
      );
    } catch {
      setCheckInErrors((currentErrors) => ({
        ...currentErrors,
        [bookingId]: "Check-in failed. Please try again.",
      }));
    } finally {
      setCheckingInId(null);
    }
  }

  return (
    <main className="min-h-screen bg-gray-100">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <p className="text-lg font-semibold text-gray-950">
            Bechtel Center Check-In
          </p>
          <button
            type="button"
            onClick={logout}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 transition hover:bg-gray-50"
          >
            Sign out
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div>
          <h1 className="text-3xl font-semibold text-gray-950">
            Welcome, {user?.name ?? "Student"}
          </h1>
          <p className="mt-2 text-base text-gray-600">
            Your upcoming appointments
          </p>
        </div>

        <div className="mt-8">
          {isLoading ? <SkeletonCards /> : null}

          {!isLoading && bookings.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white px-6 py-12 text-center text-gray-600 shadow-sm">
              No upcoming appointments found.
            </div>
          ) : null}

          {!isLoading && bookings.length > 0 ? (
            <div className="space-y-4">
              {bookings.map((booking) => {
                const isCheckingIn = checkingInId === booking.id;
                const appointmentDate = new Date(booking.timeslot.date);
                const startTime = new Date(booking.timeslot.startTime);
                const endTime = new Date(booking.timeslot.endTime);

                return (
                  <article
                    key={booking.id}
                    className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-lg font-semibold text-gray-950">
                            {booking.mentor.name}
                          </h2>
                          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                            {formatMentorType(booking.mentor.mentorType)}
                          </span>
                        </div>

                        <p className="mt-3 text-sm font-medium text-gray-800">
                          {dateFormatter.format(appointmentDate)}
                        </p>
                        <p className="mt-1 text-sm text-gray-600">
                          {timeFormatter.format(startTime)} –{" "}
                          {timeFormatter.format(endTime)}
                        </p>
                      </div>

                      <div className="flex flex-col items-start gap-3 sm:items-end">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            booking.checkin
                              ? "bg-green-100 text-green-700"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {booking.checkin ? "Checked In" : "Confirmed"}
                        </span>

                        {!booking.checkin ? (
                          <button
                            type="button"
                            onClick={() => handleCheckIn(booking.id)}
                            disabled={isCheckingIn}
                            className="rounded-md bg-gray-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
                          >
                            {isCheckingIn ? "Checking in..." : "Check In"}
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {checkInErrors[booking.id] ? (
                      <p className="mt-4 text-sm text-red-600">
                        {checkInErrors[booking.id]}
                      </p>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
