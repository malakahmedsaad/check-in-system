"use client";

// Purpose: Renders admin mentor summaries, total hours, appointments, and shift history.

import type { Prisma } from "@prisma/client";
import { useEffect, useMemo, useState } from "react";

import { useUser } from "../../../../context/UserContext";
import { APP_TIME_ZONE } from "../../../../lib/date-time";

type MentorPayload = Prisma.UserGetPayload<{
  include: {
    shifts: true;
  };
}>;

type Mentor = Pick<MentorPayload, "id" | "name" | "email" | "mentorType"> & {
  todaysAppointmentCount: number;
  totalHours: number;
  shifts: Array<
    Omit<MentorPayload["shifts"][number], "clockInAt" | "clockOutAt" | "createdAt"> & {
      clockInAt: string;
      clockOutAt: string | null;
      createdAt: string;
    }
  >;
};

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function formatDateTime(value: string | null) {
  if (!value) {
    return "Still clocked in";
  }

  return dateTimeFormatter.format(new Date(value));
}

function formatDuration(clockInAt: string, clockOutAt: string | null) {
  if (!clockOutAt) {
    return "Still clocked in";
  }

  const durationMs = new Date(clockOutAt).getTime() - new Date(clockInAt).getTime();
  const totalMinutes = Math.max(0, Math.round(durationMs / (1000 * 60)));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes} min`;
  }

  return `${hours} hr ${minutes} min`;
}

function formatTotalHours(totalHours: number) {
  return `${totalHours.toFixed(1)} hours`;
}

function formatMentorType(mentorType: string | null) {
  if (!mentorType) {
    return "Not set";
  }

  return mentorType
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function AdminMentorsPage() {
  const { logout } = useUser();
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadMentors() {
      try {
        const response = await fetch("/api/admin/mentors", {
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

          throw new Error("Unable to load mentors");
        }

        setMentors((await response.json()) as Mentor[]);
      } catch (loadError) {
        if (isMounted) {
          setMentors([]);
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load mentors",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadMentors();

    return () => {
      isMounted = false;
    };
  }, [logout]);

  function toggleExpanded(mentorId: string) {
    setExpandedIds((current) => {
      const next = new Set(current);

      if (next.has(mentorId)) {
        next.delete(mentorId);
      } else {
        next.add(mentorId);
      }

      return next;
    });
  }

  const filteredMentors = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return mentors;
    }

    return mentors.filter((mentor) =>
      mentor.name.toLowerCase().includes(query),
    );
  }, [mentors, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
            Mentors
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Review mentor appointment load, total hours, and recent shifts.
          </p>
        </div>
        <div className="w-full sm:max-w-xs">
          <label
            htmlFor="mentor-search"
            className="block text-sm font-medium text-slate-700"
          >
            Search
          </label>
          <input
            id="mentor-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Mentor name"
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-950 outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
          />
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}

      <div className="space-y-3">
        {isLoading ? (
          <div className="rounded-xl border border-slate-200 bg-white px-6 py-10 text-center text-sm font-medium text-slate-500 shadow-sm">
            Loading mentors...
          </div>
        ) : null}

        {!isLoading && filteredMentors.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white px-6 py-10 text-center text-sm font-medium text-slate-500 shadow-sm">
            No mentors found.
          </div>
        ) : null}

        {!isLoading
          ? filteredMentors.map((mentor) => {
              const isExpanded = expandedIds.has(mentor.id);

              return (
                <section
                  key={mentor.id}
                  className="rounded-xl border border-slate-200 bg-white shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => toggleExpanded(mentor.id)}
                    className="flex w-full flex-col gap-4 px-5 py-4 text-left transition hover:bg-slate-50 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <span>
                      <span className="block text-base font-semibold text-slate-950">
                        {mentor.name}
                      </span>
                      <span className="mt-1 block text-sm text-slate-500">
                        {mentor.email}
                      </span>
                    </span>
                    <span className="grid gap-3 text-sm sm:grid-cols-4 lg:min-w-[36rem]">
                      <span>
                        <span className="block font-medium text-slate-500">
                          Type
                        </span>
                        <span className="font-semibold text-slate-800">
                          {formatMentorType(mentor.mentorType)}
                        </span>
                      </span>
                      <span>
                        <span className="block font-medium text-slate-500">
                          Today
                        </span>
                        <span className="font-semibold text-slate-800">
                          {mentor.todaysAppointmentCount} appointments
                        </span>
                      </span>
                      <span>
                        <span className="block font-medium text-slate-500">
                          Total hours
                        </span>
                        <span className="font-semibold text-slate-800">
                          {formatTotalHours(mentor.totalHours)}
                        </span>
                      </span>
                      <span className="font-semibold text-slate-600 sm:text-right">
                        {isExpanded ? "Hide shifts" : "Show shifts"}
                      </span>
                    </span>
                  </button>

                  {isExpanded ? (
                    <div className="border-t border-slate-200 px-5 py-4">
                      {mentor.shifts.length === 0 ? (
                        <p className="text-sm font-medium text-slate-500">
                          No recent shifts found.
                        </p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-slate-200">
                            <thead>
                              <tr>
                                <th className="py-2 pr-5 text-left text-xs font-semibold uppercase text-slate-500">
                                  Clock in
                                </th>
                                <th className="px-5 py-2 text-left text-xs font-semibold uppercase text-slate-500">
                                  Clock out
                                </th>
                                <th className="pl-5 py-2 text-left text-xs font-semibold uppercase text-slate-500">
                                  Duration
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {mentor.shifts.map((shift) => (
                                <tr key={shift.id}>
                                  <td className="whitespace-nowrap py-3 pr-5 text-sm text-slate-600">
                                    {formatDateTime(shift.clockInAt)}
                                  </td>
                                  <td className="whitespace-nowrap px-5 py-3 text-sm text-slate-600">
                                    {formatDateTime(shift.clockOutAt)}
                                  </td>
                                  <td className="whitespace-nowrap pl-5 py-3 text-sm font-medium text-slate-700">
                                    {formatDuration(
                                      shift.clockInAt,
                                      shift.clockOutAt,
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ) : null}
                </section>
              );
            })
          : null}
      </div>
    </div>
  );
}
