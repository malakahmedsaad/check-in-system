import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
const resendFromEmail = process.env.RESEND_FROM_EMAIL;

if (!resendApiKey) {
  throw new Error("RESEND_API_KEY is not configured");
}

if (!resendFromEmail) {
  throw new Error("RESEND_FROM_EMAIL is not configured");
}

const checkedResendApiKey = resendApiKey;
const checkedResendFromEmail = resendFromEmail;
const resend = new Resend(checkedResendApiKey);

// Temporary test recipient until seeded mentor accounts have real verified emails.
const checkinNotificationRecipient = "malkahmedsaad2005@gmail.com";

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

  console.log("Check-in email attempt:", {
    to: checkinNotificationRecipient,
    subject,
    timestamp: new Date().toISOString(),
  });

  const response = await resend.emails.send({
    from: checkedResendFromEmail,
    to: checkinNotificationRecipient,
    subject,
    text,
  });

  if (response.error) {
    console.error("Resend error:", response.error);
    return;
  }

  console.log("Email sent successfully, id:", response.data.id);
}
