// Purpose: Defines the root HTML shell, global styles, and user session provider.

import type { Metadata } from "next";
import { UserProvider } from "../../context/UserContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bechtel Center Check-In Kiosk",
  description: "Student check-in, mentor shifts, and admin kiosk controls.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col font-sans">
        <UserProvider>{children}</UserProvider>
      </body>
    </html>
  );
}
