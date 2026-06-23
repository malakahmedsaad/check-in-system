import { NextResponse } from "next/server";

import { prisma } from "../../../../../../lib/prisma";
import { requireAdmin } from "../../../../../../lib/require-admin";

type AnalyticsRange = "day" | "week" | "month";

type Bucket = {
  key: string;
  label: string;
  start: Date;
  count: number;
};

const dayLabelFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const monthLabelFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
});

function startOfDay(date: Date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

function startOfWeek(date: Date) {
  const nextDate = startOfDay(date);
  const day = nextDate.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  nextDate.setDate(nextDate.getDate() + mondayOffset);
  return nextDate;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function keyForDate(date: Date, range: AnalyticsRange) {
  if (range === "month") {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
      2,
      "0",
    )}`;
  }

  return date.toISOString().slice(0, 10);
}

function labelForDate(date: Date, range: AnalyticsRange) {
  if (range === "month") {
    return monthLabelFormatter.format(date);
  }

  return dayLabelFormatter.format(date);
}

function getRange(searchParams: URLSearchParams): AnalyticsRange {
  const range = searchParams.get("range");

  if (range === "day" || range === "week" || range === "month") {
    return range;
  }

  return "week";
}

function createBuckets(range: AnalyticsRange) {
  const today = new Date();

  if (range === "day") {
    const start = addDays(startOfDay(today), -6);
    const buckets = Array.from({ length: 7 }, (_, index) => {
      const bucketStart = addDays(start, index);
      return {
        key: keyForDate(bucketStart, range),
        label: labelForDate(bucketStart, range),
        start: bucketStart,
        count: 0,
      };
    });

    return { buckets, start };
  }

  if (range === "month") {
    const start = addMonths(startOfMonth(today), -5);
    const buckets = Array.from({ length: 6 }, (_, index) => {
      const bucketStart = addMonths(start, index);
      return {
        key: keyForDate(bucketStart, range),
        label: labelForDate(bucketStart, range),
        start: bucketStart,
        count: 0,
      };
    });

    return { buckets, start };
  }

  const start = addDays(startOfWeek(today), -49);
  const buckets = Array.from({ length: 8 }, (_, index) => {
    const bucketStart = addDays(start, index * 7);
    return {
      key: keyForDate(bucketStart, range),
      label: `Week of ${labelForDate(bucketStart, range)}`,
      start: bucketStart,
      count: 0,
    };
  });

  return { buckets, start };
}

function bucketKeyForCheckin(date: Date, range: AnalyticsRange) {
  if (range === "day") {
    return keyForDate(startOfDay(date), range);
  }

  if (range === "month") {
    return keyForDate(startOfMonth(date), range);
  }

  return keyForDate(startOfWeek(date), range);
}

export async function GET(request: Request) {
  try {
    const session = await requireAdmin();

    if (!session) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const range = getRange(searchParams);
    const { buckets, start } = createBuckets(range);
    const bucketMap = new Map<string, Bucket>(
      buckets.map((bucket) => [bucket.key, bucket]),
    );

    const checkins = await prisma.checkin.findMany({
      where: {
        checkedInAt: {
          gte: start,
        },
      },
      select: {
        checkedInAt: true,
      },
    });

    checkins.forEach((checkin) => {
      const key = bucketKeyForCheckin(checkin.checkedInAt, range);
      const bucket = bucketMap.get(key);

      if (bucket) {
        bucket.count += 1;
      }
    });

    return NextResponse.json(
      buckets.map((bucket) => ({
        label: bucket.label,
        count: bucket.count,
      })),
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
