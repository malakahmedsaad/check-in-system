import { getSession } from "./get-session";

export async function requireAdmin() {
  const session = await getSession();

  if (!session?.isAdmin) {
    return null;
  }

  return session;
}
