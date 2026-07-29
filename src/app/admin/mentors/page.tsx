"use client";

// Purpose: Renders admin mentor summaries and full shift-management controls.

import { useCallback, useEffect, useMemo, useState } from "react";

import { useUser } from "../../../../context/UserContext";
import { APP_TIME_ZONE } from "../../../../lib/date-time";

type Shift = {
  id: string;
  mentorId: number;
  clockInAt: string;
  clockOutAt: string | null;
  createdAt: string;
};

type Mentor = {
  id: number;
  name: string;
  email: string;
  todaysAppointmentCount: number;
  totalHours: number;
};

type MentorShiftStatus = {
  id: number;
  name: string;
  email: string;
  mostRecentShift: Shift | null;
  isClockedIn: boolean;
};

type EditState = {
  mentorId: number;
  shiftId: string;
  clockInAt: string;
  clockOutAt: string;
};

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  weekday: "short",
  month: "short",
  day: "numeric",
});

const dateTimeInputFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function formatDuration(clockInAt: string, clockOutAt: string) {
  const durationMs =
    new Date(clockOutAt).getTime() - new Date(clockInAt).getTime();
  const totalMinutes = Math.max(0, Math.round(durationMs / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}h ${minutes}m`;
}

function formatElapsed(clockInAt: string, now: number) {
  const totalMinutes = Math.max(
    0,
    Math.floor((now - new Date(clockInAt).getTime()) / 60_000),
  );
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}h ${minutes}m`;
}

function toDateTimeLocal(value: string | null) {
  if (!value) {
    return "";
  }

  const parts = dateTimeInputFormatter.formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

function getTotalMinutes(shifts: Shift[]) {
  return shifts.reduce((total, shift) => {
    if (!shift.clockOutAt) {
      return total;
    }

    return (
      total +
      Math.max(
        0,
        Math.round(
          (new Date(shift.clockOutAt).getTime() -
            new Date(shift.clockInAt).getTime()) /
            60_000,
        ),
      )
    );
  }, 0);
}

async function getErrorMessage(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === "string" ? body.error : fallback;
  } catch {
    return fallback;
  }
}

function PencilIcon() {
  return (
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
        d="m16.862 3.487 3.651 3.651M5.25 18.75l-1.5 1.5 1.5-4.5L16.13 4.87a2.582 2.582 0 0 1 3.652 3.652L8.902 19.402l-3.652-.652Z"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
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
        d="M14.74 9 14.4 18m-4.8 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166M19.228 5.79 18.16 19.673A2.25 2.25 0 0 1 15.916 21H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-10.978.397c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m6.478.165V4.477c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
      />
    </svg>
  );
}

export default function AdminMentorsPage() {
  const { logout } = useUser();
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [shiftStatuses, setShiftStatuses] = useState<MentorShiftStatus[]>([]);
  const [shiftsByMentor, setShiftsByMentor] = useState<
    Record<string, Shift[]>
  >({});
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [loadingShiftIds, setLoadingShiftIds] = useState<Set<number>>(
    new Set(),
  );
  const [clockingOutId, setClockingOutId] = useState<number | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [deleteShiftId, setDeleteShiftId] = useState<string | null>(null);
  const [savingShiftId, setSavingShiftId] = useState<string | null>(null);
  const [deletingShiftId, setDeletingShiftId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleUnauthorized = useCallback(
    async (response: Response) => {
      if (response.status === 401 || response.status === 403) {
        await logout();
        return true;
      }

      return false;
    },
    [logout],
  );

  const loadShiftStatuses = useCallback(async () => {
    const response = await fetch("/api/admin/shifts", {
      credentials: "include",
    });

    if (!response.ok) {
      if (await handleUnauthorized(response)) {
        return;
      }

      throw new Error("Unable to load mentor shift status");
    }

    setShiftStatuses((await response.json()) as MentorShiftStatus[]);
  }, [handleUnauthorized]);

  const loadMentorShifts = useCallback(
    async (mentorId: number) => {
      setLoadingShiftIds((current) => new Set(current).add(mentorId));

      try {
        const response = await fetch(
          `/api/admin/shifts?mentorId=${encodeURIComponent(mentorId)}`,
          { credentials: "include" },
        );

        if (!response.ok) {
          if (await handleUnauthorized(response)) {
            return;
          }

          throw new Error("Unable to load this mentor's shifts");
        }

        const shifts = (await response.json()) as Shift[];
        setShiftsByMentor((current) => ({
          ...current,
          [mentorId]: shifts,
        }));
      } finally {
        setLoadingShiftIds((current) => {
          const next = new Set(current);
          next.delete(mentorId);
          return next;
        });
      }
    },
    [handleUnauthorized],
  );

  useEffect(() => {
    let isMounted = true;

    async function loadPage() {
      try {
        const [mentorsResponse, statusesResponse] = await Promise.all([
          fetch("/api/admin/mentors", { credentials: "include" }),
          fetch("/api/admin/shifts", { credentials: "include" }),
        ]);

        if (!isMounted) {
          return;
        }

        if (!mentorsResponse.ok || !statusesResponse.ok) {
          const unauthorizedResponse = [mentorsResponse, statusesResponse].find(
            (response) => response.status === 401 || response.status === 403,
          );

          if (unauthorizedResponse) {
            await logout();
            return;
          }

          throw new Error("Unable to load mentors");
        }

        setMentors((await mentorsResponse.json()) as Mentor[]);
        setShiftStatuses(
          (await statusesResponse.json()) as MentorShiftStatus[],
        );
      } catch (loadError) {
        if (isMounted) {
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

    void loadPage();

    return () => {
      isMounted = false;
    };
  }, [logout]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const filteredMentors = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return mentors;
    }

    return mentors.filter(
      (mentor) =>
        mentor.name.toLowerCase().includes(query) ||
        mentor.email.toLowerCase().includes(query),
    );
  }, [mentors, search]);

  const clockedInMentors = useMemo(
    () =>
      shiftStatuses.filter(
        (mentor) => mentor.isClockedIn && mentor.mostRecentShift,
      ),
    [shiftStatuses],
  );

  async function toggleTimesheet(mentorId: number) {
    setEditState(null);
    setDeleteShiftId(null);
    setRowError(null);

    if (expandedIds.has(mentorId)) {
      setExpandedIds((current) => {
        const next = new Set(current);
        next.delete(mentorId);
        return next;
      });
      return;
    }

    setExpandedIds((current) => new Set(current).add(mentorId));

    if (!(mentorId in shiftsByMentor)) {
      try {
        await loadMentorShifts(mentorId);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load this mentor's shifts",
        );
      }
    }
  }

  async function forceClockOut(mentorId: number) {
    setClockingOutId(mentorId);
    setError(null);

    try {
      const response = await fetch("/api/admin/shifts/clockout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ mentorId }),
      });

      if (!response.ok) {
        if (await handleUnauthorized(response)) {
          return;
        }

        throw new Error(
          await getErrorMessage(response, "Unable to clock out mentor"),
        );
      }

      const updatedShift = (await response.json()) as Shift;
      setShiftStatuses((current) =>
        current.map((mentor) =>
          mentor.id === mentorId
            ? {
                ...mentor,
                isClockedIn: false,
                mostRecentShift: updatedShift,
              }
            : mentor,
        ),
      );

      if (mentorId in shiftsByMentor) {
        await loadMentorShifts(mentorId);
      }
    } catch (clockOutError) {
      setError(
        clockOutError instanceof Error
          ? clockOutError.message
          : "Unable to clock out mentor",
      );
    } finally {
      setClockingOutId(null);
    }
  }

  function beginEdit(mentorId: number, shift: Shift) {
    setDeleteShiftId(null);
    setRowError(null);
    setEditState({
      mentorId,
      shiftId: shift.id,
      clockInAt: toDateTimeLocal(shift.clockInAt),
      clockOutAt: toDateTimeLocal(shift.clockOutAt),
    });
  }

  async function saveShift() {
    if (!editState) {
      return;
    }

    setSavingShiftId(editState.shiftId);
    setRowError(null);

    try {
      const response = await fetch(`/api/admin/shifts/${editState.shiftId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          clockInAt: new Date(editState.clockInAt).toISOString(),
          ...(editState.clockOutAt
            ? { clockOutAt: new Date(editState.clockOutAt).toISOString() }
            : {}),
        }),
      });

      if (!response.ok) {
        if (await handleUnauthorized(response)) {
          return;
        }

        setRowError(
          await getErrorMessage(response, "Unable to update this shift"),
        );
        return;
      }

      const updatedShift = (await response.json()) as Shift;
      setShiftsByMentor((current) => ({
        ...current,
        [editState.mentorId]: current[editState.mentorId].map((shift) =>
          shift.id === updatedShift.id ? updatedShift : shift,
        ),
      }));
      setEditState(null);
      await loadShiftStatuses();
    } catch {
      setRowError("Unable to update this shift");
    } finally {
      setSavingShiftId(null);
    }
  }

  async function deleteShift(mentorId: number, shiftId: string) {
    setDeletingShiftId(shiftId);
    setRowError(null);

    try {
      const response = await fetch(`/api/admin/shifts/${shiftId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        if (await handleUnauthorized(response)) {
          return;
        }

        setRowError(
          await getErrorMessage(response, "Unable to delete this shift"),
        );
        return;
      }

      setShiftsByMentor((current) => ({
        ...current,
        [mentorId]: current[mentorId].filter((shift) => shift.id !== shiftId),
      }));
      setDeleteShiftId(null);
      await loadShiftStatuses();
    } catch {
      setRowError("Unable to delete this shift");
    } finally {
      setDeletingShiftId(null);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 rounded-2xl bg-gradient-to-r from-sky-700 via-indigo-700 to-blue-800 p-6 shadow-lg sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Mentors
          </h1>
          <p className="mt-1 text-sm text-blue-100">
            Review mentor activity and manage timesheets.
          </p>
        </div>
        <div className="w-full sm:max-w-xs">
          <label
            htmlFor="mentor-search"
            className="block text-sm font-medium text-blue-100"
          >
            Search
          </label>
          <input
            id="mentor-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name or email"
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-slate-100"
          />
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}

      <section className="rounded-2xl border border-green-200 bg-green-50 shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-950">
            Currently clocked in
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Live mentor shift status.
          </p>
        </div>
        <div className="divide-y divide-slate-100">
          {isLoading ? (
            <p className="px-5 py-6 text-sm font-medium text-slate-500">
              Loading shift status...
            </p>
          ) : null}
          {!isLoading && clockedInMentors.length === 0 ? (
            <p className="px-5 py-6 text-sm font-medium text-slate-500">
              No mentors are currently clocked in.
            </p>
          ) : null}
          {!isLoading
            ? clockedInMentors.map((mentor) => {
                const activeShift = mentor.mostRecentShift;

                if (!activeShift) {
                  return null;
                }

                return (
                  <div
                    key={mentor.id}
                    className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-950">
                          {mentor.name}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-600">
                        Clocked in at {timeFormatter.format(new Date(activeShift.clockInAt))}
                        <span className="mx-2 text-slate-300">•</span>
                        <span className="font-semibold text-amber-700">
                          {formatElapsed(activeShift.clockInAt, now)}
                        </span>
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={clockingOutId === mentor.id}
                      onClick={() => void forceClockOut(mentor.id)}
                      className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
                    >
                      {clockingOutId === mentor.id
                        ? "Clocking out..."
                        : "Clock out"}
                    </button>
                  </div>
                );
              })
            : null}
        </div>
      </section>

      <section>
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-slate-950">
            Mentor overview
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Appointment load and accumulated hours.
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {isLoading ? (
            <div className="rounded-xl border border-slate-200 bg-white px-6 py-10 text-center text-sm font-medium text-slate-500 shadow-sm lg:col-span-2">
              Loading mentors...
            </div>
          ) : null}
          {!isLoading && filteredMentors.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white px-6 py-10 text-center text-sm font-medium text-slate-500 shadow-sm lg:col-span-2">
              No mentors found.
            </div>
          ) : null}
          {!isLoading
            ? filteredMentors.map((mentor) => (
                <article
                  key={mentor.id}
                  className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-slate-950">
                        {mentor.name}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {mentor.email}
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 text-sm">
                    <div>
                      <span className="block text-slate-500">Today</span>
                      <span className="mt-1 block font-semibold text-slate-800">
                        {mentor.todaysAppointmentCount} appointments
                      </span>
                    </div>
                    <div>
                      <span className="block text-slate-500">Total hours</span>
                      <span className="mt-1 block font-semibold text-slate-800">
                        {mentor.totalHours.toFixed(1)} hours
                      </span>
                    </div>
                  </div>
                </article>
              ))
            : null}
        </div>
      </section>

      <section>
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-slate-950">
            Full timesheets
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Expand a mentor to edit or remove individual shifts.
          </p>
        </div>
        <div className="space-y-3">
          {!isLoading
            ? filteredMentors.map((mentor) => {
                const isExpanded = expandedIds.has(mentor.id);
                const shifts = shiftsByMentor[mentor.id] ?? [];
                const totalMinutes = getTotalMinutes(shifts);

                return (
                  <article
                    key={mentor.id}
                    className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                  >
                    <button
                      type="button"
                      onClick={() => void toggleTimesheet(mentor.id)}
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-slate-50"
                    >
                      <span>
                        <span className="block font-semibold text-slate-950">
                          {mentor.name}
                        </span>
                        <span className="mt-1 block text-sm text-slate-500">
                          {mentor.email}
                        </span>
                      </span>
                      <span className="text-sm font-semibold text-slate-600">
                        {isExpanded ? "Hide timesheet" : "Show timesheet"}
                      </span>
                    </button>

                    {isExpanded ? (
                      <div className="border-t border-slate-200">
                        {loadingShiftIds.has(mentor.id) ? (
                          <p className="px-5 py-6 text-sm font-medium text-slate-500">
                            Loading timesheet...
                          </p>
                        ) : null}
                        {!loadingShiftIds.has(mentor.id) &&
                        shifts.length === 0 ? (
                          <p className="px-5 py-6 text-sm font-medium text-slate-500">
                            No shifts found.
                          </p>
                        ) : null}
                        {!loadingShiftIds.has(mentor.id) &&
                        shifts.length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="min-w-full">
                              <thead className="border-b border-slate-200 bg-slate-50">
                                <tr>
                                  {[
                                    "Date",
                                    "Clock in",
                                    "Clock out",
                                    "Duration",
                                    "Actions",
                                  ].map((heading) => (
                                    <th
                                      key={heading}
                                      className="whitespace-nowrap px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                                    >
                                      {heading}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {shifts.map((shift) => {
                                  const isEditing =
                                    editState?.shiftId === shift.id;
                                  const isDeleting =
                                    deleteShiftId === shift.id;

                                  if (isDeleting) {
                                    return (
                                      <tr key={shift.id}>
                                        <td
                                          colSpan={5}
                                          className="bg-red-50 px-5 py-4"
                                        >
                                          <div className="flex flex-wrap items-center gap-3">
                                            <span className="text-sm font-semibold text-red-800">
                                              Delete this shift?
                                            </span>
                                            <button
                                              type="button"
                                              disabled={
                                                deletingShiftId === shift.id
                                              }
                                              onClick={() =>
                                                void deleteShift(
                                                  mentor.id,
                                                  shift.id,
                                                )
                                              }
                                              className="text-sm font-semibold text-red-700 hover:text-red-900 disabled:opacity-50"
                                            >
                                              {deletingShiftId === shift.id
                                                ? "Deleting..."
                                                : "Confirm"}
                                            </button>
                                            <button
                                              type="button"
                                              disabled={
                                                deletingShiftId === shift.id
                                              }
                                              onClick={() => {
                                                setDeleteShiftId(null);
                                                setRowError(null);
                                              }}
                                              className="text-sm font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-50"
                                            >
                                              Cancel
                                            </button>
                                          </div>
                                          {rowError ? (
                                            <p className="mt-2 text-sm font-medium text-red-700">
                                              {rowError}
                                            </p>
                                          ) : null}
                                        </td>
                                      </tr>
                                    );
                                  }

                                  return (
                                    <tr key={shift.id}>
                                      <td className="whitespace-nowrap px-5 py-3 text-sm text-slate-600">
                                        {dateFormatter.format(
                                          new Date(shift.clockInAt),
                                        )}
                                      </td>
                                      <td className="whitespace-nowrap px-5 py-3 text-sm text-slate-600">
                                        {isEditing ? (
                                          <input
                                            type="datetime-local"
                                            value={editState.clockInAt}
                                            onChange={(event) =>
                                              setEditState({
                                                ...editState,
                                                clockInAt: event.target.value,
                                              })
                                            }
                                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-slate-100"
                                          />
                                        ) : (
                                          timeFormatter.format(
                                            new Date(shift.clockInAt),
                                          )
                                        )}
                                      </td>
                                      <td className="whitespace-nowrap px-5 py-3 text-sm text-slate-600">
                                        {isEditing ? (
                                          <input
                                            type="datetime-local"
                                            value={editState.clockOutAt}
                                            onChange={(event) =>
                                              setEditState({
                                                ...editState,
                                                clockOutAt: event.target.value,
                                              })
                                            }
                                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-slate-100"
                                          />
                                        ) : shift.clockOutAt ? (
                                          <span className="font-medium text-green-800">
                                            {timeFormatter.format(
                                              new Date(shift.clockOutAt),
                                            )}
                                          </span>
                                        ) : (
                                          <span className="font-semibold text-amber-700">
                                            Still clocked in
                                          </span>
                                        )}
                                      </td>
                                      <td className="whitespace-nowrap px-5 py-3 text-sm font-medium text-slate-700">
                                        {shift.clockOutAt
                                          ? formatDuration(
                                              shift.clockInAt,
                                              shift.clockOutAt,
                                            )
                                          : "—"}
                                      </td>
                                      <td className="whitespace-nowrap px-5 py-3">
                                        {isEditing ? (
                                          <div className="flex items-center gap-3">
                                            <button
                                              type="button"
                                              disabled={
                                                savingShiftId === shift.id
                                              }
                                              onClick={() => void saveShift()}
                                              className="text-sm font-semibold text-indigo-700 hover:text-indigo-900 disabled:opacity-50"
                                            >
                                              {savingShiftId === shift.id
                                                ? "Saving..."
                                                : "Save"}
                                            </button>
                                            <button
                                              type="button"
                                              disabled={
                                                savingShiftId === shift.id
                                              }
                                              onClick={() => {
                                                setEditState(null);
                                                setRowError(null);
                                              }}
                                              className="text-sm font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-50"
                                            >
                                              Cancel
                                            </button>
                                          </div>
                                        ) : (
                                          <div className="flex items-center gap-2">
                                            <button
                                              type="button"
                                              aria-label="Edit shift"
                                              title="Edit shift"
                                              onClick={() =>
                                                beginEdit(mentor.id, shift)
                                              }
                                              className="rounded-md border border-slate-200 p-2 text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                                            >
                                              <PencilIcon />
                                            </button>
                                            <button
                                              type="button"
                                              aria-label="Delete shift"
                                              title="Delete shift"
                                              onClick={() => {
                                                setEditState(null);
                                                setRowError(null);
                                                setDeleteShiftId(shift.id);
                                              }}
                                              className="rounded-md border border-slate-200 p-2 text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                                            >
                                              <TrashIcon />
                                            </button>
                                          </div>
                                        )}
                                        {isEditing && rowError ? (
                                          <p className="mt-2 max-w-xs whitespace-normal text-sm font-medium text-red-700">
                                            {rowError}
                                          </p>
                                        ) : null}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                              <tfoot>
                                <tr className="border-t-2 border-slate-200 bg-slate-50">
                                  <td
                                    colSpan={5}
                                    className="px-5 py-3 text-sm font-semibold text-slate-800"
                                  >
                                    Total: {Math.floor(totalMinutes / 60)} hours{" "}
                                    {totalMinutes % 60} minutes
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                );
              })
            : null}
        </div>
      </section>
    </div>
  );
}
