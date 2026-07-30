"use client";

// Purpose: Renders admin student records and booking/check-in history.

import { useEffect, useMemo, useState } from "react";

import { useUser } from "../../../../context/UserContext";
import { APP_TIME_ZONE } from "../../../../lib/date-time";

type Student = {
  id: number;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  bookingsAsStudent: Array<{
      id: number;
      createdAt: string;
      startDate: string;
      endDate: string;
      status: string;
      mentor: { name: string; email: string } | null;
      checkin: {
        checkedInAt: string;
      } | null;
    }>;
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function formatDateTime(value: string) {
  return dateFormatter.format(new Date(value));
}

export default function AdminStudentsPage() {
  const { logout } = useUser();
  const [students, setStudents] = useState<Student[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadStudents() {
      try {
        const response = await fetch("/api/admin/students", {
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

          throw new Error("Unable to load students");
        }

        setStudents((await response.json()) as Student[]);
      } catch (loadError) {
        if (isMounted) {
          setStudents([]);
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load students",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadStudents();

    return () => {
      isMounted = false;
    };
  }, [logout]);

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return students;
    }

    return students.filter(
      (student) =>
        student.name.toLowerCase().includes(query) ||
        student.email.toLowerCase().includes(query),
    );
  }, [search, students]);

  function toggleExpanded(studentId: number) {
    setExpandedIds((current) => {
      const next = new Set(current);

      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }

      return next;
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl bg-gradient-to-r from-sky-700 via-indigo-700 to-blue-800 p-6 shadow-lg sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Students
          </h1>
          <p className="mt-1 text-sm text-blue-100">
            Search students and review booking history.
          </p>
        </div>
        <div className="w-full sm:max-w-xs">
          <label
            htmlFor="student-search"
            className="block text-sm font-medium text-blue-100"
          >
            Search
          </label>
          <input
            id="student-search"
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

      <div className="space-y-3">
        {isLoading ? (
          <div className="rounded-xl border border-slate-200 bg-white px-6 py-10 text-center text-sm font-medium text-slate-500 shadow-sm">
            Loading students...
          </div>
        ) : null}

        {!isLoading && filteredStudents.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white px-6 py-10 text-center text-sm font-medium text-slate-500 shadow-sm">
            No students found.
          </div>
        ) : null}

        {!isLoading
          ? filteredStudents.map((student) => {
              const isExpanded = expandedIds.has(student.id);

              return (
                <section
                  key={student.id}
                  className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => toggleExpanded(student.id)}
                    className="flex w-full flex-col gap-3 px-5 py-4 text-left transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span>
                      <span className="block text-base font-semibold text-slate-950">
                        {student.name}
                      </span>
                      <span className="mt-1 block text-sm text-slate-500">
                        {student.email}
                      </span>
                    </span>
                    <span className="text-sm font-semibold text-slate-600">
                      {isExpanded ? "Hide bookings" : "Show bookings"}
                    </span>
                  </button>

                  {isExpanded ? (
                    <div className="border-l-4 border-indigo-200 bg-indigo-50 px-5 py-4">
                      {student.bookingsAsStudent.length === 0 ? (
                        <p className="text-sm font-medium text-slate-500">
                          No bookings found.
                        </p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-slate-200">
                            <thead>
                              <tr>
                                <th className="py-2 pr-5 text-left text-xs font-semibold uppercase text-slate-500">
                                  Date
                                </th>
                                <th className="px-5 py-2 text-left text-xs font-semibold uppercase text-slate-500">
                                  Mentor
                                </th>
                                <th className="px-5 py-2 text-left text-xs font-semibold uppercase text-slate-500">
                                  Status
                                </th>
                                <th className="pl-5 py-2 text-left text-xs font-semibold uppercase text-slate-500">
                                  Check-in
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {student.bookingsAsStudent.map((booking) => (
                                <tr key={booking.id} className="hover:bg-slate-50">
                                  <td className="whitespace-nowrap py-3 pr-5 text-sm text-slate-600">
                                    {formatDateTime(booking.startDate)}
                                  </td>
                                  <td className="whitespace-nowrap px-5 py-3 text-sm font-medium text-slate-700">
                                    {booking.mentor?.name ?? "Unassigned"}
                                  </td>
                                  <td className="whitespace-nowrap px-5 py-3 text-sm text-slate-600">
                                    {booking.status}
                                  </td>
                                  <td className="whitespace-nowrap pl-5 py-3 text-sm text-slate-600">
                                    {booking.checkin
                                      ? `Checked in ${formatDateTime(
                                          booking.checkin.checkedInAt,
                                        )}`
                                      : "Not checked in"}
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
