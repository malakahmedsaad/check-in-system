import { NextResponse } from "next/server";

import {
  addDays,
  addMonths,
  APP_TIME_ZONE,
  getDateKey,
  startOfAppDay,
  startOfAppMonth,
} from "../../../../../../lib/date-time";
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
  timeZone: APP_TIME_ZONE,
  month: "short",
  day: "numeric",
});

const monthLabelFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  month: "short",
  year: "numeric",
});

function startOfWeek(date: Date) {
  const nextDate = startOfAppDay(date);
  const day = nextDate.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return addDays(nextDate, mondayOffset);
}

function keyForDate(date: Date, range: AnalyticsRange) {
  if (range === "month") {
    return getDateKey(date).slice(0, 7);
  }

  return getDateKey(date);
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
    const start = addDays(startOfAppDay(today), -6);
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
    const start = addMonths(startOfAppMonth(today), -5);
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
    return keyForDate(startOfAppDay(date), range);
  }

  if (range === "month") {
    return keyForDate(startOfAppMonth(date), range);
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
