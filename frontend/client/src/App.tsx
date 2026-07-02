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
      {/* Rotas públicas */}
      <Route path="/login" component={Login} />
      <Route path="/verify-2fa" component={Verify2FA} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/404" component={NotFound} />

      {/* Rotas protegidas */}
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
  const { currentUser, setCurrentUser } = useAppStore();
  const [appLoading, setAppLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

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

  // Verifica sessão
  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout | null = null;

    const checkSession = async () => {
      try {
        console.log('🔐 [App] Verificando sessão...');
        const res = await fetch(`${API_BASE}/auth/me`, { credentials: 'include' });

        if (!res.ok) {
          console.log('ℹ️ [App] Sessão não encontrada (status:', res.status, ')');
          if (isMounted) {
            setCurrentUser(null);
            setIsAuthenticated(false);
            setAppLoading(false);
          }
          return;
        }

        const data = await res.json();
        console.log('📦 [App] Resposta /auth/me:', data);

        if (data.success && data.user && data.user.id) {
          console.log('✅ [App] Sessão restaurada para:', data.user.name);
          if (isMounted) {
            setCurrentUser(data.user);
            setIsAuthenticated(true);
          }
        } else {
          console.log('ℹ️ [App] Sessão inválida ou incompleta');
          if (isMounted) {
            setCurrentUser(null);
            setIsAuthenticated(false);
          }
        }
      } catch (err) {
        console.error('❌ [App] Erro na verificação de sessão:', err);
        if (isMounted) {
          setCurrentUser(null);
          setIsAuthenticated(false);
        }
      } finally {
        if (isMounted) setAppLoading(false);
      }
    };

    checkSession();

    // Timeout de segurança: se demorar mais de 5 segundos, força finalização
    timeoutId = setTimeout(() => {
      if (isMounted && appLoading) {
        console.warn('⏱️ [App] Timeout de segurança (5s): forçando fim do carregamento');
        setCurrentUser(null);
        setIsAuthenticated(false);
        setAppLoading(false);
      }
    }, 5000);

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []); // executa apenas uma vez

  // Heartbeat para manter a sessão ativa
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

  // Enquanto estiver carregando, exibe loader
  if (appLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-[#09175b]" />
        <span className="ml-2 text-gray-500">Carregando sistema...</span>
      </div>
    );
  }

  // Renderiza o roteador
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