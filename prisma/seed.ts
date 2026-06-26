import { BookingStatus, MentorType, PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();
const kioskStatusId = "singleton";

const mentors = [
  {
    email: "mentor1@purdue.edu",
    name: "Alex Johnson",
    role: Role.mentor,
    isAdmin: true,
    mentorType: MentorType.CONSULTATION,
  },
  {
    email: "mentor2@purdue.edu",
    name: "Sam Rivera",
    role: Role.mentor,
    isAdmin: false,
    mentorType: MentorType.LAB,
  },
  {
    email: "mentor3@purdue.edu",
    name: "Jordan Lee",
    role: Role.mentor,
    isAdmin: false,
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
  const mentorUsers = await Promise.all(
    mentors.map((mentor) =>
      prisma.user.upsert({
        where: { email: mentor.email },
        update: {
          name: mentor.name,
          role: mentor.role,
          isAdmin: mentor.isAdmin,
          mentorType: mentor.mentorType,
        },
        create: mentor,
      }),
    ),
  );

  const studentUsers = await Promise.all(
    students.map((student) =>
      prisma.user.upsert({
        where: { email: student.email },
        update: {
          name: student.name,
          role: student.role,
          isAdmin: false,
          mentorType: null,
        },
        create: {
          ...student,
          isAdmin: false,
          mentorType: null,
        },
      }),
    ),
  );

  const mentorIds = mentorUsers.map((mentor) => mentor.id);
  const studentIds = studentUsers.map((student) => student.id);

  await prisma.checkin.deleteMany({
    where: {
      booking: {
        OR: [{ mentorId: { in: mentorIds } }, { studentId: { in: studentIds } }],
      },
    },
  });

  await prisma.booking.deleteMany({
    where: {
      OR: [{ mentorId: { in: mentorIds } }, { studentId: { in: studentIds } }],
    },
  });

  await prisma.timeslot.deleteMany({
    where: {
      mentorId: { in: mentorIds },
    },
  });

  await prisma.shift.deleteMany({
    where: {
      mentorId: { in: mentorIds },
    },
  });

  await prisma.kioskStatus.upsert({
    where: { id: kioskStatusId },
    update: {},
    create: {
      id: kioskStatusId,
      isOpen: false,
    },
  });

  const timeslots = await Promise.all(
    mentorUsers.flatMap((mentor, mentorIndex) =>
      [0, 1].map((slotIndex) => {
        const dayOffset = mentorIndex * 2 + slotIndex + 1;
        const startHour = slotIndex === 0 ? 10 : 14;
        const startTime = daysFromNow(dayOffset, startHour);
        const endTime = daysFromNow(dayOffset, startHour + 1);

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

  await Promise.all(
    timeslots.map((timeslot, index) =>
      prisma.booking.create({
        data: {
          studentId: studentUsers[index % studentUsers.length].id,
          mentorId: timeslot.mentorId,
          timeslotId: timeslot.id,
          startDate: timeslot.startTime,
          endDate: timeslot.endTime,
          status: BookingStatus.CONFIRMED,
        },
      }),
    ),
  );

  await Promise.all(
    mentorUsers.slice(0, 3).map((mentor, index) => {
      const daysAgo = index + 1;
      const clockInAt = daysFromNow(-daysAgo, 9 + index);
      const clockOutAt = daysFromNow(-daysAgo, 12 + index);

      return prisma.shift.create({
        data: {
          mentorId: mentor.id,
          clockInAt,
          clockOutAt,
        },
      });
    }),
  );
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
