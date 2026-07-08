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
  isUserLoading: boolean;
  setAuthenticatedUser: (user: User) => void;
  logout: () => Promise<void>;
};

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isUserLoading, setIsUserLoading] = useState(true);
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

    restoreSession()
      .catch(() => {
        if (isMounted) {
          setUser(null);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsUserLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
    } finally {
      setUser(null);
      router.push("/login");
    }
  }, [router]);

  const value = useMemo(
    () => ({
      user,
      isUserLoading,
      setAuthenticatedUser: setUser,
      logout,
    }),
    [isUserLoading, logout, user],
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
