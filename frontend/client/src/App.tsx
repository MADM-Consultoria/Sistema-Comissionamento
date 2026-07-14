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
    collaborators,
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
  // INICIALIZAÇÃO: verifica sessão via /auth/me
  // ============================================================
  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      try {
        console.log('🔐 Verificando sessão via /auth/me...');
        const res = await fetch(`${API_BASE}/auth/me`, { credentials: 'include' });

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.user) {
            console.log('✅ Sessão restaurada para:', data.user.nome);
            setCurrentUser(data.user);
          } else {
            console.log('ℹ️ Sessão não encontrada ou inválida');
          }
        } else {
          console.log('ℹ️ /auth/me retornou status', res.status);
        }
      } catch (err) {
        console.error('Erro ao verificar sessão:', err);
      } finally {
        if (isMounted) setAppLoading(false);
      }
    };

    init();

    const timer = setTimeout(() => {
      if (isMounted && appLoading) {
        console.warn('⏱️ Timeout de segurança: forçando fim do carregamento');
        setAppLoading(false);
      }
    }, 5000);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, []);

  // ============================================================
  // CARREGAMENTO DE DADOS EM SEGUNDO PLANO
  // ============================================================
  useEffect(() => {
    if (!currentUser) return;

    if (collaborators.length === 0) {
      console.log('⏳ [App] Disparando carregamento de dados em segundo plano...');
      loadCollaboratorsAndMetrics().catch(err =>
        console.error('Erro ao carregar métricas:', err)
      );
      loadRawMetrics().catch(err =>
        console.error('Erro ao carregar raw metrics:', err)
      );
    }
  }, [currentUser, collaborators.length, loadCollaboratorsAndMetrics, loadRawMetrics]);

  // ============================================================
  // HEARTBEAT – mantém sessão ativa a cada 5 minutos
  // ============================================================
  useEffect(() => {
    if (!currentUser) return;
    const interval = setInterval(async () => {
      try {
        await fetch(`${API_BASE}/auth/ping`, {
          credentials: 'include',
          headers: { 'x-csrf-token': localStorage.getItem('csrfToken') || '' },
        });
      } catch (_) { /* ignore */ }
    }, 5 * 60 * 1000);
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