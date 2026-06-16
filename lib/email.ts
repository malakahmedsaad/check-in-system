import { Resend } from "resend";

const checkinNotificationRecipient = "mohamedm@berea.edu";

export interface CheckinEmailParams {
  mentorEmail: string;
  mentorName: string;
  studentName: string;
  mentorType: "CONSULTATION" | "LAB";
  bookingDate: string;
  startTime: string;
  endTime: string;
  checkedInAt: string;
}

export async function sendCheckinNotification(params: CheckinEmailParams) {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    console.error(
      "Email failed: RESEND_API_KEY or RESEND_FROM_EMAIL is not configured",
    );
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const subject = `${params.studentName} has arrived for your appointment`;

  const text = `
Hi ${params.mentorName},

Your student ${params.studentName} has just checked in for your ${params.mentorType === "LAB" ? "Lab" : "Consultation"} appointment.

Appointment details:
- Date: ${params.bookingDate}
- Time: ${params.startTime} – ${params.endTime}
- Checked in at: ${params.checkedInAt}

Please head to the meeting room when ready.

Note: this test notification was sent to ${checkinNotificationRecipient} instead of ${params.mentorEmail}.
  `.trim();

  const response = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: checkinNotificationRecipient,
    subject,
    text,
  });

  if (response.error) {
    console.error("Email failed:", response.error);
    return;
  }

  console.log("Check-in email sent:", response.data.id);
}
