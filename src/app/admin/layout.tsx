"use client";

// Purpose: Provides admin navigation and the client-side admin access gate.

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useUser } from "../../../context/UserContext";

const navItems = [
  { href: "/admin/overview", label: "Overview" },
  { href: "/admin/checkin", label: "Check-in" },
  { href: "/admin/kiosk", label: "Kiosk" },
  { href: "/admin/guests", label: "Guests" },
  { href: "/admin/students", label: "Students" },
  { href: "/admin/mentors", label: "Mentors" },
  { href: "/admin/settings", label: "Settings" },
];

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const { user, isUserLoading, logout } = useUser();

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="h-auto bg-white shadow md:h-16">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 md:h-16 md:flex-row md:items-center md:justify-between md:py-0 lg:px-8">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-8">
            <p className="text-lg font-semibold text-slate-900">
              Bechtel Center Admin
            </p>
            <nav className="flex flex-wrap gap-1 md:h-16 md:items-center">
              {navItems.map((item) => {
                const isActive = pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-3 py-2 text-sm font-medium transition-colors md:flex md:h-16 md:items-center ${
                      isActive
                        ? "border-b-2 border-indigo-600 text-indigo-600"
                        : "text-gray-700 hover:text-indigo-600"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <p className="hidden text-sm font-medium text-slate-600 sm:block">
              {user?.name ?? "Admin"}
            </p>
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

      <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {isUserLoading ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
            <h1 className="text-2xl font-bold text-slate-900">
              Loading admin access...
            </h1>
          </div>
        ) : user?.role !== "admin" ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
            <h1 className="text-2xl font-bold text-slate-900">
              You do not have access to this page
            </h1>
          </div>
        ) : (
          children
        )}
      </section>
    </main>
  );
}
