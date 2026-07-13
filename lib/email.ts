// Purpose: Sends Resend-powered check-in and OTP notification emails.

import { Resend } from "resend";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

export interface OtpEmailParams {
  to: string;
  name: string;
  code: string;
}

function getResendConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  if (!fromEmail || !emailPattern.test(fromEmail)) {
    throw new Error("RESEND_FROM_EMAIL is not configured");
  }

  return { apiKey, fromEmail };
}

function validateRecipient(email: string) {
  if (!emailPattern.test(email)) {
    throw new Error("Email recipient is invalid");
  }

  return email;
}

export async function sendCheckinNotification(params: CheckinEmailParams) {
  const recipient = process.env.CHECKIN_NOTIFICATION_RECIPIENT ?? params.mentorEmail;
  const { apiKey, fromEmail } = getResendConfig();
  const resend = new Resend(apiKey);
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
    from: fromEmail,
    to: validateRecipient(recipient),
    subject,
    text,
  });

  if (response.error) {
    console.error("Resend error:", response.error.message);
    return;
  }
}

export async function sendOtpEmail(params: OtpEmailParams) {
  const { apiKey, fromEmail } = getResendConfig();
  const recipient = "malkahmedsaad2005@gmail.com";

  console.log("OTP for", params.to, ":", params.code);

  const resend = new Resend(apiKey);
  const text = `
Hi ${params.name},

Your sign-in code is: ${params.code}

This code expires in 10 minutes. Do not share it with anyone.

If you didn't request this, you can ignore this email.
  `.trim();

  const response = await resend.emails.send({
    from: fromEmail,
    to: validateRecipient(recipient),
    subject: "Your sign-in code",
    text,
  });

  if (response.error) {
    console.error("Resend error:", response.error.message);
  }
}
