"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useUser } from "../../../../context/UserContext";
import { APP_TIME_ZONE } from "../../../../lib/date-time";

type AnalyticsRange = "day" | "week" | "month";

type OverviewSummary = {
  totalGuestsToday: number;
  totalStudentsCheckedInToday: number;
  totalMentorsClockedIn: number;
};

type CheckinBucket = {
  label: string;
  count: number;
};

type MentorShift = {
  id: string;
  mentorName: string;
  clockInAt: string;
  clockOutAt: string | null;
  durationHours: number | null;
};

const ranges: { value: AnalyticsRange; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const rangeDayCounts: Record<AnalyticsRange, number> = {
  day: 7,
  week: 56,
  month: 183,
};

function formatDateTime(value: string | null) {
  if (!value) {
    return "Still clocked in";
  }

  return dateTimeFormatter.format(new Date(value));
}

function formatDuration(durationHours: number | null, clockOutAt: string | null) {
  if (!clockOutAt || durationHours === null) {
    return "Still clocked in";
  }

  return `${durationHours.toFixed(1)} hours`;
}

export default function AdminOverviewPage() {
  const { logout } = useUser();
  const [range, setRange] = useState<AnalyticsRange>("week");
  const [summary, setSummary] = useState<OverviewSummary | null>(null);
  const [checkins, setCheckins] = useState<CheckinBucket[]>([]);
  const [shifts, setShifts] = useState<MentorShift[]>([]);
  const [isSummaryLoading, setIsSummaryLoading] = useState(true);
  const [isCheckinsLoading, setIsCheckinsLoading] = useState(true);
  const [isShiftsLoading, setIsShiftsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadSummary() {
      try {
        const response = await fetch("/api/admin/overview", {
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

          throw new Error("Unable to load overview summary");
        }

        setSummary((await response.json()) as OverviewSummary);
      } catch (loadError) {
        if (isMounted) {
          setSummary(null);
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load overview summary",
          );
        }
      } finally {
        if (isMounted) {
          setIsSummaryLoading(false);
        }
      }
    }

    loadSummary();

    return () => {
      isMounted = false;
    };
  }, [logout]);

  useEffect(() => {
    let isMounted = true;

    async function loadCheckins() {
      setIsCheckinsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/admin/analytics/checkins?range=${range}`,
          {
            credentials: "include",
          },
        );

        if (!isMounted) {
          return;
        }

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            await logout();
            return;
          }

          throw new Error("Unable to load check-in analytics");
        }

        setCheckins((await response.json()) as CheckinBucket[]);
      } catch (loadError) {
        if (isMounted) {
          setCheckins([]);
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load check-in analytics",
          );
        }
      } finally {
        if (isMounted) {
          setIsCheckinsLoading(false);
        }
      }
    }

    loadCheckins();

    return () => {
      isMounted = false;
    };
  }, [logout, range]);

  useEffect(() => {
    let isMounted = true;

    async function loadShifts() {
      try {
        const response = await fetch("/api/admin/analytics/mentors", {
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

          throw new Error("Unable to load mentor timesheets");
        }

        setShifts((await response.json()) as MentorShift[]);
      } catch (loadError) {
        if (isMounted) {
          setShifts([]);
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load mentor timesheets",
          );
        }
      } finally {
        if (isMounted) {
          setIsShiftsLoading(false);
        }
      }
    }

    loadShifts();

    return () => {
      isMounted = false;
    };
  }, [logout]);

  const checkinSummary = useMemo(() => {
    const total = checkins.reduce((sum, bucket) => sum + bucket.count, 0);
    const average = total / rangeDayCounts[range];
    const busiest = checkins.reduce<CheckinBucket | null>((current, bucket) => {
      if (!current || bucket.count > current.count) {
        return bucket;
      }

      return current;
    }, null);

    return {
      total,
      average,
      busiest,
    };
  }, [checkins, range]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
            Overview
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Daily activity, check-in trends, and mentor timesheets.
          </p>
          <div className="mt-4 flex rounded-lg bg-slate-100 p-1 ring-1 ring-slate-200">
            {ranges.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setRange(item.value)}
                className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
                  range === item.value
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-600 hover:text-slate-950"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}

      <section className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">
            Guests today
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            {isSummaryLoading ? "-" : summary?.totalGuestsToday ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">
            Students checked in today
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            {isSummaryLoading
              ? "-"
              : summary?.totalStudentsCheckedInToday ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">
            Mentors clocked in
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            {isSummaryLoading ? "-" : summary?.totalMentorsClockedIn ?? 0}
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="h-80">
          {isCheckinsLoading ? (
            <div className="flex h-full items-center justify-center text-sm font-medium text-slate-500">
              Loading check-ins...
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={checkins} margin={{ top: 10, right: 10, left: 0 }}>
                <CartesianGrid stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                />
                <Tooltip
                  cursor={{ fill: "#f1f5f9" }}
                  contentStyle={{
                    borderRadius: 8,
                    borderColor: "#cbd5e1",
                    boxShadow: "0 10px 30px rgb(15 23 42 / 0.12)",
                  }}
                />
                <Bar dataKey="count" fill="#4f46e5" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Total check-ins</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            {isCheckinsLoading ? "-" : checkinSummary.total}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Average per day</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            {isCheckinsLoading ? "-" : checkinSummary.average.toFixed(1)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Busiest period</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            {isCheckinsLoading || !checkinSummary.busiest
              ? "-"
              : checkinSummary.busiest.label}
          </p>
          {!isCheckinsLoading && checkinSummary.busiest ? (
            <p className="mt-2 text-sm font-medium text-slate-500">
              {checkinSummary.busiest.count} check-ins
            </p>
          ) : null}
        </div>
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
            Mentor timesheets
          </h2>
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                    Mentor name
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
                {isShiftsLoading ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-5 py-10 text-center text-sm font-medium text-slate-500"
                    >
                      Loading mentor timesheets...
                    </td>
                  </tr>
                ) : null}

                {!isShiftsLoading && shifts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-5 py-10 text-center text-sm font-medium text-slate-500"
                    >
                      No mentor shifts found.
                    </td>
                  </tr>
                ) : null}

                {!isShiftsLoading
                  ? shifts.map((shift) => (
                      <tr key={shift.id}>
                        <td className="whitespace-nowrap px-5 py-4 text-sm font-semibold text-slate-950">
                          {shift.mentorName}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">
                          {formatDateTime(shift.clockInAt)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">
                          {formatDateTime(shift.clockOutAt)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-sm font-medium text-slate-700">
                          {formatDuration(
                            shift.durationHours,
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
    </div>
  );
}
