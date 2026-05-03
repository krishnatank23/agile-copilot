"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, type AuthUser, getToken, setToken, clearToken } from "@/lib/api";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  login: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
    window.location.href = "/login";
  }, []);

  // On mount, validate any stored token
  useEffect(() => {
    const token = getToken();
    if (!token) { setLoading(false); return; }
    api.auth.me()
      .then(setUser)
      .catch(() => { clearToken(); })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await api.auth.login(username, password);
    setToken(res.access_token);
    const me = await api.auth.me();
    setUser(me);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
