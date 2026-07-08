import { BookingStatus, MentorType, PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();
const kioskStatusId = "singleton";

const admin = {
  email: "admin@purdue.edu",
  name: "Front desk staff",
  role: Role.admin,
  mentorType: null,
};

const mentors = [
  {
    email: "mentor1@purdue.edu",
    name: "Alex Johnson",
    role: Role.mentor,
    mentorType: MentorType.CONSULTATION,
  },
  {
    email: "mentor2@purdue.edu",
    name: "Sam Rivera",
    role: Role.mentor,
    mentorType: MentorType.LAB,
  },
  {
    email: "mentor3@purdue.edu",
    name: "Jordan Lee",
    role: Role.mentor,
    mentorType: MentorType.CONSULTATION,
  },
];

const students = [
  { email: "student1@purdue.edu", name: "Taylor Smith", role: Role.student },
  { email: "student2@purdue.edu", name: "Morgan Davis", role: Role.student },
  { email: "student3@purdue.edu", name: "Casey Brown", role: Role.student },
  { email: "student4@purdue.edu", name: "Riley Wilson", role: Role.student },
  { email: "student5@purdue.edu", name: "Avery Martinez", role: Role.student },
];

function daysFromNow(days: number, hour: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date;
}

async function main() {
  const adminUser = await prisma.user.upsert({
    where: { email: admin.email },
    update: {
      name: admin.name,
      role: admin.role,
      mentorType: admin.mentorType,
    },
    create: admin,
  });
  console.log(`Admin user upserted: ${adminUser.email}`);

  const mentorUsers = await Promise.all(
    mentors.map((mentor) =>
      prisma.user.upsert({
        where: { email: mentor.email },
        update: {
          name: mentor.name,
          role: mentor.role,
          mentorType: mentor.mentorType,
        },
        create: mentor,
      }),
    ),
  );
  console.log(
    `Mentor users upserted: ${mentorUsers
      .map((mentor) => mentor.email)
      .join(", ")}`,
  );

  const studentUsers = await Promise.all(
    students.map((student) =>
      prisma.user.upsert({
        where: { email: student.email },
        update: {
          name: student.name,
          role: student.role,
          mentorType: null,
        },
        create: {
          ...student,
          mentorType: null,
        },
      }),
    ),
  );
  console.log(
    `Student users upserted: ${studentUsers
      .map((student) => student.email)
      .join(", ")}`,
  );

  const kioskStatus = await prisma.kioskStatus.upsert({
    where: { id: kioskStatusId },
    update: {},
    create: {
      id: kioskStatusId,
      isOpen: false,
    },
  });
  console.log(`Kiosk status upserted: ${kioskStatus.id}`);

  const timeslots = await Promise.all(
    mentorUsers.flatMap((mentor, mentorIndex) =>
      [0, 1].map(async (slotIndex) => {
        const dayOffset = mentorIndex * 2 + slotIndex + 1;
        const startHour = slotIndex === 0 ? 10 : 14;
        const startTime = daysFromNow(dayOffset, startHour);
        const endTime = daysFromNow(dayOffset, startHour + 1);

        const existingTimeslot = await prisma.timeslot.findFirst({
          where: {
            mentorId: mentor.id,
            startTime,
            endTime,
          },
        });

        if (existingTimeslot) {
          return existingTimeslot;
        }

        return prisma.timeslot.create({
          data: {
            mentorId: mentor.id,
            date: startTime,
            startTime,
            endTime,
          },
        });
      }),
    ),
  );
  console.log(`Timeslots ensured: ${timeslots.length}`);

  const bookings = await Promise.all(
    timeslots.map(async (timeslot, index) => {
      const existingBooking = await prisma.booking.findFirst({
        where: {
          studentId: studentUsers[index % studentUsers.length].id,
          mentorId: timeslot.mentorId,
          timeslotId: timeslot.id,
        },
      });

      if (existingBooking) {
        return existingBooking;
      }

      return prisma.booking.create({
        data: {
          studentId: studentUsers[index % studentUsers.length].id,
          mentorId: timeslot.mentorId,
          timeslotId: timeslot.id,
          startDate: timeslot.startTime,
          endDate: timeslot.endTime,
          status: BookingStatus.CONFIRMED,
        },
      });
    }),
  );
  console.log(`Bookings ensured: ${bookings.length}`);

  const shifts = await Promise.all(
    mentorUsers.slice(0, 3).map(async (mentor, index) => {
      const daysAgo = index + 1;
      const clockInAt = daysFromNow(-daysAgo, 9 + index);
      const clockOutAt = daysFromNow(-daysAgo, 12 + index);

      const existingShift = await prisma.shift.findFirst({
        where: {
          mentorId: mentor.id,
          clockInAt,
          clockOutAt,
        },
      });

      if (existingShift) {
        return existingShift;
      }

      return prisma.shift.create({
        data: {
          mentorId: mentor.id,
          clockInAt,
          clockOutAt,
        },
      });
    }),
  );
  console.log(`Shifts ensured: ${shifts.length}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
