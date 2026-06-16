// src/components/ProtectedRoute.tsx
import { useEffect } from "react";
import { useLocation } from "wouter";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const token = localStorage.getItem("accessToken");

  useEffect(() => {
    if (!token) setLocation("/login");
  }, [token, setLocation]);

  return token ? <>{children}</> : null;
}