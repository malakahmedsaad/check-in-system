import { Resend } from "resend";

const MAGIC_LINK_EMAIL_RECIPIENT = "malkahmedsaad2005@gmail.com";

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

export interface MagicLinkEmailParams {
  to: string;
  name: string;
  link: string;
}

export async function sendCheckinNotification(params: CheckinEmailParams) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const resendFromEmail = process.env.RESEND_FROM_EMAIL;
  const recipient = process.env.CHECKIN_NOTIFICATION_RECIPIENT ?? params.mentorEmail;

  if (!resendApiKey || !resendFromEmail) {
    console.warn("Check-in email skipped: Resend is not configured");
    return;
  }

  const resend = new Resend(resendApiKey);
  const subject = `${params.studentName} has arrived for your appointment`;
  const testRecipientNote =
    recipient !== params.mentorEmail
      ? `\n\nNote: this test notification was sent to ${recipient} instead of ${params.mentorEmail}.`
      : "";

  const text = `
Hi ${params.mentorName},

Your student ${params.studentName} has just checked in for your ${params.mentorType === "LAB" ? "Lab" : "Consultation"} appointment.

Appointment details:
- Date: ${params.bookingDate}
- Time: ${params.startTime} – ${params.endTime}
- Checked in at: ${params.checkedInAt}

Please head to the meeting room when ready.
${testRecipientNote}
  `.trim();

  const response = await resend.emails.send({
    from: resendFromEmail,
    to: recipient,
    subject,
    text,
  });

  if (response.error) {
    console.error("Resend error:", response.error);
    return;
  }
}

export async function sendMagicLinkEmail(params: MagicLinkEmailParams) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const resendFromEmail = process.env.RESEND_FROM_EMAIL;
  const recipient = MAGIC_LINK_EMAIL_RECIPIENT;
  const redirectedRecipientNote =
    recipient !== params.to
      ? `\n\nNote: this sign-in link was requested for ${params.to} and redirected to ${recipient}.`
      : "";

  if (!resendApiKey || !resendFromEmail) {
    console.warn("Magic link email skipped: Resend is not configured");
    return;
  }

  const resend = new Resend(resendApiKey);
  const text = `
Hi ${params.name},

Use this link to sign in:
${params.link}

This link expires in 15 minutes and can only be used once.
${redirectedRecipientNote}
  `.trim();

  const response = await resend.emails.send({
    from: resendFromEmail,
    to: recipient,
    subject: "Your sign-in link",
    text,
  });

  if (response.error) {
    console.error("Resend error:", response.error);
  }
}
