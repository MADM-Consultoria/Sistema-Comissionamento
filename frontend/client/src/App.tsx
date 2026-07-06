// src/App.tsx
import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { PeriodProvider } from '@/contexts/period';
import Home from "./pages/Home";
import Comissoes from "./pages/Comissoes";
import Funil from "./pages/Funil";
import Analytics from "./pages/Analytics";
import Ranking from "./pages/Ranking";
import Relatorio from "./pages/Relatorio";
import Notificacoes from "./pages/Notificacoes";
import Configuration from "./pages/Configuration";
import Suporte from "./pages/Suporte";
import Login from "./pages/Login";
import Verify2FA from "./pages/ResetPassword/Verify2FA";
import ProtectedRoute from "./components/ProtectedRoute";
import ForgotPassword from "./pages/ResetPassword/ForgotPassword";
import ResetPassword from "./pages/ResetPassword/ResetPassword";
import { API_BASE } from "@/lib/api";
import { useAppStore } from "@/lib/dataStore";
import { Loader2 } from "lucide-react";

function startHeartbeat(): NodeJS.Timeout {
  const interval = setInterval(async () => {
    try {
      await fetch(`${API_BASE}/auth/ping`, {
        credentials: 'include',
        headers: { 'x-csrf-token': localStorage.getItem('csrfToken') || '' },
      });
    } catch (_) { /* ignore */ }
  }, 5 * 60 * 1000);
  return interval;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/verify-2fa" component={Verify2FA} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/404" component={NotFound} />

      <Route path="/">
        <PeriodProvider>
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        </PeriodProvider>
      </Route>
      <Route path="/home">
        <PeriodProvider>
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        </PeriodProvider>
      </Route>
      <Route path="/comissoes">
        <PeriodProvider>
          <ProtectedRoute>
            <Comissoes />
          </ProtectedRoute>
        </PeriodProvider>
      </Route>
      <Route path="/funil">
        <PeriodProvider>
          <ProtectedRoute>
            <Funil />
          </ProtectedRoute>
        </PeriodProvider>
      </Route>
      <Route path="/analytics">
        <PeriodProvider>
          <ProtectedRoute>
            <Analytics />
          </ProtectedRoute>
        </PeriodProvider>
      </Route>
      <Route path="/ranking">
        <PeriodProvider>
          <ProtectedRoute>
            <Ranking />
          </ProtectedRoute>
        </PeriodProvider>
      </Route>
      <Route path="/notificacoes">
        <PeriodProvider>
          <ProtectedRoute>
            <Notificacoes />
          </ProtectedRoute>
        </PeriodProvider>
      </Route>
      <Route path="/configuration">
        <PeriodProvider>
          <ProtectedRoute>
            <Configuration />
          </ProtectedRoute>
        </PeriodProvider>
      </Route>
      <Route path="/suporte">
        <PeriodProvider>
          <ProtectedRoute>
            <Suporte />
          </ProtectedRoute>
        </PeriodProvider>
      </Route>
      <Route path="/relatorio">
        <PeriodProvider>
          <ProtectedRoute>
            <Relatorio />
          </ProtectedRoute>
        </PeriodProvider>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  const {
    currentUser,
    setCurrentUser,
    loadCollaboratorsAndMetrics,
    loadRawMetrics,
    loadWeeklyPerformanceData,
  } = useAppStore();

  const [appLoading, setAppLoading] = useState(true);

  // Busca token CSRF
  useEffect(() => {
    fetch(`${API_BASE}/csrf-token`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.csrfToken && data.csrfToken !== 'disabled') {
          localStorage.setItem('csrfToken', data.csrfToken);
        }
      })
      .catch(() => {});
  }, []);

  // ============================================================
  // INICIALIZAÇÃO PRINCIPAL: verifica sessão e carrega dados
  // ============================================================
  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout | null = null;

    const init = async () => {
      try {
        // 🔥 EM DESENVOLVIMENTO: força logout para sempre ver a tela de login
        // Remova esta seção em produção se quiser manter a sessão
        if (import.meta.env.DEV) {
          console.log('🧪 [App] Modo desenvolvimento: forçando logout para ver tela de login');
          await fetch(`${API_BASE}/auth/logout`, { 
            method: 'POST', 
            credentials: 'include',
            headers: { 'x-csrf-token': localStorage.getItem('csrfToken') || '' }
          });
          localStorage.removeItem('csrfToken');
          setCurrentUser(null);
          if (isMounted) setAppLoading(false);
          return;
        }

        console.log('🔐 [App] Verificando sessão...');
        const res = await fetch(`${API_BASE}/auth/me`, { credentials: 'include' });

        if (!res.ok) {
          console.log('ℹ️ [App] Sessão não encontrada (status:', res.status, ')');
          if (isMounted) setAppLoading(false);
          return;
        }

        const data = await res.json();
        console.log('📦 [App] Resposta /auth/me:', data);

        if (data.success && data.user && data.user.id) {
          console.log('✅ [App] Sessão restaurada para:', data.user.name);
          setCurrentUser(data.user);

          // Carrega dados iniciais (apenas para usuários autenticados)
          console.log('⏳ [App] Carregando dados iniciais...');
          await Promise.race([
            Promise.all([
              loadCollaboratorsAndMetrics(undefined, undefined, undefined, undefined),
              loadRawMetrics({}),
              loadWeeklyPerformanceData(),
            ]),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Timeout ao carregar dados iniciais')), 10000)
            ),
          ]);
          console.log('✅ [App] Dados iniciais carregados com sucesso');
        } else {
          console.log('ℹ️ [App] Sessão inválida ou incompleta');
          setCurrentUser(null);
        }

        if (isMounted) setAppLoading(false);
      } catch (err) {
        console.error('❌ [App] Erro na inicialização:', err);
        setCurrentUser(null);
        if (isMounted) setAppLoading(false);
      }
    };

    init();

    // 🔥 TIMEOUT DE SEGURANÇA: força fim do loading após 12 segundos
    timeoutId = setTimeout(() => {
      if (isMounted && appLoading) {
        console.warn('⏱️ [App] Timeout de segurança (12s): forçando fim do carregamento');
        setAppLoading(false);
      }
    }, 12000);

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Executa UMA ÚNICA VEZ

  // ============================================================
  // HEARTBEAT (apenas se autenticado)
  // ============================================================
  useEffect(() => {
    if (!currentUser) return;
    const interval = startHeartbeat();
    return () => clearInterval(interval);
  }, [currentUser]);

  // ============================================================
  // ATUALIZA TOKEN CSRF APÓS LOGIN
  // ============================================================
  useEffect(() => {
    if (!currentUser) return;
    fetch(`${API_BASE}/csrf-token`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.csrfToken && data.csrfToken !== 'disabled') {
          localStorage.setItem('csrfToken', data.csrfToken);
        }
      })
      .catch(() => {});
  }, [currentUser]);

  // ============================================================
  // RENDER
  // ============================================================
  if (appLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-[#09175b]" />
        <span className="ml-2 text-gray-500">Carregando sistema...</span>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster position="top-right" richColors />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}