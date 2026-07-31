"use client";

// Purpose: Manages semester periods, mentor-hour totals, resets, and exports.

import { useCallback, useEffect, useMemo, useState } from "react";

import { useUser } from "../../../../context/UserContext";

type MentorHours = {
  mentorId: number;
  name: string;
  email: string;
  totalHours: number;
};

type SemesterReset = {
  id: string;
  resetAt: string;
  resetByName: string;
  note: string | null;
};

type Semester = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdAt: string;
  createdBy: string;
  _count: { resets: number };
  hoursPerMentor?: MentorHours[];
};

type SemesterDetails = Omit<Semester, "_count"> & {
  resets: SemesterReset[];
  hoursPerMentor: MentorHours[];
  grandTotalHours: number;
};

const semesterDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
  year: "numeric",
});

const resetDateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDateRange(semester: Pick<Semester, "startDate" | "endDate">) {
  return `${semesterDateFormatter.format(new Date(semester.startDate))} — ${semesterDateFormatter.format(new Date(semester.endDate))}`;
}

async function getErrorMessage(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === "string" ? body.error : fallback;
  } catch {
    return fallback;
  }
}

function HoursTable({ hours }: { hours: MentorHours[] }) {
  const totalHours = hours.reduce((total, mentor) => total + mentor.totalHours, 0);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full">
        <thead className="border-b border-slate-200 bg-slate-50">
          <tr>
            {["Mentor Name", "Mentor Email", "Hours This Semester", "% of Total"].map(
              (heading) => (
                <th
                  key={heading}
                  className="whitespace-nowrap px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  {heading}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {hours.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-5 py-8 text-center text-sm text-slate-500">
                No completed mentor shifts in this semester.
              </td>
            </tr>
          ) : (
            hours.map((mentor) => (
              <tr key={mentor.mentorId}>
                <td className="whitespace-nowrap px-5 py-3 text-sm font-medium text-slate-900">
                  {mentor.name}
                </td>
                <td className="whitespace-nowrap px-5 py-3 text-sm text-slate-600">
                  {mentor.email || "—"}
                </td>
                <td className="whitespace-nowrap px-5 py-3 text-sm font-semibold text-slate-800">
                  {mentor.totalHours.toFixed(1)} hrs
                </td>
                <td className="whitespace-nowrap px-5 py-3 text-sm text-slate-600">
                  {totalHours > 0
                    ? `${((mentor.totalHours / totalHours) * 100).toFixed(1)}%`
                    : "0.0%"}
                </td>
              </tr>
            ))
          )}
          <tr className="border-t-2 border-slate-200 font-bold">
            <td className="px-5 py-3 text-sm text-slate-950">Total</td>
            <td className="px-5 py-3" />
            <td className="whitespace-nowrap px-5 py-3 text-sm text-slate-950">
              {totalHours.toFixed(1)} hrs
            </td>
            <td className="whitespace-nowrap px-5 py-3 text-sm text-slate-950">
              {totalHours > 0 ? "100.0%" : "0.0%"}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function AdminSemestersPage() {
  const { logout } = useUser();
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [detailsById, setDetailsById] = useState<Record<string, SemesterDetails>>({});
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [loadingDetailsId, setLoadingDetailsId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetNote, setResetNote] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [activateImmediately, setActivateImmediately] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [activatingId, setActivatingId] = useState<string | null>(null);

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

  const loadSemesters = useCallback(async () => {
    const response = await fetch("/api/admin/semesters", { credentials: "include" });
    if (!response.ok) {
      if (await handleUnauthorized(response)) return;
      throw new Error(await getErrorMessage(response, "Unable to load semesters"));
    }
    setSemesters((await response.json()) as Semester[]);
  }, [handleUnauthorized]);

  useEffect(() => {
    let mounted = true;
    async function loadPage() {
      try {
        await loadSemesters();
      } catch (loadError) {
        if (mounted) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load semesters");
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    void loadPage();
    return () => {
      mounted = false;
    };
  }, [loadSemesters]);

  const activeSemester = useMemo(
    () => semesters.find((semester) => semester.isActive) ?? null,
    [semesters],
  );
  const activeHours = activeSemester?.hoursPerMentor ?? [];
  const activeTotal = activeHours.reduce((total, mentor) => total + mentor.totalHours, 0);

  async function refreshData() {
    setDetailsById({});
    await loadSemesters();
  }

  async function toggleSemester(id: string) {
    if (expandedIds.has(id)) {
      setExpandedIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      return;
    }

    setExpandedIds((current) => new Set(current).add(id));
    if (detailsById[id]) return;
    setLoadingDetailsId(id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/semesters/${encodeURIComponent(id)}`, {
        credentials: "include",
      });
      if (!response.ok) {
        if (await handleUnauthorized(response)) return;
        throw new Error(await getErrorMessage(response, "Unable to load semester details"));
      }
      const details = (await response.json()) as SemesterDetails;
      setDetailsById((current) => ({ ...current, [id]: details }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load semester details");
    } finally {
      setLoadingDetailsId(null);
    }
  }

  async function activate(id: string) {
    setActivatingId(id);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/admin/semesters/${encodeURIComponent(id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "activate" }),
      });
      if (!response.ok) {
        if (await handleUnauthorized(response)) return;
        throw new Error(await getErrorMessage(response, "Unable to activate semester"));
      }
      await refreshData();
      setResetOpen(false);
      setSuccess("Semester activated successfully.");
    } catch (activateError) {
      setError(activateError instanceof Error ? activateError.message : "Unable to activate semester");
    } finally {
      setActivatingId(null);
    }
  }

  async function confirmReset() {
    if (!activeSemester) return;
    setIsResetting(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(
        `/api/admin/semesters/${encodeURIComponent(activeSemester.id)}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "reset", note: resetNote }),
        },
      );
      if (!response.ok) {
        if (await handleUnauthorized(response)) return;
        throw new Error(await getErrorMessage(response, "Unable to reset semester"));
      }
      await refreshData();
      setResetNote("");
      setResetOpen(false);
      setSuccess("Semester reset logged successfully.");
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Unable to reset semester");
    } finally {
      setIsResetting(false);
    }
  }

  async function createNewSemester(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCreating(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/admin/semesters", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, startDate, endDate }),
      });
      if (!response.ok) {
        if (await handleUnauthorized(response)) return;
        throw new Error(await getErrorMessage(response, "Unable to create semester"));
      }
      const created = (await response.json()) as Semester;
      if (activateImmediately) {
        const activateResponse = await fetch(
          `/api/admin/semesters/${encodeURIComponent(created.id)}`,
          {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "activate" }),
          },
        );
        if (!activateResponse.ok) {
          if (await handleUnauthorized(activateResponse)) return;
          throw new Error(
            await getErrorMessage(activateResponse, "Semester was created but could not be activated"),
          );
        }
      }
      setName("");
      setStartDate("");
      setEndDate("");
      setActivateImmediately(false);
      await refreshData();
      setSuccess("Semester created successfully.");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create semester");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="space-y-8">
      {success ? (
        <div role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
          {success}
        </div>
      ) : null}
      {error ? (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      ) : null}

      <section>
        {isLoading ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center text-sm font-medium text-slate-500 shadow-sm">
            Loading semester data...
          </div>
        ) : activeSemester ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="bg-gradient-to-r from-sky-700 via-indigo-700 to-blue-800 p-6">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-100">Active semester</p>
                  <h1 className="mt-1 text-2xl font-bold text-white">{activeSemester.name}</h1>
                  <p className="mt-1 text-sm text-blue-100">{formatDateRange(activeSemester)}</p>
                  <p className="mt-4 text-3xl font-bold text-white">{activeTotal.toFixed(1)} hrs total</p>
                </div>
                <div className="flex flex-wrap gap-3 sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setResetOpen((open) => !open)}
                    className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-white/70"
                  >
                    Reset semester
                  </button>
                  <a
                    href={`/api/admin/semesters/export?semesterId=${encodeURIComponent(activeSemester.id)}`}
                    className="rounded-lg border border-white/60 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/70"
                  >
                    Export CSV
                  </a>
                </div>
              </div>
              <div className={`grid transition-all duration-300 ${resetOpen ? "mt-5 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                <div className="overflow-hidden">
                  <div className="rounded-xl bg-white/95 p-4 shadow-sm">
                    <p className="text-sm font-medium text-slate-800">
                      This will log a reset point for {activeSemester.name}. No shift records will be deleted.
                    </p>
                    <textarea
                      value={resetNote}
                      onChange={(event) => setResetNote(event.target.value)}
                      placeholder="Add a note (optional)"
                      rows={2}
                      className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={isResetting}
                        onClick={() => void confirmReset()}
                        className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-50"
                      >
                        {isResetting ? "Logging reset..." : "Confirm reset"}
                      </button>
                      <button
                        type="button"
                        disabled={isResetting}
                        onClick={() => {
                          setResetOpen(false);
                          setResetNote("");
                        }}
                        className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <HoursTable hours={activeHours} />
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-slate-100 px-6 py-10 text-center text-sm font-medium text-slate-600 shadow-sm">
            No active semester. Create one below or activate an existing semester.
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Create semester period</h2>
        <form onSubmit={(event) => void createNewSemester(event)} className="mt-5">
          <div className="grid gap-4 md:grid-cols-3">
            <label className="text-sm font-medium text-slate-700">
              Semester name
              <input
                required
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Fall 2025"
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Start date
              <input
                required
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              End date
              <input
                required
                type="date"
                min={startDate || undefined}
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={isCreating}
            className="mt-5 rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {isCreating ? "Creating semester..." : "Create semester"}
          </button>
          <label className="mt-3 flex w-fit items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={activateImmediately}
              onChange={(event) => setActivateImmediately(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            Set as active semester immediately
          </label>
        </form>
      </section>

      <section>
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-slate-950">Semester history</h2>
          <p className="mt-1 text-sm text-slate-500">Expand a semester to review mentor hours and reset history.</p>
        </div>
        <div className="space-y-3">
          {!isLoading && semesters.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500 shadow-sm">
              No semesters have been created.
            </div>
          ) : null}
          {semesters.map((semester) => {
            const isExpanded = expandedIds.has(semester.id);
            const details = detailsById[semester.id];
            return (
              <article key={semester.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    onClick={() => void toggleSemester(semester.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-950">{semester.name}</span>
                      {semester.isActive ? (
                        <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-800">Active</span>
                      ) : null}
                      <span className="text-xs text-slate-400">
                        {semester._count.resets} {semester._count.resets === 1 ? "reset" : "resets"}
                      </span>
                    </span>
                    <span className="mt-1 block text-sm text-slate-500">{formatDateRange(semester)}</span>
                  </button>
                  <div className="flex flex-wrap items-center gap-2">
                    {!semester.isActive ? (
                      <button
                        type="button"
                        disabled={activatingId === semester.id}
                        onClick={() => void activate(semester.id)}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        {activatingId === semester.id ? "Activating..." : "Activate"}
                      </button>
                    ) : null}
                    <a
                      href={`/api/admin/semesters/export?semesterId=${encodeURIComponent(semester.id)}`}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Export
                    </a>
                    <button
                      type="button"
                      onClick={() => void toggleSemester(semester.id)}
                      className="px-2 py-1.5 text-xs font-semibold text-indigo-700 hover:text-indigo-900"
                    >
                      {isExpanded ? "Hide details" : "Show details"}
                    </button>
                  </div>
                </div>

                {isExpanded ? (
                  <div className="border-t border-slate-200">
                    {loadingDetailsId === semester.id || !details ? (
                      <p className="px-5 py-8 text-sm font-medium text-slate-500">Loading semester details...</p>
                    ) : (
                      <>
                        <HoursTable hours={details.hoursPerMentor} />
                        <div className="border-t border-slate-200 p-5">
                          <h3 className="text-sm font-semibold text-slate-950">Reset history</h3>
                          {details.resets.length === 0 ? (
                            <p className="mt-3 text-sm text-slate-500">No resets recorded for this semester.</p>
                          ) : (
                            <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
                              <table className="min-w-full">
                                <thead className="border-b border-slate-200 bg-slate-50">
                                  <tr>
                                    {["Reset Date", "Reset By", "Note"].map((heading) => (
                                      <th key={heading} className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        {heading}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {details.resets.map((reset) => (
                                    <tr key={reset.id}>
                                      <td className="whitespace-nowrap px-4 py-2 text-sm text-slate-600">{resetDateFormatter.format(new Date(reset.resetAt))}</td>
                                      <td className="whitespace-nowrap px-4 py-2 text-sm text-slate-600">{reset.resetByName}</td>
                                      <td className="px-4 py-2 text-sm text-slate-600">{reset.note || "—"}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
