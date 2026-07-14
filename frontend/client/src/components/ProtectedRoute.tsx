// src/components/ProtectedRoute.tsx
import { useEffect, useState } from "react";
import { Redirect } from "wouter";
import { useAppStore } from "@/lib/dataStore";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { currentUser, collaborators, loadCollaboratorsAndMetrics, loadRawMetrics } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout | null = null;

    const loadData = async () => {
      if (!currentUser || !currentUser.e_mail) {
        console.log('🔒 [ProtectedRoute] Usuário não autenticado');
        if (isMounted) {
          setLoading(false);
          setError(null);
        }
        return;
      }

      if (collaborators.length > 0) {
        console.log('✅ [ProtectedRoute] Dados já carregados');
        if (isMounted) {
          setLoading(false);
          setError(null);
        }
        return;
      }

      console.log('⏳ [ProtectedRoute] Carregando dados iniciais...');
      try {
        setError(null);
        await Promise.race([
          Promise.all([loadCollaboratorsAndMetrics(), loadRawMetrics()]),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Timeout ao carregar dados")), 10000)
          ),
        ]);
        if (isMounted) {
          console.log('✅ [ProtectedRoute] Dados carregados');
          setLoading(false);
        }
      } catch (err) {
        console.error("❌ [ProtectedRoute] Erro ao carregar dados:", err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Erro ao carregar dados");
          setLoading(false);
        }
      }
    };

    loadData();

    timeoutId = setTimeout(() => {
      if (isMounted && loading) {
        console.warn("⏱️ Timeout de segurança");
        setLoading(false);
        setError("Carregamento demorado. Tente recarregar.");
      }
    }, 12000);

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [currentUser, collaborators, loadCollaboratorsAndMetrics, loadRawMetrics]);

  if (!currentUser || !currentUser.e_mail) {
    return <Redirect to="/login" />;
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen" role="status">
        <Loader2 className="w-8 h-8 animate-spin text-[#09175b]" />
        <span className="mt-2 text-sm text-gray-500">Carregando dados...</span>
        <p className="mt-1 text-xs text-gray-400">Isso pode levar alguns segundos</p>
      </div>
    );
  }

  if (error) {
    console.warn("⚠️ Erro no carregamento:", error);
  }

  return <>{children}</>;
}