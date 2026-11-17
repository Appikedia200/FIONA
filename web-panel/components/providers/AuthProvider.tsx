"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api";
import { User } from "@/types";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  // PROFESSIONAL: Prevent hydration mismatch by deferring localStorage read until after mount
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Read localStorage ONLY on client after mount (prevents hydration mismatch)
    setMounted(true);
    
    try {
      // Check for admin session first, then technician
      const adminToken = localStorage.getItem("fiona_admin_token");
      const adminUser = localStorage.getItem("fiona_admin_user");
      const techToken = localStorage.getItem("fiona_token");
      const techUser = localStorage.getItem("fiona_user");

      // Admin takes priority if both exist
      const token = adminToken || techToken;
      const storedUser = adminUser || techUser;

      if (token && storedUser) {
        const parsed = JSON.parse(storedUser);
        if (parsed && parsed.email) {
          // Initialize API client token immediately
          apiClient.setToken(token);
          console.log("[Auth] ✅ Restored session:", parsed.email, parsed.role);
          setUser(parsed);
        }
      }
    } catch (error) {
      console.error("[Auth] Failed to parse user, removing corrupted data:", error);
      localStorage.removeItem("fiona_user");
      localStorage.removeItem("fiona_token");
      localStorage.removeItem("fiona_admin_user");
      localStorage.removeItem("fiona_admin_token");
    }
    
    console.log("[Auth] Initialized - user:", user?.email || "none", "role:", user?.role || "none");
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      console.log("[Auth] 🔵 Starting login for:", email);
      
      const response = await apiClient.login(email, password);
      
      console.log("[Auth] 🔵 RAW RESPONSE:", JSON.stringify(response, null, 2));

      if (!response.success) {
        console.error("[Auth] ❌ Login failed:", response.error);
        return { success: false, error: response.error || "Login failed" };
      }

      // Backend returns token and user directly (not nested in data)
      if (!response.token || !response.user) {
        console.error("[Auth] ❌ No token or user in response");
        return { success: false, error: "Invalid response from server" };
      }

      const userData = response.user;
      const tokenData = response.token;

      console.log("[Auth] 🔵 Extracted user:", userData);
      console.log("[Auth] 🔵 Extracted token:", tokenData ? "Present" : "Missing");

      if (!userData || !userData.email) {
        console.error("[Auth] ❌ Invalid user data");
        return { success: false, error: "Invalid user data from server" };
      }

      const userToStore = {
        id: userData.id,
        email: userData.email,
        name: userData.name || userData.email.split('@')[0],
        role: userData.role || "CUSTOMER",
        tenantId: userData.tenantId || null,
        createdAt: userData.createdAt || new Date().toISOString(),
      };

      // PROFESSIONAL: Use role-based storage keys for independent sessions
      const isAdmin = userToStore.role === "ADMIN";
      const tokenKey = isAdmin ? "fiona_admin_token" : "fiona_token";
      const userKey = isAdmin ? "fiona_admin_user" : "fiona_user";

      console.log("[Auth] 🟢 Storing data to:", tokenKey);
      localStorage.setItem(tokenKey, tokenData);
      localStorage.setItem(userKey, JSON.stringify(userToStore));
      
      setUser(userToStore);
      apiClient.setToken(tokenData);

      console.log("[Auth] ✅ LOGIN COMPLETE - User:", userToStore.email, "Role:", userToStore.role);
      
      return { success: true };
      
    } catch (error) {
      console.error("[Auth] ❌ Exception:", error);
      return { success: false, error: "Network error" };
    }
  };

  const logout = () => {
    // PROFESSIONAL: Clear only the current user's session
    if (user?.role === "ADMIN") {
      localStorage.removeItem("fiona_admin_token");
      localStorage.removeItem("fiona_admin_user");
      console.log("[Auth] Admin session cleared");
    } else {
      localStorage.removeItem("fiona_token");
      localStorage.removeItem("fiona_user");
      console.log("[Auth] Technician session cleared");
    }
    
    setUser(null);
    apiClient.clearToken();
    router.push("/login");
  };

  // CRITICAL: Don't render children until mounted (prevents hydration mismatch)
  if (!mounted) {
    return null;
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
