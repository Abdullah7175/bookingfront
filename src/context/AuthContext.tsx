// src/context/AuthContext.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { http } from "../lib/http";
import type { User } from "../types";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// --- helpers ---
const normalizeId = (val: any): string | null => {
  if (!val) return null;
  let s = typeof val === "string" ? val : String(val);
  s = s.trim();
  const m = s.match(/^ObjectId\(["']?([0-9a-fA-F]{24})["']?\)$/);
  if (m) s = m[1];
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1);
  }
  return /^[0-9a-fA-F]{24}$/.test(s) ? s : null;
};

const extractCompanyId = (payload: any): string | null => {
  const c =
    payload?.agent?.company ??
    payload?.user?.company ??
    payload?.company ??
    payload?.companyId ??
    null;
  if (!c) return null;
  if (typeof c === "object" && c?._id) return normalizeId(c._id);
  return normalizeId(c);
};

const saveCompanyIdIfAny = (payload: any) => {
  const cid = extractCompanyId(payload);
  if (cid) localStorage.setItem("companyId", cid);
  return !!cid;
};

async function fetchMeWithBuster() {
  const ts = Date.now();
  try {
    const res = await http.get(`/api/auth/me`, { params: { _: ts } });
    return res.data;
  } catch {
    const res2 = await http.get(`/api/agent/me`, { params: { _: ts } });
    return res2.data;
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session on boot
  useEffect(() => {
    const boot = async () => {
      try {
        const storedUser = localStorage.getItem("user");
        if (storedUser) setUser(JSON.parse(storedUser));

        const token = localStorage.getItem("token");
        if (!token) return;

        // If we don't already have companyId, force-fetch /me with cache-buster
        if (!localStorage.getItem("companyId")) {
          const me = await fetchMeWithBuster();
          if (me) {
            saveCompanyIdIfAny(me);
            localStorage.setItem("user", JSON.stringify(me));
            setUser(me);
          }
        } else {
          // still refresh user silently
          try {
            const me = await fetchMeWithBuster();
            if (me) {
              saveCompanyIdIfAny(me);
              localStorage.setItem("user", JSON.stringify(me));
              setUser(me);
            }
          } catch {
            // ignore
          }
        }
      } catch {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        localStorage.removeItem("companyId");
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    boot();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      // Try admin login first, then agent login
      let res;
      try {
        res = await http.post("/api/auth/login", { email, password });
      } catch (adminError) {
        res = await http.post("/api/agent/login", { email, password });
      }

      const { token } = res.data || {};
      if (!token) return false;

      // Persist token immediately (so next /me includes Authorization)
      localStorage.setItem("token", token);

      // Save companyId if login payload already has it
      const hadCompany = saveCompanyIdIfAny(res.data);

      // Always force-fetch /me (cache-busted) to normalize user + companyId
      const me = await fetchMeWithBuster();
      if (me) {
        saveCompanyIdIfAny(me);
        localStorage.setItem("user", JSON.stringify(me));
        setUser(me);
      } else if (!hadCompany) {
        // last resort: keep minimal user from login payload
        const u =
          res.data.user ??
          ({
            id: res.data._id,
            name: res.data.name,
            email: res.data.email,
            role: res.data.role,
          } as User);
        localStorage.setItem("user", JSON.stringify(u));
        setUser(u);
      }

      return true;
    } catch (err) {
      console.error("Login failed:", err);
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("companyId");
      return false;
    }
  };

  const logout = async () => {
    try {
      await http.post("/api/auth/logout").catch(() => {});
    } finally {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("companyId");
      setUser(null);
    }
  };

  const value = useMemo(
    () => ({ user, isAuthenticated: !!user, isLoading, login, logout }),
    [user, isLoading]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
};
