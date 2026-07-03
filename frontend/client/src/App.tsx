// src/App.tsx
import { useEffect, useState, useRef } from "react";
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

// ============================================================
// HEARTBEAT: mantém a sessão ativa
// ============================================================
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
    collaborators,
    loadCollaboratorsAndMetrics,
    loadRawMetrics,
    loadWeeklyPerformanceData,
  } = useAppStore();

  const [appLoading, setAppLoading] = useState(true);
  const initialLoadDone = useRef(false);

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

  // Restaura sessão e carrega dados iniciais (UMA ÚNICA VEZ)
  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout | null = null;

    const init = async () => {
      try {
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

          // Carrega dados iniciais apenas se ainda não foram carregados
          if (!initialLoadDone.current || collaborators.length === 0) {
            console.log('⏳ [App] Carregando dados iniciais...');
            
            await Promise.race([
              Promise.all([
                loadCollaboratorsAndMetrics(undefined, undefined, undefined, undefined),
                loadRawMetrics({}), // objeto vazio = todos os dados sem filtros
                loadWeeklyPerformanceData(),
              ]),
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout ao carregar dados iniciais')), 15000)
              ),
            ]);
            initialLoadDone.current = true;
            console.log('✅ [App] Dados iniciais carregados com sucesso');
          } else {
            console.log('ℹ️ [App] Dados já carregados, pulando recarga');
          }
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

    // Timeout de segurança: força fim do loading após 20 segundos
    timeoutId = setTimeout(() => {
      if (isMounted && appLoading) {
        console.warn('⏱️ [App] Timeout de segurança (20s): forçando fim do carregamento');
        setAppLoading(false);
      }
    }, 20000);

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [loadCollaboratorsAndMetrics, loadRawMetrics, loadWeeklyPerformanceData, setCurrentUser, collaborators.length, appLoading]);

  // Heartbeat
  useEffect(() => {
    if (!currentUser) return;
    const interval = startHeartbeat();
    return () => clearInterval(interval);
  }, [currentUser]);

  // Atualiza token CSRF após login
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

  // Enquanto carrega, exibe loader
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