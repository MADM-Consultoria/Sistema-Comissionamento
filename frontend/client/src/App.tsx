// src/App.tsx
import { useEffect } from "react";
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
import Login from "./pages/Login";
import Verify2FA from "./pages/ResetPassword/Verify2FA";
import ProtectedRoute from "./components/ProtectedRoute";
import ForgotPassword from "./pages/ResetPassword/ForgotPassword";
import ResetPassword from "./pages/ResetPassword/ResetPassword";
import { API_BASE } from "@/lib/api";
import { useAppStore } from "@/lib/dataStore";

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
          {/* ROTA EM DESENVOLVIMENTO
      <Route path="/suporte">
        <PeriodProvider>
          <ProtectedRoute>
            <Suporte />
          </ProtectedRoute>
        </PeriodProvider>
      </Route>*/}
      {/* Fallback */}
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

function App() {
  const { currentUser } = useAppStore();

  // ===== Buscar token CSRF ao montar (necessário para login) =====
  useEffect(() => {
    const fetchCsrfToken = async () => {
      try {
        const res = await fetch(`${API_BASE}/csrf-token`, { credentials: 'include' });
        const data = await res.json();
        if (data.csrfToken && data.csrfToken !== 'disabled') {
          localStorage.setItem('csrfToken', data.csrfToken);
        }
      } catch (err) {
        // Falha silenciosa – o token não é crítico se o backend não exigir
        console.warn('Não foi possível obter token CSRF:', err);
      }
    };

    fetchCsrfToken();
  }, []);

  // ===== Atualizar token após login (opcional, mas seguro) =====
  useEffect(() => {
    if (!currentUser) return;

    const refreshCsrfToken = async () => {
      try {
        const res = await fetch(`${API_BASE}/csrf-token`, { credentials: 'include' });
        const data = await res.json();
        if (data.csrfToken && data.csrfToken !== 'disabled') {
          localStorage.setItem('csrfToken', data.csrfToken);
        }
      } catch (err) {
        console.error('Erro ao atualizar token CSRF:', err);
      }
    };

    refreshCsrfToken();
  }, [currentUser]);

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

export default App;