export function validateEnv() {
  const required = [
    "DATABASE_URL",
    "OS4_DATABASE_URL",
    "JWT_SECRET",
    "RESEND_API_KEY",
    "RESEND_FROM_EMAIL",
  ];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      "Missing required environment variables: " +
        missing.join(", ") +
        ". See .env.local.example",
    );
  }
}
