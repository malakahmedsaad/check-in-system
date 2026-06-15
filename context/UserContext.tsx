"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

type User = {
  name: string;
  email: string;
  role: string;
};

type UserContextValue = {
  user: User | null;
  login: (email: string) => Promise<void>;
  logout: () => Promise<void>;
};

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      const response = await fetch("/api/auth/me");

      if (!isMounted) {
        return;
      }

      if (!response.ok) {
        setUser(null);
        return;
      }

      const data = (await response.json()) as { user: User };
      setUser(data.user);
    }

    restoreSession().catch(() => {
      if (isMounted) {
        setUser(null);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (email: string) => {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    });

    const data = (await response.json()) as {
      user?: User;
      error?: string;
    };

    if (!response.ok || !data.user) {
      throw new Error(data.error ?? "Unable to sign in");
    }

    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
    });

    setUser(null);
    router.push("/login");
  }, [router]);

  const value = useMemo(
    () => ({
      user,
      login,
      logout,
    }),
    [login, logout, user],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);

  if (!context) {
    throw new Error("useUser must be used within UserProvider");
  }

  return context;
}
