export type AppRole = "student" | "mentor" | "admin";

// OS4 role values → kiosk app role concepts
export function translateRole(os4Role: string): AppRole {
  switch (os4Role) {
    case "MEMBER":
      return "student";
    case "PEER_MENTOR":
      return "mentor";
    case "ADMIN":
      return "admin";
    case "SUPERVISOR":
      return "admin";
    default:
      console.warn("[os4-role] Unknown OS4 role encountered:", os4Role);
      return "student";
  }
}

export function isAdmin(os4Role: string): boolean {
  return os4Role === "ADMIN" || os4Role === "SUPERVISOR";
}

export function isMentor(os4Role: string): boolean {
  return os4Role === "PEER_MENTOR";
}

export function isStudent(os4Role: string): boolean {
  return os4Role === "MEMBER";
}
