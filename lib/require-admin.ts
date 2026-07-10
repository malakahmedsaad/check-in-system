// Purpose: Restricts server-side access to sessions with the admin role.

import { getSession } from "./get-session";

export async function requireAdmin() {
  const session = await getSession();

  if (session?.role !== "admin") {
    return null;
  }

  return session;
}
