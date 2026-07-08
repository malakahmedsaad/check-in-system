ALTER TABLE "Shift" DROP CONSTRAINT "Shift_mentorId_fkey";
ALTER TABLE "Shift"
ADD CONSTRAINT "Shift_mentorId_fkey"
FOREIGN KEY ("mentorId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Timeslot" DROP CONSTRAINT "Timeslot_mentorId_fkey";
ALTER TABLE "Timeslot"
ADD CONSTRAINT "Timeslot_mentorId_fkey"
FOREIGN KEY ("mentorId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Booking" DROP CONSTRAINT "Booking_studentId_fkey";
ALTER TABLE "Booking"
ADD CONSTRAINT "Booking_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Booking" DROP CONSTRAINT "Booking_mentorId_fkey";
ALTER TABLE "Booking"
ADD CONSTRAINT "Booking_mentorId_fkey"
FOREIGN KEY ("mentorId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Booking" DROP CONSTRAINT "Booking_timeslotId_fkey";
ALTER TABLE "Booking"
ADD CONSTRAINT "Booking_timeslotId_fkey"
FOREIGN KEY ("timeslotId") REFERENCES "Timeslot"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Checkin" DROP CONSTRAINT "Checkin_bookingId_fkey";
ALTER TABLE "Checkin"
ADD CONSTRAINT "Checkin_bookingId_fkey"
FOREIGN KEY ("bookingId") REFERENCES "Booking"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
