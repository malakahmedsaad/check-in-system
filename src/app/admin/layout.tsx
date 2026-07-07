"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useUser } from "../../../context/UserContext";

const navItems = [
  { href: "/admin/overview", label: "Overview" },
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
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-base font-semibold tracking-tight text-slate-950 sm:text-lg">
              Bechtel Center Admin
            </p>
            <nav className="mt-3 flex flex-wrap gap-2">
              {navItems.map((item) => {
                const isActive = pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                      isActive
                        ? "bg-slate-900 text-white"
                        : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
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
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:scale-[1.02] hover:border-slate-400 hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        {isUserLoading ? (
          <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
              Loading admin access...
            </h1>
          </div>
        ) : user?.role !== "admin" ? (
          <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
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
