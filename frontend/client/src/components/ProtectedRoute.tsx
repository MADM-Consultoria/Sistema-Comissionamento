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
      // Se não há usuário, não carrega dados e redireciona
      if (!currentUser || !currentUser.id) {
        console.log('🔒 [ProtectedRoute] Usuário não autenticado');
        if (isMounted) {
          setLoading(false);
          setError(null);
        }
        return;
      }

      // Se já temos colaboradores, não recarrega
      if (collaborators.length > 0) {
        console.log('✅ [ProtectedRoute] Dados já carregados (', collaborators.length, ' colaboradores)');
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
            setTimeout(() => reject(new Error("Tempo limite excedido ao carregar dados iniciais")), 10000)
          ),
        ]);
        if (isMounted) {
          console.log('✅ [ProtectedRoute] Dados carregados com sucesso');
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

    // Timeout de segurança (12s)
    timeoutId = setTimeout(() => {
      if (isMounted && loading) {
        console.warn("⏱️ [ProtectedRoute] Timeout de segurança (12s) forçando saída do loading");
        setLoading(false);
        setError("O carregamento demorou mais que o esperado. Tente recarregar a página.");
      }
    }, 12000);

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [currentUser, collaborators, loadCollaboratorsAndMetrics, loadRawMetrics]);

  // Se não houver usuário, redireciona para login
  if (!currentUser || !currentUser.id) {
    console.log("🔒 [ProtectedRoute] Redirecionando para /login");
    return <Redirect to="/login" />;
  }

  // Se estiver carregando, exibe loader
  if (loading) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-screen"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="w-8 h-8 animate-spin text-[#09175b]" />
        <span className="mt-2 text-sm text-gray-500">Carregando dados...</span>
        <p className="mt-1 text-xs text-gray-400">Isso pode levar alguns segundos</p>
      </div>
    );
  }

  // Se houve erro, exibe no console mas renderiza a página (não bloqueia)
  if (error) {
    console.warn("⚠️ [ProtectedRoute] Erro no carregamento, mas renderizando página:", error);
  }

  // Renderiza a página protegida
  return <>{children}</>;
}