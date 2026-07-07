"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type KioskStatus = {
  isOpen: boolean;
};

type LandingOption = {
  title: string;
  description: string;
  href: string;
  icon: "guest" | "student" | "mentor";
};

const options: LandingOption[] = [
  {
    title: "Guest",
    description: "Just visiting? Sign in here",
    href: "/guest",
    icon: "guest",
  },
  {
    title: "Student",
    description: "Check in to your appointment",
    href: "/login",
    icon: "student",
  },
  {
    title: "Peer mentor",
    description: "Clock in and view your schedule",
    href: "/login",
    icon: "mentor",
  },
];

function OptionIcon({ icon }: { icon: LandingOption["icon"] }) {
  if (icon === "guest") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-10 w-10"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      >
        <path d="M8 7a4 4 0 1 0 8 0 4 4 0 0 0-8 0Z" />
        <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
      </svg>
    );
  }

  if (icon === "student") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-10 w-10"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      >
        <path d="m3 8 9-4 9 4-9 4-9-4Z" />
        <path d="m7 10 0 5c0 1.7 2.2 3 5 3s5-1.3 5-3v-5" />
        <path d="M21 8v6" />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-10 w-10"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    >
      <path d="M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
      <path d="M5 21a7 7 0 0 1 14 0" />
      <path d="M17.5 4.5 20 2" />
      <path d="m20 2 1 4" />
    </svg>
  );
}

export default function Home() {
  const [status, setStatus] = useState<KioskStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadKioskStatus() {
      try {
        const response = await fetch("/api/admin/kiosk");

        if (!response.ok) {
          throw new Error("Unable to load kiosk status");
        }

        const data = (await response.json()) as KioskStatus;

        if (isMounted) {
          setStatus(data);
        }
      } catch {
        if (isMounted) {
          setError("Unable to load kiosk status");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadKioskStatus();

    return () => {
      isMounted = false;
    };
  }, []);

  const isOpen = status?.isOpen ?? false;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-950 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-6xl flex-col">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-base font-semibold text-slate-950 sm:text-lg">
              Bechtel Center Check-In Kiosk
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Choose how you are visiting today.
            </p>
          </div>
          {isOpen ? (
            <Link
              href="/admin/login"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-950"
            >
              Staff
            </Link>
          ) : null}
        </header>

        <section className="flex flex-1 items-center justify-center py-12">
          {isLoading ? (
            <p className="text-lg font-medium text-slate-500">
              Checking kiosk status...
            </p>
          ) : error ? (
            <div className="max-w-md text-center">
              <h1 className="text-3xl font-semibold text-slate-950">
                We could not load kiosk status
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                Please try again in a moment or ask staff for help.
              </p>
              <Link
                href="/admin/login"
                className="mt-8 inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-950"
              >
                Staff sign in
              </Link>
            </div>
          ) : !isOpen ? (
            <div className="max-w-md text-center">
              <h1 className="text-3xl font-semibold text-slate-950">
                Kiosk is currently closed
              </h1>
              <Link
                href="/admin/login"
                className="mt-8 inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-950"
              >
                Staff sign in
              </Link>
            </div>
          ) : (
            <div className="w-full">
              <div className="grid gap-4 md:grid-cols-3">
                {options.map((option) => (
                  <Link
                    key={option.title}
                    href={option.href}
                    className="group flex min-h-56 flex-col rounded-lg border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-indigo-200 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-indigo-100"
                  >
                    <span className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 transition group-hover:bg-indigo-600 group-hover:text-white">
                      <OptionIcon icon={option.icon} />
                    </span>
                    <span className="mt-8 text-3xl font-semibold text-slate-950">
                      {option.title}
                    </span>
                    <span className="mt-3 text-base leading-7 text-slate-500">
                      {option.description}
                    </span>
                  </Link>
                ))}
              </div>
              <p className="mx-auto mt-6 max-w-2xl text-center text-xs leading-5 text-slate-400">
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
